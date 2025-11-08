import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const firebaseConfig = {
    apiKey: "AIzaSyCpI5q-zjeYcpeH5VWJudp9RY8_YGop6WI",
    authDomain: "sharvika-talks.firebaseapp.com",
    projectId: "sharvika-talks",
    storageBucket: "sharvika-talks.firebasestorage.app",
    messagingSenderId: "137673025726",
    appId: "1:137673025726:web:e9d777ed60fb52da3216ef",
    measurementId: "G-7V316VZVPJ"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);