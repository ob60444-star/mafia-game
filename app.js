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

// عناصر الواجهة
const setupSection = document.getElementById('setup-section');
const lobbySection = document.getElementById('lobby-section');
const playersListUI = document.getElementById('playersList');
const displayRoomCode = document.getElementById('displayRoomCode');
const startGameBtn = document.getElementById('startGameBtn');

const btnCreate = document.getElementById('createRoomBtn');
const btnJoin = document.getElementById('joinRoomBtn');
const inputName = document.getElementById('playerName');
const inputRoomCode = document.getElementById('roomCodeInput');

// إنشاء غرفة
btnCreate.addEventListener('click', async () => {
    const name = inputName.value.trim();
    if (!name) return alert("اكتب اسمك!");

    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    await setDoc(doc(db, "rooms", roomCode), {
        admin: name,
        players: [name],
        status: "waiting",
        roles: {}
    });

    startListening(roomCode);
    showLobby(roomCode);
});

// انضمام لغرفة
btnJoin.addEventListener('click', async () => {
    const name = inputName.value.trim();
    const code = inputRoomCode.value.trim();
    if (!name || !code) return alert("عبّي البيانات!");

    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
        await updateDoc(roomRef, { players: arrayUnion(name) });
        startListening(code);
        showLobby(code);
    } else {
        alert("الغرفة مو موجودة!");
    }
});

// مراقبة الغرفة لحظياً
function startListening(code) {
    onSnapshot(doc(db, "rooms", code), (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        // تحديث القائمة
        playersListUI.innerHTML = data.players.map(p => `<li>👤 ${p}</li>`).join('');

        // إظهار زر البدء للآدمن فقط (إذا صاروا 3 أو أكثر)
        if (data.admin === inputName.value.trim() && data.players.length >= 3 && data.status === "waiting") {
            startGameBtn.style.display = "block";
        }

        // إذا بدأت اللعبة، أظهر الدور لكل لاعب
      if (data.status === "started") {
            const myRole = data.roles[inputName.value.trim()];
            lobbySection.innerHTML = `
                <div class="role-card">
                    <h2 style="color: #ff3366; margin-bottom: 10px;">بدأت اللعبة!</h2>
                    <p style="color: #888;">دورك السري هو:</p>
                    <h1 style="font-size: 3.5rem; margin: 20px 0; color: #fff; text-shadow: 0 0 20px rgba(255,255,255,0.2);">${myRole}</h1>
                    <div style="background: rgba(255,51,102,0.1); padding: 10px; border-radius: 10px; font-size: 0.9rem;">
                        🤫 لا تخلي حدا يشوف موبايلك!
                    </div>
                </div>
            `;
        }
    });
}

// توزيع الأدوار وبدء اللعبة
startGameBtn.addEventListener('click', async () => {
    const code = displayRoomCode.innerText;
    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);
    const players = roomSnap.data().players;

    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const roles = {};
    
    // توزيع بسيط: أول واحد مافيا، الباقي مواطنين (فيك تزيد أدوار بعدين)
    roles[shuffled[0]] = "🕵️‍♂️ مافيا";
    roles[shuffled[1]] = "🩺 طبيب";
    for(let i=2; i<shuffled.length; i++) roles[shuffled[i]] = "👷 مواطن";

    await updateDoc(roomRef, {
        status: "started",
        roles: roles
    });
});

function showLobby(code) {
    setupSection.style.display = "none";
    lobbySection.style.display = "block";
    displayRoomCode.innerText = code;
}
