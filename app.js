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
const votingSection = document.getElementById('voting-section');
const playersListUI = document.getElementById('playersList');
const displayRoomCode = document.getElementById('displayRoomCode');
const startGameBtn = document.getElementById('startGameBtn');
const endVotingBtn = document.getElementById('endVotingBtn');
const inputName = document.getElementById('playerName');
const inputRoomCode = document.getElementById('roomCodeInput');

// إخفاء الـ Splash
window.onload = () => { setTimeout(() => document.getElementById('splash-screen').classList.add('fade-out'), 2000); };

// إنشاء غرفة
document.getElementById('createRoomBtn').onclick = async () => {
    const name = inputName.value.trim();
    if (!name) return alert("اكتب اسمك!");
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await setDoc(doc(db, "rooms", code), { admin: name, players: [name], status: "waiting", roles: {}, votes: {}, hasVoted: [] });
    startListening(code);
    showLobby(code);
};

// انضمام
document.getElementById('joinRoomBtn').onclick = async () => {
    const name = inputName.value.trim();
    const code = inputRoomCode.value.trim();
    if (!name || !code) return alert("دخل بياناتك!");
    const roomRef = doc(db, "rooms", code);
    if ((await getDoc(roomRef)).exists()) {
        await updateDoc(roomRef, { players: arrayUnion(name) });
        startListening(code);
        showLobby(code);
    } else alert("الغرفة مو موجودة!");
};

function startListening(code) {
    onSnapshot(doc(db, "rooms", code), (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        const myName = inputName.value.trim();
        const isAdmin = data.admin === myName;

        if (playersListUI) playersListUI.innerHTML = data.players.map(p => `<li>👤 ${p}</li>`).join('');
        
        if (isAdmin && data.players.length >= 3 && data.status === "waiting") {
            startGameBtn.style.display = "block";
        } else {
            startGameBtn.style.display = "none";
        }

        // توزيع الحالات
        if (data.status === "night_mafia") showMafiaTurn(code, data);
        else if (data.status === "night_doctor") showDoctorTurn(code, data);
        else if (data.status === "morning_result") showMorningResult(code, data, isAdmin);
        else if (data.status === "voting") showVotingUI(code, data, isAdmin);
        else if (data.status === "result") showFinalResult(data);
    });
}

function showLobby(code) { setupSection.style.display = "none"; lobbySection.style.display = "block"; displayRoomCode.innerText = code; }

startGameBtn.onclick = async () => {
    const code = displayRoomCode.innerText;
    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);
    const players = roomSnap.data().players;

    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const roles = {};
    shuffled.forEach((p, i) => {
        if (i === 0) roles[p] = "🕵️‍♂️ مافيا";
        else if (i === 1) roles[p] = "🩺 طبيب";
        else roles[p] = "👷 مواطن";
    });

    await updateDoc(roomRef, {
        status: "night_mafia", 
        roles: roles,
        votes: {},      
        hasVoted: [],
        nightActions: { killed: "", saved: "" } 
    });
};

// --- المافيا ---
function showMafiaTurn(code, data) {
    const myName = inputName.value.trim();
    setupSection.style.display = "none"; lobbySection.style.display = "block"; votingSection.style.display = "none";
    if (data.roles[myName] === "🕵️‍♂️ مافيا") {
        lobbySection.innerHTML = `<div class="role-card" style="border-color: #ff3366;"><h2>مين الضحية؟ 🔪</h2><div class="voting-grid">${data.players.filter(p=>p!==myName).map(p=>`<button class="btn-secondary" onclick="mafiaKill('${code}','${p}')">${p}</button>`).join('')}</div></div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h1>🌙</h1><h2>الليل بدأ..</h2><p>المافيا يخططون الآن..</p></div>`;
    }
}
window.mafiaKill = async (code, target) => { await updateDoc(doc(db, "rooms", code), { "nightActions.killed": target, status: "night_doctor" }); };

// --- الطبيب ---
function showDoctorTurn(code, data) {
    const myName = inputName.value.trim();
    if (data.roles[myName] === "🩺 طبيب") {
        lobbySection.innerHTML = `<div class="role-card" style="border-color: #28a745;"><h2>أحد اللاعبين في خطر! 🚑</h2><p>اختار شخص لإنقاذه..</p><div class="voting-grid">${data.players.map(p=>`<button class="btn-secondary" onclick="doctorSave('${code}','${p}')">${p}</button>`).join('')}</div></div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h1>🚑</h1><h2>الطبيب يتحرك..</h2><p>هل سينجو الضحية؟</p></div>`;
    }
}
window.doctorSave = async (code, target) => { await updateDoc(doc(db, "rooms", code), { "nightActions.saved": target, status: "morning_result" }); };

// --- نتيجة الصباح + زر التصويت ---
function showMorningResult(code, data, isAdmin) {
    const killed = data.nightActions.killed;
    const saved = data.nightActions.saved;
    let message = killed === saved ? "الطبيب أنقذ الضحية، لم يمت أحد هذه الليلة! ✅" : `للأسف، استيقظت القرية على خبر مقتل <b>${killed}</b> 💀`;
    
    lobbySection.innerHTML = `
        <div class="role-card">
            <h1>☀️ الصباح</h1>
            <p style="margin:20px 0;">${message}</p>
            ${isAdmin ? `<button class="btn-primary" onclick="startVote('${code}')">فتح باب التصويت 🗳️</button>` : `<p>بانتظار الآدمن لفتح التصويت...</p>`}
        </div>`;
}
window.startVote = async (code) => { await updateDoc(doc(db, "rooms", code), { status: "voting", votes: {}, hasVoted: [] }); };

// --- التصويت العام (مع ميزة صوتين للمواطن) ---
function showVotingUI(code, data, isAdmin) {
    setupSection.style.display = "none"; lobbySection.style.display = "none"; votingSection.style.display = "block";
    document.getElementById('votingList').innerHTML = data.players.map(p => `
        <div class="vote-card" onclick="vote('${code}', '${p}')">
            <span class="vote-count-badge">${data.votes[p] || 0}</span>
            ${p}
        </div>`).join('');
    if (isAdmin) {
        endVotingBtn.style.display = "block";
        endVotingBtn.onclick = () => {
            const winner = Object.keys(data.votes).reduce((a, b) => data.votes[a] > data.votes[b] ? a : b);
            updateDoc(doc(db, "rooms", code), { status: "result", eliminated: winner });
        };
    }
}

window.vote = async (code, target) => {
    const myName = inputName.value.trim();
    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);
    const data = roomSnap.data();

    if (data.hasVoted.includes(myName)) return alert("لقد صوتت بالفعل!");

    // ميزة المواطن: إذا كان مواطن، يضاف 2 لعداد الأصوات، وإلا 1
    const isCitizen = data.roles[myName] === "👷 مواطن";
    const voteWeight = isCitizen ? 2 : 1;

    await updateDoc(roomRef, { 
        [`votes.${target}`]: (data.votes[target] || 0) + voteWeight, 
        hasVoted: arrayUnion(myName) 
    });
};

function showFinalResult(data) {
    votingSection.style.display = "none"; lobbySection.style.display = "block";
    lobbySection.innerHTML = `<div class="role-card"><h2>القضاء والقدر ⚖️</h2><p>تم طرد اللاعب:</p><h1>💀 ${data.eliminated} 💀</h1><button onclick="location.reload()" class="btn-primary">لعبة جديدة 🔄</button></div>`;
}
