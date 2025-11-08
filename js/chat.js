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
    await loadCurrentUserProfile();
    await loadConversations();
    updateOnlineStatus(true);
    
    window.addEventListener('beforeunload', () => {
        updateOnlineStatus(false);
    });
});

// Load current user profile
async function loadCurrentUserProfile() {
    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    if (userDoc.exists()) {
        const userData = userDoc.data();
        document.getElementById('sidebarName').textContent = userData.displayName || userData.name;
        document.getElementById('sidebarAvatar').src = userData.photoURL;
    }
}

// Update online status
async function updateOnlineStatus(online) {
    if (!currentUser) return;
    
    await updateDoc(doc(db, 'users', currentUser.uid), {
        online: online,
        lastSeen: new Date().toISOString()
    });
}

// Load conversations
async function loadConversations() {
    const usersRef = collection(db, 'users');
    
    conversationsUnsubscribe = onSnapshot(usersRef, (snapshot) => {
        const usersList = document.getElementById('conversationsList');
        usersList.innerHTML = '';
        
        snapshot.forEach((docSnapshot) => {
            const userData = docSnapshot.data();
            if (userData.uid !== currentUser.uid && userData.username) {
                const userElement = createUserElement(userData);
                usersList.appendChild(userElement);
            }
        });
    });
}

// Create user element
function createUserElement(userData) {
    const div = document.createElement('div');
    div.className = 'chat-row px-4 py-3 cursor-pointer border-b border-gray-100 transition';
    div.onclick = () => openChat(userData);
    
    div.innerHTML = `
        <div class="flex items-start space-x-3">
            <div class="relative flex-shrink-0">
                <img src="${userData.photoURL}" class="w-14 h-14 rounded-full">
                ${userData.online ? '<div class="online-dot"></div>' : ''}
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline mb-1">
                    <h3 class="font-semibold text-gray-900 truncate">${userData.displayName || userData.name}</h3>
                    <span class="text-xs text-gray-500">2m</span>
                </div>
                <p class="text-sm text-gray-600 truncate">${userData.bio || 'Available'}</p>
            </div>
        </div>
    `;
    
    return div;
}

// Open chat with user
async function openChat(userData) {
    currentChatUser = userData;
    
    // Update UI
    document.getElementById('welcomeScreen').classList.add('hidden');
    document.getElementById('chatScreen').classList.remove('hidden');
    document.getElementById('chatScreen').classList.add('flex');
    
    document.getElementById('chatUsername').textContent = userData.displayName || userData.name;
    document.getElementById('chatAvatar').src = userData.photoURL;
    
    if (userData.online) {
        document.getElementById('chatStatus').textContent = 'Online';
        document.getElementById('chatOnlineDot').classList.remove('hidden');
    } else {
        document.getElementById('chatStatus').textContent = `Last seen ${formatTime(userData.lastSeen)}`;
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
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(50));
    
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
                dateDiv.innerHTML = `<span class="text-xs text-gray-500">${messageDate}</span>`;
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
    
    const bubbleClass = isSent ? 'message-blue' : 'message-gray';
    const textClass = isSent ? 'text-white' : 'text-gray-900';
    
    div.innerHTML = `
        <div class="${bubbleClass} px-4 py-2 max-w-[65%]">
            <p class="${textClass} text-sm break-words">${escapeHtml(messageData.text)}</p>
            <div class="flex items-center justify-end space-x-1 mt-1">
                <span class="text-xs ${isSent ? 'text-white/70' : 'text-gray-500'}">${formatTime(messageData.timestamp)}</span>
                ${isSent ? `<i class="fas fa-check-double text-xs ${messageData.read ? 'text-blue-300' : 'text-white/70'}"></i>` : ''}
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
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

// Handle message key press
function handleMessageKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
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
    if (!timestamp) return 'Today';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
        return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Profile Modal
function openProfile() {
    getDoc(doc(db, 'users', currentUser.uid)).then((docSnapshot) => {
        const userData = docSnapshot.data();
        document.getElementById('profileAvatar').src = userData.photoURL;
        document.getElementById('profileName').textContent = userData.displayName || userData.name;
        document.getElementById('profileUsername').textContent = '@' + (userData.username || '');
        document.getElementById('profileBio').textContent = userData.bio || 'No bio yet';
        document.getElementById('profileModal').classList.remove('hidden');
        document.getElementById('profileModal').classList.add('flex');
    });
}

function closeProfile() {
    document.getElementById('profileModal').classList.add('hidden');
    document.getElementById('profileModal').classList.remove('flex');
}

// Close chat on mobile
function closeChatMobile() {
    document.getElementById('chatScreen').classList.add('hidden');
    document.getElementById('welcomeScreen').classList.remove('hidden');
}

// Start video call
function startVideoCall() {
    if (!currentChatUser) return;
    localStorage.setItem('callUserId', currentChatUser.uid);
    localStorage.setItem('callUsername', currentChatUser.displayName || currentChatUser.name);
    localStorage.setItem('callType', 'video');
    window.open('call.html', '_blank');
}

// Start voice call
function startVoiceCall() {
    if (!currentChatUser) return;
    localStorage.setItem('callUserId', currentChatUser.uid);
    localStorage.setItem('callUsername', currentChatUser.displayName || currentChatUser.name);
    localStorage.setItem('callType', 'audio');
    window.open('call.html', '_blank');
}

// Logout
async function logout() {
    await updateOnlineStatus(false);
    await signOut(auth);
    window.location.href = 'index.html';
}

// New chat
function openNewChat() {
    alert('New chat feature coming soon');
}

// Make functions global
window.sendMessage = sendMessage;
window.handleMessageKeyPress = handleMessageKeyPress;
window.openProfile = openProfile;
window.closeProfile = closeProfile;
window.closeChatMobile = closeChatMobile;
window.startVideoCall = startVideoCall;
window.startVoiceCall = startVoiceCall;
window.logout = logout;
window.openNewChat = openNewChat;