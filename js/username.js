import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc, collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let checkTimeout;
let isAvailable = false;
let currentUsername = '';

const input = document.getElementById('usernameInput');
const statusIcon = document.getElementById('statusIcon');
const usernameStatus = document.getElementById('usernameStatus');
const charCount = document.getElementById('charCount');
const continueBtn = document.getElementById('continueBtn');

// Real-time validation
input.addEventListener('input', function(e) {
    let value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    e.target.value = value;
    currentUsername = value;
    
    charCount.textContent = value.length;
    
    clearTimeout(checkTimeout);
    hideAllMessages();
    validateFormat(value);
    
    if (value.length >= 3 && value.length <= 20) {
        document.getElementById('checkingMessage').classList.remove('hidden');
        
        checkTimeout = setTimeout(() => {
            checkAvailability(value);
        }, 800);
    } else {
        statusIcon.classList.add('hidden');
        continueBtn.disabled = true;
    }
});

// Validate format rules
function validateFormat(value) {
    const rule1 = document.getElementById('rule1');
    const rule2 = document.getElementById('rule2');
    const rule3 = document.getElementById('rule3');
    
    if (value.length >= 3 && value.length <= 20) {
        updateRule(rule1, true);
    } else {
        updateRule(rule1, false);
    }
    
    if (value.length > 0 && /^[a-z0-9_]+$/.test(value)) {
        updateRule(rule2, true);
        updateRule(rule3, true);
    } else if (value.length > 0) {
        updateRule(rule2, false);
        updateRule(rule3, false);
    } else {
        updateRule(rule2, null);
        updateRule(rule3, null);
    }
}

function updateRule(element, isValid) {
    const icon = element.querySelector('i');
    
    if (isValid === true) {
        icon.className = 'fas fa-check-circle text-xs mr-3 text-green-500';
        element.className = 'flex items-center text-green-600 transition-colors';
    } else if (isValid === false) {
        icon.className = 'fas fa-times-circle text-xs mr-3 text-red-500';
        element.className = 'flex items-center text-red-600 transition-colors';
    } else {
        icon.className = 'fas fa-circle text-xs mr-3 text-gray-300';
        element.className = 'flex items-center text-gray-600 transition-colors';
    }
}

// Check availability
async function checkAvailability(username) {
    try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('username', '==', username));
        const snapshot = await getDocs(q);
        
        hideAllMessages();
        
        if (snapshot.empty) {
            showAvailable();
        } else {
            showTaken(username);
        }
    } catch (error) {
        console.error('Error checking username:', error);
        hideAllMessages();
        usernameStatus.innerHTML = '<span class="text-red-600"><i class="fas fa-exclamation-triangle mr-1"></i>Error</span>';
    }
}

function showAvailable() {
    isAvailable = true;
    document.getElementById('availableMessage').classList.remove('hidden');
    
    statusIcon.innerHTML = '<i class="fas fa-check-circle text-green-500 text-3xl check-icon"></i>';
    statusIcon.classList.remove('hidden');
    
    usernameStatus.innerHTML = '<span class="text-green-600"><i class="fas fa-check mr-1"></i>Available</span>';
    
    updateRule(document.getElementById('rule4'), true);
    
    continueBtn.disabled = false;
    
    document.getElementById('suggestionsContainer').classList.add('hidden');
}

function showTaken(username) {
    isAvailable = false;
    document.getElementById('takenMessage').classList.remove('hidden');
    
    statusIcon.innerHTML = '<i class="fas fa-times-circle text-red-500 text-3xl"></i>';
    statusIcon.classList.remove('hidden');
    
    usernameStatus.innerHTML = '<span class="text-red-600"><i class="fas fa-times mr-1"></i>Taken</span>';
    
    updateRule(document.getElementById('rule4'), false);
    
    continueBtn.disabled = true;
    
    generateSuggestions(username);
}

function hideAllMessages() {
    document.getElementById('checkingMessage').classList.add('hidden');
    document.getElementById('availableMessage').classList.add('hidden');
    document.getElementById('takenMessage').classList.add('hidden');
}

// Generate username suggestions
function generateSuggestions(base) {
    const suggestions = [
        `${base}${Math.floor(Math.random() * 999)}`,
        `${base}_${new Date().getFullYear()}`,
        `the_${base}`,
        `${base}_official`,
        `${base}_${Math.floor(Math.random() * 99)}`,
        `${base}_talks`
    ];
    
    const container = document.getElementById('suggestionsList');
    container.innerHTML = '';
    
    suggestions.forEach(suggestion => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'bg-white hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 border-2 border-gray-200 hover:border-blue-400 px-4 py-3 rounded-xl text-sm font-semibold text-gray-700 hover:text-blue-700 shadow-sm transition';
        chip.innerHTML = `<i class="fas fa-at text-gray-400 mr-1"></i>${suggestion}`;
        chip.onclick = () => {
            input.value = suggestion;
            input.dispatchEvent(new Event('input'));
        };
        container.appendChild(chip);
    });
    
    document.getElementById('suggestionsContainer').classList.remove('hidden');
}

// Form submission
document.getElementById('usernameForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isAvailable && currentUsername && auth.currentUser) {
        try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                username: currentUsername,
                usernameUpdatedAt: new Date().toISOString()
            });
            window.location.href = 'profile-setup.html';
        } catch (error) {
            console.error('Error saving username:', error);
            alert('Error saving username. Please try again.');
        }
    }
});