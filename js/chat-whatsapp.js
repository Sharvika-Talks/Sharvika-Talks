import { auth, db } from './firebase-config.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    onSnapshot,
    updateDoc,
    addDoc,
    serverTimestamp,
    limit
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let currentUser = null;
let currentChatUser = null;
let messagesUnsubscribe = null;
let conversationsUnsubscribe = null;
let allUsers = []; // Store all users for search

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    console.log('User logged in:', currentUser.email);
    
    await loadConversations();
    setupSearchListener();
    updateOnlineStatus(true);
    
    // Update status when user leaves
    window.addEventListener('beforeunload', () => {
        updateOnlineStatus(false);
    });
});

// Update online status
async function updateOnlineStatus(online) {
    if (!currentUser) return;
    
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            online: online,
            lastSeen: new Date().toISOString()
        });
        console.log('Online status updated:', online);
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// Setup search listener
function setupSearchListener() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearSearch');
    
    if (!searchInput) return;
    
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.trim().toLowerCase();
        
        // Show/hide clear button
        if (searchTerm) {
            clearButton.classList.remove('hidden');
        } else {
            clearButton.classList.add('hidden');
        }
        
        filterUsers(searchTerm);
    });
    
    // Clear on escape key
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            clearSearch();
        }
    });
}

// Filter users based on search term
function filterUsers(searchTerm) {
    const usersList = document.getElementById('conversationsList');
    
    if (!searchTerm) {
        // Show all users
        displayUsers(allUsers);
        return;
    }
    
    // Filter users by username, name, or email
    const filteredUsers = allUsers.filter(user => {
        const username = (user.username || '').toLowerCase();
        const name = (user.displayName || user.name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        
        return username.includes(searchTerm) || 
               name.includes(searchTerm) || 
               email.includes(searchTerm);
    });
    
    console.log(`Search: "${searchTerm}" - Found ${filteredUsers.length} users`);
    displayUsers(filteredUsers);
}

// Display users in the list
function displayUsers(users) {
    const usersList = document.getElementById('conversationsList');
    usersList.innerHTML = '';
    
    if (users.length === 0) {
        usersList.innerHTML = `
            <div class="text-center py-8 px-4">
                <i class="fas fa-user-slash text-gray-300 text-4xl mb-3"></i>
                <p class="text-gray-600 font-semibold">No users found</p>
                <p class="text-gray-500 text-sm mt-2">Try a different search term</p>
            </div>
        `;
        return;
    }
    
    users.forEach(userData => {
        const userElement = createUserElement(userData);
        usersList.appendChild(userElement);
    });
}

// Clear search
function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const clearButton = document.getElementById('clearSearch');
    
    searchInput.value = '';
    clearButton.classList.add('hidden');
    filterUsers('');
    searchInput.focus();
}

// Load conversations
async function loadConversations() {
    const usersRef = collection(db, 'users');
    const loadingUsers = document.getElementById('loadingUsers');
    
    conversationsUnsubscribe = onSnapshot(usersRef, (snapshot) => {
        const usersList = document.getElementById('conversationsList');
        
        loadingUsers?.classList.add('hidden');
        allUsers = []; // Reset users array
        
        snapshot.forEach((docSnapshot) => {
            const userData = docSnapshot.data();
            // Don't show current user in the list
            if (userData.uid !== currentUser.uid && userData.username) {
                allUsers.push(userData);
            }
        });
        
        // Sort users: online first, then by name
        allUsers.sort((a, b) => {
            // Online users first
            if (a.online && !b.online) return -1;
            if (!a.online && b.online) return 1;
            
            // Then sort alphabetically by name
            const nameA = (a.displayName || a.name || '').toLowerCase();
            const nameB = (b.displayName || b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        console.log('Loaded users:', allUsers.length);
        
        // Display all users initially
        displayUsers(allUsers);
    }, (error) => {
        console.error('Error loading users:', error);
        loadingUsers.innerHTML = `
            <div class="text-center py-8 px-4">
                <i class="fas fa-exclamation-triangle text-red-400 text-3xl mb-3"></i>
                <p class="text-red-600">Error loading users</p>
                <p class="text-gray-500 text-sm mt-2">${error.message}</p>
            </div>
        `;
    });
}

// Create user element
function createUserElement(userData) {
    const div = document.createElement('div');
    div.className = 'user-item flex items-center p-3 border-b border-gray-100';
    div.onclick = () => openChat(userData);
    
    const username = userData.username ? `@${userData.username}` : '';
    const bio = userData.bio || 'Available';
    const photoURL = userData.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userData.displayName || userData.name || 'User');
    
    div.innerHTML = `
        <div class="relative mr-3 flex-shrink-0">
            <img src="${photoURL}" alt="${userData.displayName || userData.name}" class="w-12 h-12 rounded-full object-cover bg-gray-200">
            ${userData.online ? '<div class="online-indicator"></div>' : ''}
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline mb-1">
                <h3 class="font-semibold text-gray-900 truncate">${userData.displayName || userData.name || 'User'}</h3>
                ${userData.online ? '<span class="text-xs text-green-600 flex-shrink-0 ml-2 font-medium">Online</span>' : ''}
            </div>
            <p class="text-sm text-gray-500 truncate">${username}</p>
            <p class="text-xs text-gray-400 truncate mt-0.5">${bio}</p>
        </div>
    `;
    
    return div;
}

// Open chat with user
async function openChat(userData) {
    currentChatUser = userData;
    console.log('Opening chat with:', userData.username);
    
    // Clear search when opening chat
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value) {
        clearSearch();
    }
    
    // Remove active class from all users
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to selected user
    event.currentTarget?.classList.add('active');
    
    // Mobile: Hide chat list, show chat
    const chatsList = document.getElementById('chatsList');
    const chatArea = document.getElementById('chatArea');
    const welcomeScreen = document.getElementById('welcomeScreen');
    const chatScreen = document.getElementById('chatScreen');
    
    // Hide chat list on mobile
    if (window.innerWidth < 768) {
        chatsList.classList.add('hidden');
    }
    
    // Show chat area
    chatArea.classList.remove('hidden');
    chatArea.classList.add('flex');
    welcomeScreen.classList.add('hidden');
    chatScreen.classList.remove('hidden');
    chatScreen.classList.add('flex');
    
    // Update header
    const photoURL = userData.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userData.displayName || userData.name || 'User');
    
    document.getElementById('chatUsername').textContent = userData.displayName || userData.name || 'User';
    document.getElementById('chatAvatar').src = photoURL;
    
    if (userData.online) {
        document.getElementById('chatStatus').textContent = 'online';
        document.getElementById('chatOnlineDot').classList.remove('hidden');
    } else {
        const lastSeenText = userData.lastSeen ? formatTime(userData.lastSeen) : 'recently';
        document.getElementById('chatStatus').textContent = `last seen ${lastSeenText}`;
        document.getElementById('chatOnlineDot').classList.add('hidden');
    }
    
    // Load messages
    loadMessages();
}

// Load messages
function loadMessages() {
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }
    
    const chatId = getChatId(currentUser.uid, currentChatUser.uid);
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));
    
    console.log('Loading messages for chat:', chatId);
    
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        const messagesList = document.getElementById('messagesList');
        messagesList.innerHTML = '';
        
        if (snapshot.empty) {
            messagesList.innerHTML = `
                <div class="text-center py-8">
                    <i class="fas fa-comments text-gray-300 text-4xl mb-3"></i>
                    <p class="text-gray-500">No messages yet</p>
                    <p class="text-gray-400 text-sm mt-2">Start the conversation!</p>
                </div>
            `;
        }
        
        let lastDate = null;
        
        snapshot.forEach((docSnapshot) => {
            const messageData = docSnapshot.data();
            
            // Add date divider
            const messageDate = formatDate(messageData.timestamp);
            if (messageDate !== lastDate) {
                const dateDiv = document.createElement('div');
                dateDiv.className = 'flex justify-center my-4';
                dateDiv.innerHTML = `
                    <span class="bg-white/90 text-gray-600 text-xs px-3 py-1 rounded-lg shadow-sm font-medium">
                        ${messageDate}
                    </span>
                `;
                messagesList.appendChild(dateDiv);
                lastDate = messageDate;
            }
            
            const messageElement = createMessageElement(messageData);
            messagesList.appendChild(messageElement);
        });
        
        // Scroll to bottom smoothly
        setTimeout(() => {
            const messagesArea = document.getElementById('messagesArea');
            messagesArea.scrollTo({
                top: messagesArea.scrollHeight,
                behavior: 'smooth'
            });
        }, 100);
    }, (error) => {
        console.error('Error loading messages:', error);
    });
}

// Create message element
function createMessageElement(messageData) {
    const div = document.createElement('div');
    const isSent = messageData.senderId === currentUser.uid;
    
    div.className = `flex ${isSent ? 'justify-end' : 'justify-start'}`;
    
    const bubbleClass = isSent ? 'message-sent message-tail-sent' : 'message-received message-tail-received';
    
    div.innerHTML = `
        <div class="${bubbleClass} p-2 shadow-sm">
            <p class="text-sm text-gray-800 break-words whitespace-pre-wrap">${escapeHtml(messageData.text)}</p>
            <div class="flex items-center justify-end mt-1 space-x-1">
                <span class="text-xs text-gray-600">${formatTime(messageData.timestamp)}</span>
                ${isSent ? `<i class="fas fa-check-double text-xs ${messageData.read ? 'text-blue-500' : 'text-gray-400'}"></i>` : ''}
            </div>
        </div>
    `;
    
    return div;
}

// Send message
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const messageText = messageInput.value.trim();
    
    if (!messageText || !currentChatUser) {
        console.log('Cannot send: empty message or no chat user');
        return;
    }
    
    const chatId = getChatId(currentUser.uid, currentChatUser.uid);
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    
    try {
        console.log('Sending message to:', currentChatUser.username);
        
        await addDoc(messagesRef, {
            senderId: currentUser.uid,
            receiverId: currentChatUser.uid,
            text: messageText,
            timestamp: serverTimestamp(),
            read: false
        });
        
        // Update chat metadata
        await setDoc(doc(db, 'chats', chatId), {
            participants: [currentUser.uid, currentChatUser.uid],
            lastMessage: messageText,
            lastMessageTime: serverTimestamp(),
            lastMessageSender: currentUser.uid
        }, { merge: true });
        
        // Clear input
        messageInput.value = '';
        messageInput.style.height = 'auto';
        messageInput.focus();
        
        console.log('Message sent successfully');
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message. Please try again.');
    }
}

// Handle key press
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Auto resize textarea
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 96) + 'px';
}

// Get chat ID (consistent ordering)
function getChatId(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// Format time
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit', 
            hour12: true 
        });
    } catch (error) {
        return '';
    }
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'TODAY';
    
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (date.toDateString() === today.toDateString()) {
            return 'TODAY';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'YESTERDAY';
        } else {
            return date.toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric' 
            });
        }
    } catch (error) {
        return 'TODAY';
    }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Close chat on mobile
function closeChatMobile() {
    const chatsList = document.getElementById('chatsList');
    const chatArea = document.getElementById('chatArea');
    
    chatsList.classList.remove('hidden');
    chatArea.classList.add('hidden');
    
    currentChatUser = null;
    
    if (messagesUnsubscribe) {
        messagesUnsubscribe();
    }
    
    // Remove active class
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
}

// Menu functions
function openMenu() {
    document.getElementById('menuModal').classList.remove('hidden');
}

function closeMenu() {
    document.getElementById('menuModal').classList.add('hidden');
}

// Profile functions
async function openProfile() {
    closeMenu();
    
    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            const photoURL = userData.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userData.displayName || userData.name || 'User');
            
            document.getElementById('profileAvatar').src = photoURL;
            document.getElementById('profileName').textContent = userData.displayName || userData.name || 'User';
            document.getElementById('profileUsername').textContent = '@' + (userData.username || '');
            document.getElementById('profileEmail').textContent = userData.email || '';
            document.getElementById('profileBio').textContent = userData.bio || 'No bio yet';
            
            document.getElementById('profileModal').classList.remove('hidden');
            document.getElementById('profileModal').classList.add('flex');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        alert('Failed to load profile');
    }
}

function closeProfile() {
    document.getElementById('profileModal').classList.add('hidden');
    document.getElementById('profileModal').classList.remove('flex');
}

// Chat info functions
function openChatInfo() {
    if (!currentChatUser) return;
    
    const photoURL = currentChatUser.photoURL || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(currentChatUser.displayName || currentChatUser.name || 'User');
    
    document.getElementById('infoAvatar').src = photoURL;
    document.getElementById('infoName').textContent = currentChatUser.displayName || currentChatUser.name || 'User';
    document.getElementById('infoUsername').textContent = '@' + (currentChatUser.username || '');
    document.getElementById('infoBio').textContent = currentChatUser.bio || 'No bio';
    
    const statusText = currentChatUser.online 
        ? 'Online' 
        : `Last seen ${currentChatUser.lastSeen ? formatTime(currentChatUser.lastSeen) : 'recently'}`;
    document.getElementById('infoStatus').textContent = statusText;
    
    document.getElementById('chatInfoModal').classList.remove('hidden');
    document.getElementById('chatInfoModal').classList.add('flex');
}

function closeChatInfo() {
    document.getElementById('chatInfoModal').classList.add('hidden');
    document.getElementById('chatInfoModal').classList.remove('flex');
}

// Call functions
function startVideoCall() {
    if (!currentChatUser) return;
    
    localStorage.setItem('callUserId', currentChatUser.uid);
    localStorage.setItem('callUsername', currentChatUser.displayName || currentChatUser.name || 'User');
    localStorage.setItem('callType', 'video');
    
    window.open('call.html', '_blank');
}

function startVoiceCall() {
    if (!currentChatUser) return;
    
    localStorage.setItem('callUserId', currentChatUser.uid);
    localStorage.setItem('callUsername', currentChatUser.displayName || currentChatUser.name || 'User');
    localStorage.setItem('callType', 'audio');
    
    window.open('call.html', '_blank');
}

// Other functions
function openNewChat() {
    const searchInput = document.getElementById('searchInput');
    searchInput.focus();
}

function openSettings() {
    closeMenu();
    alert('Settings coming soon! 🔧');
}

function openChatMenu() {
    alert('Chat options coming soon! ⚙️');
}

function toggleEmojiPicker() {
    alert('Emoji picker coming soon! 😊');
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        alert(`File upload coming soon!\nSelected: ${file.name} 📎`);
    }
}

// Logout
async function logout() {
    if (!confirm('Are you sure you want to log out?')) return;
    
    try {
        await updateOnlineStatus(false);
        await signOut(auth);
        console.log('User logged out');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error logging out:', error);
        alert('Failed to log out. Please try again.');
    }
}

// Make functions global
window.sendMessage = sendMessage;
window.handleKeyPress = handleKeyPress;
window.autoResize = autoResize;
window.closeChatMobile = closeChatMobile;
window.openMenu = openMenu;
window.closeMenu = closeMenu;
window.openProfile = openProfile;
window.closeProfile = closeProfile;
window.openChatInfo = openChatInfo;
window.closeChatInfo = closeChatInfo;
window.startVideoCall = startVideoCall;
window.startVoiceCall = startVoiceCall;
window.openNewChat = openNewChat;
window.openSettings = openSettings;
window.openChatMenu = openChatMenu;
window.toggleEmojiPicker = toggleEmojiPicker;
window.handleFileUpload = handleFileUpload;
window.logout = logout;
window.clearSearch = clearSearch;

// Handle screen resize
window.addEventListener('resize', () => {
    const chatsList = document.getElementById('chatsList');
    const chatArea = document.getElementById('chatArea');
    
    if (window.innerWidth >= 768) {
        chatsList.classList.remove('hidden');
        if (currentChatUser) {
            chatArea.classList.remove('hidden');
            chatArea.classList.add('flex');
        }
    }
});

// Log when script loads
console.log('Chat application initialized');