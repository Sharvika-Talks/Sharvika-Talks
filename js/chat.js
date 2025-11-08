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

// Check authentication
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    
    currentUser = user;
    await loadConversations();
    updateOnlineStatus(true);
    
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
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

// Load conversations
async function loadConversations() {
    const usersRef = collection(db, 'users');
    
    conversationsUnsubscribe = onSnapshot(usersRef, (snapshot) => {
        const usersList = document.getElementById('conversationsList');
        const loadingUsers = document.getElementById('loadingUsers');
        
        loadingUsers?.classList.add('hidden');
        usersList.innerHTML = '';
        
        let hasUsers = false;
        
        snapshot.forEach((docSnapshot) => {
            const userData = docSnapshot.data();
            if (userData.uid !== currentUser.uid && userData.username) {
                hasUsers = true;
                const userElement = createUserElement(userData);
                usersList.appendChild(userElement);
            }
        });
        
        if (!hasUsers) {
            usersList.innerHTML = `
                <div class="text-center py-8 px-4">
                    <i class="fas fa-users text-gray-300 text-4xl mb-3"></i>
                    <p class="text-gray-600">No users available</p>
                    <p class="text-gray-500 text-sm mt-2">Invite friends to start chatting</p>
                </div>
            `;
        }
    });
}

// Create user element
function createUserElement(userData) {
    const div = document.createElement('div');
    div.className = 'user-item flex items-center p-3 border-b border-gray-100';
    div.onclick = () => openChat(userData);
    
    div.innerHTML = `
        <div class="relative mr-3 flex-shrink-0">
            <img src="${userData.photoURL}" class="w-12 h-12 rounded-full">
            ${userData.online ? '<div class="online-indicator"></div>' : ''}
        </div>
        <div class="flex-1 min-w-0">
            <div class="flex justify-between items-baseline mb-1">
                <h3 class="font-semibold text-gray-900 truncate">${userData.displayName || userData.name}</h3>
                <span class="text-xs text-gray-500 flex-shrink-0 ml-2">Just now</span>
            </div>
            <p class="text-sm text-gray-600 truncate">${userData.bio || 'Available'}</p>
        </div>
    `;
    
    return div;
}

// Open chat with user
async function openChat(userData) {
    currentChatUser = userData;
    
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
    document.getElementById('chatUsername').textContent = userData.displayName || userData.name;
    document.getElementById('chatAvatar').src = userData.photoURL;
    
    if (userData.online) {
        document.getElementById('chatStatus').textContent = 'online';
        document.getElementById('chatOnlineDot').classList.remove('hidden');
    } else {
        document.getElementById('chatStatus').textContent = `last seen ${formatTime(userData.lastSeen)}`;
        document.getElementById('chatOnlineDot').classList.add('hidden');
    }
    
    // Load messages
    loadMessages();
}

// Load messages
function loadMessages() {
    if (messagesUnsubscribe) messagesUnsubscribe();
    
    const chatId = getChatId(currentUser.uid, currentChatUser.uid);
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));
    
    messagesUnsubscribe = onSnapshot(q, (snapshot) => {
        const messagesList = document.getElementById('messagesList');
        messagesList.innerHTML = '';
        
        let lastDate = null;
        
        snapshot.forEach((docSnapshot) => {
            const messageData = docSnapshot.data();
            
            // Add date divider
            const messageDate = formatDate(messageData.timestamp);
            if (messageDate !== lastDate) {
                const dateDiv = document.createElement('div');
                dateDiv.className = 'flex justify-center my-4';
                dateDiv.innerHTML = `
                    <span class="bg-white/90 text-gray-600 text-xs px-3 py-1 rounded-lg shadow-sm">
                        ${messageDate}
                    </span>
                `;
                messagesList.appendChild(dateDiv);
                lastDate = messageDate;
            }
            
            const messageElement = createMessageElement(messageData);
            messagesList.appendChild(messageElement);
        });
        
        // Scroll to bottom
        const messagesArea = document.getElementById('messagesArea');
        messagesArea.scrollTop = messagesArea.scrollHeight;
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
    
    if (!messageText || !currentChatUser) return;
    
    const chatId = getChatId(currentUser.uid, currentChatUser.uid);
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    
    try {
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
        
        messageInput.value = '';
        messageInput.style.height = 'auto';
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

// Get chat ID
function getChatId(uid1, uid2) {
    return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

// Format time
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'TODAY';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'TODAY';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'YESTERDAY';
    } else {
        return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    }
}

// Escape HTML
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
            document.getElementById('profileAvatar').src = userData.photoURL;
            document.getElementById('profileName').textContent = userData.displayName || userData.name;
            document.getElementById('profileUsername').textContent = '@' + (userData.username || '');
            document.getElementById('profileEmail').textContent = userData.email;
            document.getElementById('profileBio').textContent = userData.bio || 'No bio yet';
            document.getElementById('profileModal').classList.remove('hidden');
            document.getElementById('profileModal').classList.add('flex');
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

function closeProfile() {
    document.getElementById('profileModal').classList.add('hidden');
    document.getElementById('profileModal').classList.remove('flex');
}

// Chat info functions
function openChatInfo() {
    if (!currentChatUser) return;
    
    document.getElementById('infoAvatar').src = currentChatUser.photoURL;
    document.getElementById('infoName').textContent = currentChatUser.displayName || currentChatUser.name;
    document.getElementById('infoUsername').textContent = '@' + (currentChatUser.username || '');
    document.getElementById('infoBio').textContent = currentChatUser.bio || 'No bio';
    document.getElementById('infoStatus').textContent = currentChatUser.online ? 'Online' : `Last seen ${formatTime(currentChatUser.lastSeen)}`;
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
    localStorage.setItem('callUsername', currentChatUser.displayName || currentChatUser.name);
    localStorage.setItem('callType', 'video');
    window.open('call.html', '_blank');
}

function startVoiceCall() {
    if (!currentChatUser) return;
    localStorage.setItem('callUserId', currentChatUser.uid);
    localStorage.setItem('callUsername', currentChatUser.displayName || currentChatUser.name);
    localStorage.setItem('callType', 'audio');
    window.open('call.html', '_blank');
}

// Other functions
function openNewChat() {
    alert('Search feature coming soon');
}

function openSettings() {
    closeMenu();
    alert('Settings coming soon');
}

function openChatMenu() {
    alert('Chat options coming soon');
}

function toggleEmojiPicker() {
    alert('Emoji picker coming soon');
}

function handleFileUpload(event) {
    alert('File upload coming soon');
}

// Logout
async function logout() {
    if (!confirm('Are you sure you want to log out?')) return;
    
    await updateOnlineStatus(false);
    await signOut(auth);
    window.location.href = 'index.html';
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