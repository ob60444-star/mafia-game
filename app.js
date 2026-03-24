window.onload = () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) splash.classList.add('fade-out');
    }, 2000);
};

// تسجيل الـ Service Worker بالطريقة الصح
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW Registered!', reg))
            .catch(err => console.log('SW Registration Failed', err));
    });
}

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB2W_c3ZXLMhOdeXYkeVwJ_Rg__zAKDyiE",
    authDomain: "mafia-game-3c358.firebaseapp.com",
    projectId: "mafia-game-3c358",
    storageBucket: "mafia-game-3c358.firebasestorage.app",
    messagingSenderId: "468841815233",
    appId: "1:468841815233:web:e31d6cde7034cdd98d0840"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ... باقي كودك (دوال الغرف، التصويت، البدء) كما هي تماماً بدون تغيير ...
// (انسخ باقي الدوال من كودك الأصلي وحطها هون)

function showLobby(code) {
    setupSection.style.display = "none";
    lobbySection.style.display = "block";
    displayRoomCode.innerText = code;
}
