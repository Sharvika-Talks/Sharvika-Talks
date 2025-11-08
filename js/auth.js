import { auth, db } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { 
    doc, 
    setDoc, 
    getDoc 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Show message
function showMessage(message, type = 'error') {
    const messageBox = document.getElementById('messageBox');
    messageBox.className = `mt-4 p-4 rounded-2xl shadow-lg ${
        type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
    }`;
    messageBox.textContent = message;
    messageBox.classList.remove('hidden');
    setTimeout(() => messageBox.classList.add('hidden'), 5000);
}

// Check auth state
onAuthStateChanged(auth, async (user) => {
    const currentPage = window.location.pathname;
    
    if (user) {
        // User is signed in
        if (currentPage.includes('index.html') || currentPage === '/') {
            // Check if user has completed setup
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().username) {
                window.location.href = 'chat.html';
            } else {
                window.location.href = 'username-setup.html';
            }
        }
    } else {
        // User is signed out
        if (currentPage.includes('chat.html') || currentPage.includes('username-setup.html') || currentPage.includes('profile-setup.html')) {
            window.location.href = 'index.html';
        }
    }
});

// Login
document.getElementById('loginFormElement')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        // Redirect will be handled by onAuthStateChanged
    } catch (error) {
        console.error('Login error:', error);
        if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
            showMessage('Invalid email or password');
        } else if (error.code === 'auth/too-many-requests') {
            showMessage('Too many failed attempts. Please try again later.');
        } else {
            showMessage('An error occurred. Please try again.');
        }
    }
});

// Signup
document.getElementById('signupFormElement')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile in Firestore
        await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=007AFF&color=fff&size=200`,
            createdAt: new Date().toISOString(),
            online: false,
            lastSeen: new Date().toISOString()
        });

        // Redirect to username setup
        window.location.href = 'username-setup.html';
    } catch (error) {
        console.error('Signup error:', error);
        if (error.code === 'auth/email-already-in-use') {
            showMessage('Email is already registered');
        } else if (error.code === 'auth/weak-password') {
            showMessage('Password should be at least 6 characters');
        } else if (error.code === 'auth/invalid-email') {
            showMessage('Invalid email address');
        } else {
            showMessage('An error occurred. Please try again.');
        }
    }
});

// Export logout function
export async function logout() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
}

window.logout = logout;