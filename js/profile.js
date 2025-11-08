import { auth, db, storage } from './firebase-config.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

// Bio counter
document.getElementById('bioInput').addEventListener('input', (e) => {
    document.getElementById('bioCount').textContent = e.target.value.length;
});

// Set bio from suggestions
window.setBio = function(text) {
    document.getElementById('bioInput').value = text;
    document.getElementById('bioCount').textContent = text.length;
};

// Preview avatar
let selectedFile = null;

document.getElementById('avatarInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }
        
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('avatarPreview').src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});

// Skip profile
window.skipProfile = function() {
    window.location.href = 'chat.html';
};

// Submit form
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const displayName = document.getElementById('displayNameInput').value.trim();
    const bio = document.getElementById('bioInput').value.trim();
    
    if (!auth.currentUser) {
        alert('Not authenticated');
        return;
    }
    
    try {
        const updateData = {
            displayName: displayName,
            bio: bio,
            profileCompleted: true,
            profileCompletedAt: new Date().toISOString()
        };
        
        // Upload avatar if selected
        if (selectedFile) {
            const storageRef = ref(storage, `avatars/${auth.currentUser.uid}`);
            await uploadBytes(storageRef, selectedFile);
            const photoURL = await getDownloadURL(storageRef);
            updateData.photoURL = photoURL;
        }
        
        await updateDoc(doc(db, 'users', auth.currentUser.uid), updateData);
        
        window.location.href = 'chat.html';
    } catch (error) {
        console.error('Error updating profile:', error);
        alert('Error updating profile. Please try again.');
    }
});