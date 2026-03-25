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

const setupSection = document.getElementById('setup-section');
const lobbySection = document.getElementById('lobby-section');
const votingSection = document.getElementById('voting-section');
const playersListUI = document.getElementById('playersList');
const displayRoomCode = document.getElementById('displayRoomCode');
const startGameBtn = document.getElementById('startGameBtn');
const endVotingBtn = document.getElementById('endVotingBtn');
const inputName = document.getElementById('playerName');
const inputRoomCode = document.getElementById('roomCodeInput');

window.onload = () => { setTimeout(() => document.getElementById('splash-screen').classList.add('fade-out'), 2000); };

// --- الدخول والإنشاء ---
document.getElementById('createRoomBtn').onclick = async () => {
    const name = inputName.value.trim();
    if (!name) return alert("اكتب اسمك!");
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await setDoc(doc(db, "rooms", code), { admin: name, players: [name], status: "waiting", roles: {}, votes: {}, hasVoted: [], messages: [], alivePlayers: [name] });
    startListening(code);
    showLobby(code);
};

document.getElementById('joinRoomBtn').onclick = async () => {
    const name = inputName.value.trim();
    const code = inputRoomCode.value.trim();
    if (!name || !code) return alert("بيانات ناقصة!");
    const roomRef = doc(db, "rooms", code);
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
        await updateDoc(roomRef, { players: arrayUnion(name), alivePlayers: arrayUnion(name) });
        startListening(code);
        showLobby(code);
    } else alert("الغرفة غير موجودة!");
};

function startListening(code) {
    onSnapshot(doc(db, "rooms", code), (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        const myName = inputName.value.trim();
        const isAdmin = data.admin === myName;

        if (playersListUI) playersListUI.innerHTML = data.players.map(p => `<li>${data.alivePlayers.includes(p) ? '👤' : '💀'} ${p}</li>`).join('');
        
        if (isAdmin && data.players.length >= 4 && data.status === "waiting") startGameBtn.style.display = "block";
        else startGameBtn.style.display = "none";

        // المحرك الأساسي للحالات
        if (data.status === "night_mafia") showMafiaTurn(code, data);
        else if (data.status === "night_doctor") showDoctorTurn(code, data);
        else if (data.status === "night_detective") showDetectiveTurn(code, data);
        else if (data.status === "morning_result") showMorningResult(code, data, isAdmin);
        else if (data.status === "voting") showVotingUI(code, data, isAdmin);
        else if (data.status === "game_over") showGameOver(data);
    });
}

function showLobby(code) { setupSection.style.display = "none"; lobbySection.style.display = "block"; displayRoomCode.innerText = code; }

// --- بدء اللعبة وتوزيع الأدوار ---
startGameBtn.onclick = async () => {
    const code = displayRoomCode.innerText;
    const roomRef = doc(db, "rooms", code);
    const snap = await getDoc(roomRef);
    const players = snap.data().players;
    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const roles = {};
    roles[shuffled[0]] = "🕵️‍♂️ مافيا";
    roles[shuffled[1]] = "🩺 طبيب";
    roles[shuffled[2]] = "👮 شرطي";
    for(let i=3; i<shuffled.length; i++) roles[shuffled[i]] = "👷 مواطن";

    await updateDoc(roomRef, { status: "night_mafia", roles: roles, alivePlayers: players, votes: {}, hasVoted: [], nightActions: { killed: "", saved: "" }, messages: [] });
};

// --- الأدوار الليلية ---
function showMafiaTurn(code, data) {
    const myName = inputName.value.trim();
    lobbySection.style.display = "block";
    if (!data.alivePlayers.includes(myName)) return lobbySection.innerHTML = "<h2>أنت ميت.. راقب بصمت 💀</h2>";
    
    if (data.roles[myName] === "🕵️‍♂️ مافيا") {
        lobbySection.innerHTML = `<div class="role-card"><h2>اختار الضحية 🔪</h2><div class="voting-grid">${data.alivePlayers.filter(p=>data.roles[p]!=="🕵️‍♂️ مافيا").map(p=>`<button class="btn-secondary" onclick="mafiaKill('${code}','${p}')">${p}</button>`).join('')}</div></div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h1>🌙</h1><h2>الليل بدأ..</h2><p>المافيا يخططون الآن..</p></div>`;
    }
}
window.mafiaKill = async (code, target) => { await updateDoc(doc(db, "rooms", code), { "nightActions.killed": target, status: "night_doctor" }); };

function showDoctorTurn(code, data) {
    const myName = inputName.value.trim();
    if (data.roles[myName] === "🩺 طبيب" && data.alivePlayers.includes(myName)) {
        lobbySection.innerHTML = `<div class="role-card"><h2>يا حكيم.. مين بدك تحمي؟ 💉</h2><div class="voting-grid">${data.alivePlayers.map(p=>`<button class="btn-secondary" onclick="doctorSave('${code}','${p}')">${p}</button>`).join('')}</div></div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h1>🚑</h1><h2>الطبيب يتحرك..</h2></div>`;
    }
}
window.doctorSave = async (code, target) => { await updateDoc(doc(db, "rooms", code), { "nightActions.saved": target, status: "night_detective" }); };

function showDetectiveTurn(code, data) {
    const myName = inputName.value.trim();
    if (data.roles[myName] === "👮 شرطي" && data.alivePlayers.includes(myName)) {
        lobbySection.innerHTML = `<div class="role-card"><h2>سيادة الشرطي.. مين شاكك فيه؟ 🔍</h2><div class="voting-grid">${data.alivePlayers.filter(p=>p!==myName).map(p=>`<button class="btn-secondary" onclick="detectiveCheck('${code}','${p}','${data.roles[p]}')">${p}</button>`).join('')}</div></div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h1>👮</h1><h2>الشرطي يحقق..</h2></div>`;
    }
}
window.detectiveCheck = async (code, target, role) => {
    alert(`اللاعب ${target} هو: ${role === "🕵️‍♂️ مافيا" ? "مافيا! 🔥" : "مواطن شريف ✅"}`);
    await updateDoc(doc(db, "rooms", code), { status: "morning_result" });
};

// --- نتيجة الصباح وفحص الفوز ---
async function showMorningResult(code, data, isAdmin) {
    const killed = data.nightActions.killed;
    const saved = data.nightActions.saved;
    let finalKilled = killed !== saved ? killed : null;
    
    if (isAdmin && data.status === "morning_result" && killed !== "") {
        // تحديث قائمة الأحياء إذا مات حدا
        if (finalKilled) {
            const newAlive = data.alivePlayers.filter(p => p !== finalKilled);
            await checkWin(code, newAlive, data.roles, "morning");
        }
    }

    lobbySection.innerHTML = `<div class="role-card"><h1>☀️ الصباح</h1><p>${finalKilled ? `مات اللاعب <b>${finalKilled}</b> 💀` : "لم يمت أحد! الطبيب بطل ✅"}</p>${isAdmin ? `<button class="btn-primary" onclick="startVote('${code}')">بدء التصويت 🗳️</button>` : ""}</div>`;
}

window.startVote = async (code) => { await updateDoc(doc(db, "rooms", code), { status: "voting", votes: {}, hasVoted: [], messages: [] }); };

// --- التصويت العام ---
function showVotingUI(code, data, isAdmin) {
    votingSection.style.display = "block"; lobbySection.style.display = "none"; setupSection.style.display = "none";
    document.getElementById('votingList').innerHTML = data.alivePlayers.map(p => `<div class="vote-card" onclick="vote('${code}', '${p}')"><span class="vote-count-badge">${data.votes[p] || 0}</span>${p}</div>`).join('');
    
    // شاشة الشات
    if (!document.getElementById('chat-box')) {
        votingSection.insertAdjacentHTML('beforeend', `<div id="chat-box" style="background:#111; height:100px; overflow-y:auto; padding:10px; margin:10px 0; border-radius:10px;"></div><input id="chatInput" placeholder="تناقشوا.."><button onclick="sendMessage('${code}')">ارسل</button>`);
    }
    document.getElementById('chat-box').innerHTML = data.messages.map(m => `<p><b>${m.user}:</b> ${m.text}</p>`).join('');

    if (isAdmin) {
        endVotingBtn.style.display = "block";
        endVotingBtn.onclick = () => handleEndVote(code, data);
    }
}

window.vote = async (code, target) => {
    const myName = inputName.value.trim();
    const roomRef = doc(db, "rooms", code);
    const snap = await getDoc(roomRef);
    const data = snap.data();
    if (data.hasVoted.includes(myName) || !data.alivePlayers.includes(myName)) return;
    const weight = data.roles[myName] === "👷 مواطن" ? 2 : 1;
    await updateDoc(roomRef, { [`votes.${target}`]: (data.votes[target] || 0) + weight, hasVoted: arrayUnion(myName) });
};

window.sendMessage = async (code) => {
    const text = document.getElementById('chatInput').value;
    await updateDoc(doc(db, "rooms", code), { messages: arrayUnion({ user: inputName.value, text: text }) });
    document.getElementById('chatInput').value = "";
};

async function handleEndVote(code, data) {
    const votes = data.votes;
    const max = Math.max(...Object.values(votes));
    const winners = Object.keys(votes).filter(p => votes[p] === max);
    if (winners.length > 1) {
        alert("تعادل! أعيدوا التصويت.");
        await updateDoc(doc(db, "rooms", code), { votes: {}, hasVoted: [] });
    } else {
        const newAlive = data.alivePlayers.filter(p => p !== winners[0]);
        checkWin(code, newAlive, data.roles, "voting", winners[0]);
    }
}

// --- فحص الفوز النهائي ---
async function checkWin(code, alivePlayers, roles, phase, eliminatedNow = "") {
    const mafiaAlive = alivePlayers.filter(p => roles[p] === "🕵️‍♂️ مافيا");
    const citizensAlive = alivePlayers.filter(p => roles[p] !== "🕵️‍♂️ مافيا");

    let status = phase === "morning" ? "voting" : "night_mafia";
    let winnerGroup = "";

    if (mafiaAlive.length === 0) {
        winnerGroup = "المواطنين الفائزين! 🎉";
        status = "game_over";
    } else if (mafiaAlive.length >= citizensAlive.length) {
        winnerGroup = "المافيا الأشرار! 😈";
        status = "game_over";
    }

    await updateDoc(doc(db, "rooms", code), { 
        alivePlayers: alivePlayers, 
        status: status, 
        winner: winnerGroup,
        lastEliminated: eliminatedNow || (phase === "morning" ? "أحد اللاعبين" : "")
    });
}

function showGameOver(data) {
    votingSection.style.display = "none"; lobbySection.style.display = "block";
    lobbySection.innerHTML = `<div class="role-card"><h1>انتهت اللعبة!</h1><h2>الفوز لـ ${data.winner}</h2><button onclick="location.reload()" class="btn-primary">لعبة جديدة</button></div>`;
}
