from flask import Flask, render_template, request, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
import requests
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'scholarquest-dev-secret'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///scholarquest.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Database Models ---

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)

class Bookmark(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    opp_id = db.Column(db.String(100), nullable=False) # Store Adzuna/Mock ID
    type = db.Column(db.String(50), nullable=False) # 'internship', 'scholarship', 'hackathon'

# Create tables
with app.app_context():
    db.create_all()

# --- Adzuna API config ---
ADZUNA_APP_ID = os.getenv("ADZUNA_APP_ID")
ADZUNA_APP_KEY = os.getenv("ADZUNA_APP_KEY")
ADZUNA_BASE_URL = "https://api.adzuna.com/v1/api/jobs/in/search/1"


# --- Routes ---

@app.route("/")
def index():
    return render_template("index.html")

# --- Authentication APIs ---

@app.route("/api/register", methods=["POST"])
def register():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    
    if not name or not email or not password:
        return jsonify({"status": "error", "message": "Missing fields"}), 400
        
    if User.query.filter_by(email=email).first():
        return jsonify({"status": "error", "message": "Email already exists"}), 400
        
    new_user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password)
    )
    db.session.add(new_user)
    db.session.commit()
    
    # Auto-login
    session['user_id'] = new_user.id
    return jsonify({"status": "success", "message": "Registered successfully", "user": {"name": new_user.name}})

@app.route("/api/login", methods=["POST"])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    
    user = User.query.filter_by(email=email).first()
    if user and check_password_hash(user.password_hash, password):
        session['user_id'] = user.id
        return jsonify({"status": "success", "message": "Logged in", "user": {"name": user.name}})
    
    return jsonify({"status": "error", "message": "Invalid email or password"}), 401

@app.route("/api/logout", methods=["POST"])
def logout():
    session.pop('user_id', None)
    return jsonify({"status": "success"})

@app.route("/api/me", methods=["GET"])
def get_me():
    user_id = session.get('user_id')
    if user_id:
        user = User.query.get(user_id)
        if user:
            return jsonify({"status": "success", "user": {"name": user.name}})
    return jsonify({"status": "error", "message": "Not logged in"}), 401

# --- Bookmarks APIs ---

@app.route("/api/bookmarks", methods=["GET"])
def get_bookmarks():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"status": "error", "message": "Not logged in"}), 401
    
    marks = Bookmark.query.filter_by(user_id=user_id).all()
    saved_ids = [m.opp_id for m in marks]
    return jsonify({"status": "success", "data": saved_ids})

@app.route("/api/bookmarks/toggle", methods=["POST"])
def toggle_bookmark():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"status": "error", "message": "Not logged in"}), 401
        
    opp_id = request.json.get("opp_id")
    opp_type = request.json.get("type", "general")
    
    existing = Bookmark.query.filter_by(user_id=user_id, opp_id=opp_id).first()
    if existing:
        db.session.delete(existing)
        db.session.commit()
        return jsonify({"status": "success", "action": "removed"})
    else:
        new_mark = Bookmark(user_id=user_id, opp_id=opp_id, type=opp_type)
        db.session.add(new_mark)
        db.session.commit()
        return jsonify({"status": "success", "action": "added"})

# --- Internship Opportunities API ---

@app.route("/api/internships")
def get_internships():
    query = request.args.get("q", "")
    location = request.args.get("location", "")
    category = request.args.get("category", "")
    
    if not ADZUNA_APP_ID or not ADZUNA_APP_KEY:
        return jsonify({
            "status": "warning",
            "message": "Adzuna credentials missing. Showing mock internships.",
            "data": get_mock_internships(query, location, category)
        })
        
    params = {
        "app_id": ADZUNA_APP_ID,
        "app_key": ADZUNA_APP_KEY,
        "results_per_page": 20,
        "what": query if query else "internship"
    }

    if location and location != "any":
        params["where"] = location
    if category and category != "all":
        params["what_and"] = category
    
    try:
        response = requests.get(ADZUNA_BASE_URL, params=params)
        response.raise_for_status()
        data = response.json()
        
        formatted_jobs = []
        for job in data.get("results", []):
            salary_min = job.get("salary_min", 0)
            if job.get("salary_is_predicted") and salary_min:
                monthly_salary = int(salary_min / 12)
                reward = f"₹{monthly_salary}/month"
            else:
                reward = "Unpaid / Depends"

            formatted_jobs.append({
                "id": job.get("id"),
                "title": job.get("title", "").replace("<strong>", "").replace("</strong>", ""),
                "company": job.get("company", {}).get("display_name", "Unknown Company"),
                "location": job.get("location", {}).get("display_name", "Remote / Hybrid"),
                "deadline": "Apply Soon",
                "reward": reward,
                "eligibility": job.get("category", {}).get("label", "General Students"),
                "status": "Open",
                "applyLink": job.get("redirect_url", "#")
            })
            
        return jsonify({"status": "success", "data": formatted_jobs})
        
    except Exception as e:
        print(f"Error fetching from Adzuna: {e}")
        return jsonify({
            "status": "error",
            "message": "Failed to fetch real data. Showing mock data.",
            "data": get_mock_internships(query, location, category)
        })

def get_mock_internships(query="", location="", category=""):
    mock_data = [
        {
            "id": "mock1",
            "title": "Software Engineering Intern",
            "company": "TechNova Corp",
            "location": "Bangalore (Remote)",
            "deadline": "Apply by May 30",
            "reward": "₹25000/month",
            "eligibility": "B.Tech/B.S. in CS, 3rd Year",
            "status": "Open",
            "applyLink": "#"
        },
        {
            "id": "mock2",
            "title": "Product Design Intern",
            "company": "CreativeMinds",
            "location": "Hyderabad",
            "deadline": "Apply by June 15",
            "reward": "₹20000/month",
            "eligibility": "Design Students, Portfolio required",
            "status": "Closing Soon",
            "applyLink": "#"
        },
        {
            "id": "mock3",
            "title": "Data Science Intern",
            "company": "DataHub Analytics",
            "location": "Remote",
            "deadline": "Rolling Basis",
            "reward": "₹30000/month",
            "eligibility": "Python, ML basics",
            "status": "Open",
            "applyLink": "#"
        }
    ]
    
    if query:
        mock_data = [d for d in mock_data if query.lower() in d["title"].lower() or query.lower() in d["company"].lower()]
    if location and location != "any":
        mock_data = [d for d in mock_data if location.lower() in d["location"].lower()]
    if category and category != "all":
        mock_data = [d for d in mock_data if category.lower() in d["eligibility"].lower()]
        
    return mock_data

if __name__ == "__main__":
    app.run(debug=True, port=5000)