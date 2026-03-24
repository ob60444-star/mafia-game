import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, arrayUnion, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB2W_c3ZXLMhOdeXYkeVwJ_Rg__zAKDyiE",
  authDomain: "mafia-game-3c358.firebaseapp.com",
  projectId: "mafia-game-3c358",
  storageBucket: "mafia-game-3c358.firebasestorage.app",
  messagingSenderId: "468841815233",
  appId: "1:468841815233:web:e31d6cde7034cdd98d0840",
  measurementId: "G-QX2BDDS780"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- تعريف العناصر من HTML ---
const setupSection = document.getElementById('setup-section');
const lobbySection = document.getElementById('lobby-section');
const playersListUI = document.getElementById('playersList');
const displayRoomCode = document.getElementById('displayRoomCode');

const btnCreate = document.getElementById('createRoomBtn');
const btnJoin = document.getElementById('joinRoomBtn');
const inputName = document.getElementById('playerName');
const inputRoomCode = document.getElementById('roomCodeInput');

// --- وظيفة إنشاء غرفة جديدة ---
btnCreate.addEventListener('click', async () => {
    const name = inputName.value.trim();
    if (name === "") { alert("اكتب اسمك أولاً!"); return; }

    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();

    try {
        await setDoc(doc(db, "rooms", roomCode), {
            admin: name,
            status: "waiting",
            players: [name],
            createdAt: new Date()
        });

        startListening(roomCode); // ابدأ بمراقبة الغرفة
        showLobby(roomCode);
    } catch (e) { console.error("خطأ بالإنشاء: ", e); }
});

// --- وظيفة الانضمام لغرفة موجودة ---
btnJoin.addEventListener('click', async () => {
    const name = inputName.value.trim();
    const code = inputRoomCode.value.trim();

    if (name === "" || code === "") { alert("دخل اسمك ورمز الغرفة!"); return; }

    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
        // إضافة اللاعب الجديد لمصفوفة اللاعبين في فايربيس
        await updateDoc(roomRef, {
            players: arrayUnion(name)
        });
        
        startListening(code); // ابدأ بمراقبة الغرفة
        showLobby(code);
    } else {
        alert("رمز الغرفة غلط أو مو موجودة!");
    }
});

// --- وظيفة مراقبة الغرفة (لحظياً) ---
// هي الوظيفة بتخلي الأسماء تظهر فوراً عند الكل بس ينضم حدا جديد
function startListening(code) {
    onSnapshot(doc(db, "rooms", code), (doc) => {
        const data = doc.data();
        if (data) {
            playersListUI.innerHTML = ""; // تنظيف القائمة
            data.players.forEach(player => {
                const li = document.createElement('li');
                li.textContent = `👤 ${player}`;
                playersListUI.appendChild(li);
            });

            // إذا دخل 4 لاعبين أو أكتر، فينا نظهر زر البدء للآدمين بس
            if (data.players.length >= 4 && data.admin === inputName.value.trim()) {
                document.getElementById('startGameBtn').style.display = "block";
            }
        }
    });
}

function showLobby(code) {
    setupSection.style.display = "none";
    lobbySection.style.display = "block";
    displayRoomCode.innerText = code;
}
