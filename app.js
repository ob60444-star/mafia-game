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
        if (!data) return;

        // تحديث قائمة اللاعبين
        playersListUI.innerHTML = "";
        data.players.forEach(p => {
            const li = document.createElement('li');
            li.textContent = `👤 ${p}`;
            playersListUI.appendChild(li);
        });

        // فحص إذا اللعبة بدأت
        if (data.status === "started") {
            const myName = inputName.value.trim();
            const myRole = data.roles[myName];
            
            // إظهار الدور بجمالية
            lobbySection.innerHTML = `
                <h2 style="color: #ff3366;">بدأت اللعبة!</h2>
                <div style="padding: 20px; background: #333; border-radius: 15px; margin-top: 20px;">
                    <p>أنت الآن بدور:</p>
                    <h1 style="font-size: 3rem;">${myRole}</h1>
                </div>
            `;
        }
    });
}

function showLobby(code) {
    setupSection.style.display = "none";
    lobbySection.style.display = "block";
    displayRoomCode.innerText = code;
}
const btnStart = document.getElementById('startGameBtn');

btnStart.addEventListener('click', async () => {
    const code = displayRoomCode.innerText;
    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);
    const players = roomSnap.data().players;

    if (players.length < 3) {
        alert("لازم يكون في 3 لاعبين على الأقل لنبدأ!");
        return;
    }

    // خلط اللاعبين عشوائياً
    const shuffled = players.sort(() => 0.5 - Math.random());
    
    // توزيع الأدوار (مثال بسيط: أول واحد مافيا، تاني واحد طبيب، الباقي مواطنين)
    const roles = {};
    roles[shuffled[0]] = "مافيا 🕵️‍♂️";
    roles[shuffled[1]] = "طبيب 🩺";
    for (let i = 2; i < shuffled.length; i++) {
        roles[shuffled[i]] = "مواطن 👷";
    }

    // تحديث الغرفة في فايربيس بالأدوار وتغيير الحالة لـ "started"
    await updateDoc(roomRef, {
        status: "started",
        roles: roles
    });
});
