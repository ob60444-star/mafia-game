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
        if (isAdmin && data.players.length >= 3 && data.status === "waiting") startGameBtn.style.display = "block";

        if (data.status === "started") showRoleCard(data, isAdmin, code);
        else if (data.status === "voting") showVotingUI(code, data, isAdmin);
        else if (data.status === "result") showFinalResult(data);
    });
}

function showRoleCard(data, isAdmin, code) {
    setupSection.style.display = "none";
    lobbySection.style.display = "block";
    const myRole = data.roles[inputName.value.trim()] || "مراقب";
    lobbySection.innerHTML = `
        <div class="role-card">
            <h2>دورك السري هو</h2>
            <h1 style="font-size: 3rem; margin: 20px 0; color: #ff3366;">${myRole}</h1>
            ${isAdmin ? `<button id="btnStartVote" class="btn-primary" style="background:#ffc107; color:#000;">بدء التصويت للكل 🗳️</button>` : `<p>بانتظار الآدمن...</p>`}
        </div>
    `;
    if (isAdmin) document.getElementById('btnStartVote').onclick = () => updateDoc(doc(db, "rooms", code), { status: "voting" });
}

startGameBtn.onclick = async () => {
    const code = displayRoomCode.innerText;
    const roomSnap = await getDoc(doc(db, "rooms", code));
    const players = roomSnap.data().players;
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const roles = {}; const votesInit = {};
    shuffled.forEach((p, i) => {
        votesInit[p] = 0;
        if (i === 0) roles[p] = "🕵️‍♂️ مافيا";
        else if (i === 1) roles[p] = "🩺 طبيب";
        else roles[p] = "👷 مواطن";
    });
    await updateDoc(doc(db, "rooms", code), { status: "started", roles: roles, votes: votesInit });
};

function showVotingUI(code, data, isAdmin) {
    setupSection.style.display = "none"; lobbySection.style.display = "none"; votingSection.style.display = "block";
    const vList = document.getElementById('votingList');
    vList.innerHTML = data.players.map(p => `
        <div class="vote-card" onclick="vote('${code}', '${p}')">
            <span class="vote-count-badge">${data.votes[p] || 0}</span>
            ${p}
        </div>
    `).join('');
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
    const data = (await getDoc(roomRef)).data();
    if (data.hasVoted.includes(myName)) return alert("صوتت خلص!");
    await updateDoc(roomRef, { [`votes.${target}`]: (data.votes[target] || 0) + 1, hasVoted: arrayUnion(myName) });
};

function showFinalResult(data) {
    votingSection.style.display = "none"; lobbySection.style.display = "block";
    lobbySection.innerHTML = `
        <div class="role-card">
            <h2>النتيجة النهائية ⚖️</h2>
            <p>القرية قررت طرد:</p>
            <h1 style="font-size: 3rem; color: #fff;">💀 ${data.eliminated} 💀</h1>
            <button onclick="location.reload()" class="btn-primary" style="margin-top:20px;">لعبة جديدة 🔄</button>
        </div>
    `;
}

function showLobby(code) { setupSection.style.display = "none"; lobbySection.style.display = "block"; displayRoomCode.innerText = code; }
