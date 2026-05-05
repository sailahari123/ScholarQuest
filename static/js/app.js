// DOM Elements
const landingPage = document.getElementById('landing-page');
const dashboardPage = document.getElementById('dashboard-page');
const authTabs = document.querySelectorAll('.auth-tab');
const signupNameField = document.getElementById('signup-name-field');
const signupConfirmField = document.getElementById('signup-confirm-field');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authError = document.getElementById('auth-error');
const dashTabs = document.querySelectorAll('.dash-tab');
const contentArea = document.getElementById('content-area');
const cardTemplate = document.getElementById('card-template');
const loadingSpinner = document.getElementById('loading-spinner');

// Form Inputs
const nameInput = document.getElementById('name-input');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const confirmPasswordInput = document.getElementById('confirm-password-input');

// Internal State
let currentTab = 'scholarships';
let isAuthed = false;
let authMode = 'signin';
let userBookmarks = []; // Store IDs of bookmarked items

// Mock Data for other tabs
const mockScholarships = [
    { id: "s1", title: "Google Women Techmakers", company: "Google", location: "Global", deadline: "April 30", reward: "$10,000", eligibility: "Women in Tech, 2nd Year+", status: "Open" },
    { id: "s2", title: "National Merit Scholarship", company: "NMSC", location: "United States", deadline: "October 10", reward: "Full Tuition", eligibility: "High School Seniors", status: "Open" },
    { id: "s3", title: "Erasmus+ Study Grant", company: "European Union", location: "Europe", deadline: "May 15", reward: "€3,000 / Semester", eligibility: "EU University Students", status: "Closing Soon" }
];

const mockHackathons = [
    { id: "h1", title: "Global AI Hackathon", company: "OpenAI & Microsoft", location: "Remote", deadline: "July 20", reward: "$50,000 Prize Pool", eligibility: "Open to All", status: "Registering" },
    { id: "h2", title: "HackMIT 2026", company: "MIT", location: "Cambridge, MA", deadline: "September 01", reward: "Hardware & Prizes", eligibility: "Undergraduates", status: "Upcoming" }
];

// On Load - Check Session
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch('/api/me');
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
                isAuthed = true;
                document.getElementById('user-greeting').textContent = `Hi, ${data.user.name.split(' ')[0]}`;
                await fetchBookmarks();
                landingPage.classList.remove('active');
                dashboardPage.classList.add('active');
                loadData(currentTab);
            }
        }
    } catch(e) {}
});

// Auth Logic
authTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        authTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        authMode = tab.dataset.tab;
        authError.style.display = 'none';

        if (authMode === 'signup') {
            signupNameField.style.animation = 'fadeIn 0.3s ease forwards';
            signupNameField.style.display = 'block';
            signupConfirmField.style.animation = 'fadeIn 0.3s ease forwards';
            signupConfirmField.style.display = 'block';
            authSubmitBtn.textContent = 'Create Account';
            nameInput.required = true;
            confirmPasswordInput.required = true;
        } else {
            signupNameField.style.display = 'none';
            signupConfirmField.style.display = 'none';
            authSubmitBtn.textContent = 'Sign In';
            nameInput.required = false;
            confirmPasswordInput.required = false;
        }
    });
});

async function submitAuth() {
    authError.style.display = 'none';
    
    const email = emailInput.value;
    const password = passwordInput.value;
    
    if (authMode === 'signup') {
        const name = nameInput.value;
        const confirm = confirmPasswordInput.value;
        
        if (password !== confirm) {
            authError.textContent = "Passwords do not match!";
            authError.style.display = 'block';
            return;
        }
        
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });
            const data = await res.json();
            if (res.ok) handleAuthSuccess(data);
            else throw new Error(data.message);
        } catch (e) {
            authError.textContent = e.message;
            authError.style.display = 'block';
        }
    } else {
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            const data = await res.json();
            if (res.ok) handleAuthSuccess(data);
            else throw new Error(data.message);
        } catch (e) {
            authError.textContent = e.message;
            authError.style.display = 'block';
        }
    }
}

async function handleAuthSuccess(data) {
    isAuthed = true;
    document.getElementById('user-greeting').textContent = `Hi, ${data.user.name.split(' ')[0]}`;
    await fetchBookmarks();
    
    // Switch Views
    landingPage.classList.remove('active');
    setTimeout(() => {
        dashboardPage.classList.add('active');
        loadData(currentTab);
    }, 300);
}

async function logout() {
    try { await fetch('/api/logout', { method: 'POST' }); } catch(e) {}
    isAuthed = false;
    userBookmarks = [];
    dashboardPage.classList.remove('active');
    setTimeout(() => {
        landingPage.classList.add('active');
    }, 300);
}

// Bookmarks Fetch
async function fetchBookmarks() {
    try {
        const res = await fetch('/api/bookmarks');
        if(res.ok) {
            const data = await res.json();
            userBookmarks = data.data || [];
        }
    } catch(e) {}
}

async function toggleBookmarkState(oppId, oppType, iconUi, btnUi) {
    try {
        const res = await fetch('/api/bookmarks/toggle', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ opp_id: String(oppId), type: oppType })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.action === "added") {
                userBookmarks.push(String(oppId));
                iconUi.classList.remove('fa-regular');
                iconUi.classList.add('fa-solid');
                btnUi.classList.add('bookmarked');
            } else {
                userBookmarks = userBookmarks.filter(id => id !== String(oppId));
                iconUi.classList.remove('fa-solid');
                iconUi.classList.add('fa-regular');
                btnUi.classList.remove('bookmarked');
            }
        }
    } catch(e) { console.error("Bookmark toggle failed"); }
}

// Dashboard Tab Logic
dashTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        dashTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentTab = tab.dataset.target;
        loadData(currentTab);
    });
});

// Filter Listeners
const searchInput = document.getElementById('global-search');
const filterCategory = document.getElementById('filter-category');
const filterLocation = document.getElementById('filter-location');

[searchInput, filterCategory, filterLocation].forEach(el => {
    if (el) {
        el.addEventListener('change', () => loadData(currentTab));
        if (el.id === 'global-search') {
            el.addEventListener('keyup', (e) => {
                if(e.key === 'Enter') loadData(currentTab);
            });
        }
    }
});

// Data Loading
async function loadData(tab) {
    contentArea.innerHTML = '';
    
    const query = searchInput ? searchInput.value : '';
    const category = filterCategory ? filterCategory.value : '';
    const loc = filterLocation ? filterLocation.value : '';
    
    if (tab === 'scholarships') {
        renderCards(filterLocalData(mockScholarships, query, category, loc), tab);
    } else if (tab === 'hackathons') {
        renderCards(filterLocalData(mockHackathons, query, category, loc), tab);
    } else if (tab === 'internships') {
        loadingSpinner.style.display = 'flex';
        try {
            const params = new URLSearchParams();
            if (query) params.append('q', query);
            if (category) params.append('category', category);
            if (loc) params.append('location', loc);
            
            const res = await fetch(`/api/internships?${params.toString()}`);
            const result = await res.json();
            
            loadingSpinner.style.display = 'none';
            if (result.data && result.data.length > 0) {
                renderCards(result.data, tab);
            } else {
                contentArea.innerHTML = '<div class="empty-state">No internships found for these filters.</div>';
            }
        } catch (error) {
            loadingSpinner.style.display = 'none';
            console.error(error);
            contentArea.innerHTML = '<div class="empty-state error">Failed to load internships. Are you offline?</div>';
        }
    }
}

// Local mock data filter
function filterLocalData(data, query, category, loc) {
    return data.filter(item => {
        const matchesQuery = !query || item.title.toLowerCase().includes(query.toLowerCase()) || item.company.toLowerCase().includes(query.toLowerCase());
        const matchesCat = !category || item.eligibility.toLowerCase().includes(category.toLowerCase());
        const matchesLoc = !loc || item.location.toLowerCase().includes(loc.toLowerCase());
        return matchesQuery && matchesCat && matchesLoc;
    });
}

// Card Renderer
function renderCards(items, type) {
    items.forEach(item => {
        const clone = cardTemplate.content.cloneNode(true);
        
        clone.querySelector('.card-title').textContent = item.title;
        clone.querySelector('.card-company').textContent = item.company;
        clone.querySelector('.loc-text').textContent = item.location;
        clone.querySelector('.deadline-text').textContent = item.deadline;
        clone.querySelector('.reward-text').textContent = item.reward || 'Unpaid / General';
        clone.querySelector('.eligibility-text').textContent = item.eligibility;
        
        const statusTag = clone.querySelector('.status-tag');
        statusTag.textContent = item.status;
        if (item.status.toLowerCase().includes('closing')) {
            statusTag.classList.add('warning');
        } else if (item.status.toLowerCase().includes('upcoming')) {
            statusTag.classList.add('info');
        }
        
        const applyBtn = clone.querySelector('.apply-now-btn');
        if (item.applyLink && item.applyLink !== '#') {
            applyBtn.href = item.applyLink;
            applyBtn.target = "_blank";
        } else {
            applyBtn.href = "#";
            applyBtn.removeAttribute("target");
            applyBtn.addEventListener("click", (e) => {
                e.preventDefault();
                alert("This is a mock opportunity! Please add your Adzuna API keys in the .env file to apply for real internships.");
            });
        }

        // Bookmark Logic
        const bookmarkBtn = clone.querySelector('.bookmark-btn');
        const bookmarkIcon = bookmarkBtn.querySelector('i');
        
        // Restore Visual State
        if (userBookmarks.includes(String(item.id))) {
            bookmarkIcon.classList.remove('fa-regular');
            bookmarkIcon.classList.add('fa-solid');
            bookmarkBtn.classList.add('bookmarked');
        }

        bookmarkBtn.addEventListener('click', () => {
            toggleBookmarkState(item.id, type, bookmarkIcon, bookmarkBtn);
        });

        contentArea.appendChild(clone);
    });
}
