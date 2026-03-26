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
const inputName = document.getElementById('playerName');
const startGameBtn = document.getElementById('startGameBtn');
const endVotingBtn = document.getElementById('endVotingBtn');

// --- نظام المراقبة اللحظي ---
function startListening(code) {
    onSnapshot(doc(db, "rooms", code), (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        const myName = inputName.value.trim();
        const isAdmin = data.admin === myName;
        const isAlive = data.alivePlayers.includes(myName);

        // قائمة اللاعبين وحالتهم
        document.getElementById('playersList').innerHTML = data.players.map(p => 
            `<li>${data.alivePlayers.includes(p) ? '👤' : '💀'} ${p} ${p === myName ? '(أنت)' : ''}</li>`
        ).join('');

        if (isAdmin && data.status === "waiting" && data.players.length >= 4) startGameBtn.style.display = "block";
        else startGameBtn.style.display = "none";

        // التنقل بين الشاشات حسب الحالة
        if (data.status === "night_mafia") showMafiaTurn(code, data, isAlive);
        else if (data.status === "night_doctor") showDoctorTurn(code, data, isAlive);
        else if (data.status === "night_detective") showDetectiveTurn(code, data, isAlive);
        else if (data.status === "morning_result") showMorningResult(code, data, isAdmin);
        else if (data.status === "voting") showVotingUI(code, data, isAdmin, isAlive);
        else if (data.status === "game_over") showGameOver(data);
    });
}

// --- 1. دور المافيا ---
function showMafiaTurn(code, data, isAlive) {
    const myName = inputName.value.trim();
    votingSection.style.display = "none"; lobbySection.style.display = "block";
    if (!isAlive) return lobbySection.innerHTML = "<h2>💀 أنت ميت.. راقب بصمت</h2>";

    if (data.roles[myName] === "🕵️‍♂️ مافيا") {
        lobbySection.innerHTML = `<h3>🔪 اختر ضحيتك يا زعيم</h3><div class="voting-grid">
            ${data.alivePlayers.filter(p=>data.roles[p]!=="🕵️‍♂️ مافيا").map(p=>`<button class="btn-secondary" onclick="mafiaKill('${code}','${p}')">${p}</button>`).join('')}
        </div>`;
    } else {
        lobbySection.innerHTML = `<h3>🌙 الليل دخل.. المافيا يختارون ضحيتهم</h3><div class="loader"></div>`;
    }
}

// تعديل دالة القتل لضمان الانتقال
window.mafiaKill = async (code, target) => { 
    try {
        await updateDoc(doc(db, "rooms", code), { 
            "nightActions.killed": target, 
            status: "night_doctor" 
        });
    } catch (e) { console.error("Error in mafiaKill:", e); }
};

// --- 2. دور الطبيب ---
function showDoctorTurn(code, data, isAlive) {
    const myName = inputName.value.trim();
    if (data.roles[myName] === "🩺 طبيب" && isAlive) {
        lobbySection.innerHTML = `<h3>💉 من تريد أن تنقذ الليلة؟</h3><div class="voting-grid">
            ${data.alivePlayers.map(p=>`<button class="btn-secondary" onclick="doctorSave('${code}','${p}')">${p}</button>`).join('')}
        </div>`;
    } else {
        lobbySection.innerHTML = `<h3>🚑 الطبيب يحاول إنقاذ ما يمكن إنقاذه..</h3>`;
    }
}
window.doctorSave = async (code, target) => { 
    try {
        await updateDoc(doc(db, "rooms", code), { 
            "nightActions.saved": target, 
            status: "night_detective" 
        });
    } catch (e) { console.error("Error in doctorSave:", e); }
};

// --- 3. دور الشرطي ---
function showDetectiveTurn(code, data, isAlive) {
    const myName = inputName.value.trim();
    if (data.roles[myName] === "👮 شرطي" && isAlive) {
        lobbySection.innerHTML = `<h3>🔍 اختر شخصاً لتفحص هويته</h3><div class="voting-grid">
            ${data.alivePlayers.filter(p=>p!==myName).map(p=>`<button class="btn-secondary" onclick="detCheck(this, '${code}','${p}','${data.roles[p]}')">${p}</button>`).join('')}
        </div>`;
    } else {
        lobbySection.innerHTML = `<h3>👮 الشرطي يبحث عن خيط يوصله للمافيا..</h3>`;
    }
}
window.detCheck = (btn, code, target, role) => {
    const isMafia = role === "🕵️‍♂️ مافيا";
    btn.innerHTML = `${target}: ${isMafia ? "مافيا! 🔥" : "شريف ✅"}`;
    btn.style.background = isMafia ? "#ff3366" : "#28a745";
    setTimeout(async () => { 
        await updateDoc(doc(db, "rooms", code), { status: "morning_result" }); 
    }, 3000);
};

// --- 4. نتيجة الصباح ---
async function showMorningResult(code, data, isAdmin) {
    const killed = data.nightActions?.killed || "";
    const saved = data.nightActions?.saved || "";
    const isSaved = (killed === saved);
    
    let message = isSaved ? "صباح الخير.. ما حدا مات! الطبيب أنقذ الضحية 🛡️" : `للأسف.. استيقظنا على خبر مقتل <b>${killed}</b> 💀`;

    if (isAdmin && killed !== "" && !isSaved) {
        const newAlive = data.alivePlayers.filter(p => p !== killed);
        // تحديث الحقول وتصفيرها للجولة القادمة
        await updateDoc(doc(db, "rooms", code), { 
            alivePlayers: newAlive, 
            "nightActions.killed": "" 
        });
        await checkWin(code, newAlive, data.roles);
    }

    lobbySection.innerHTML = `<h1>☀️ الصباح</h1><p>${message}</p>
        ${isAdmin ? `<button class="btn-primary" onclick="startVote('${code}')">فتح باب التصويت 🗳️</button>` : ""}`;
}

window.startVote = async (code) => { 
    await updateDoc(doc(db, "rooms", code), { status: "voting", votes: {}, hasVoted: [], messages: [] }); 
};

// --- 5. شاشة التصويت والشات ---
function showVotingUI(code, data, isAdmin, isAlive) {
    votingSection.style.display = "block"; lobbySection.style.display = "none";
    
    document.getElementById('votingList').innerHTML = data.alivePlayers.map(p => `
        <div class="vote-card" ${isAlive ? `onclick="vote('${code}', '${p}')"` : ""}>
            <span class="badge">${data.votes[p] || 0}</span> ${p}
        </div>`).join('');

    if (!document.getElementById('chat-container')) {
        votingSection.insertAdjacentHTML('beforeend', `
            <div id="chat-container">
                <div id="chat-box" style="height: 150px; overflow-y: auto; background: #f9f9f9; margin: 10px 0; padding: 10px; border-radius: 8px;"></div>
                ${isAlive ? `<div class="chat-input-area" style="display: flex; gap: 5px;">
                    <input id="chatInput" style="flex: 1;" placeholder="ناقشوا هنا...">
                    <button class="btn-primary" style="padding: 5px 15px;" onclick="sendMsg('${code}')">إرسال</button>
                </div>` : "<h3>💀 الموتى لا يتكلمون</h3>"}
            </div>`);
    }
    document.getElementById('chat-box').innerHTML = (data.messages || []).map(m => `<p style="margin: 5px 0;"><b>${m.user}:</b> ${m.text}</p>`).join('');

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
    
    // ميزة صوت المواطن (2 بدلاً من 1)
    const weight = data.roles[myName] === "👷 مواطن" ? 2 : 1;
    await updateDoc(roomRef, { 
        [`votes.${target}`]: (data.votes[target] || 0) + weight, 
        hasVoted: arrayUnion(myName) 
    });
};

window.sendMsg = async (code) => {
    const input = document.getElementById('chatInput');
    if (!input.value.trim()) return;
    await updateDoc(doc(db, "rooms", code), { 
        messages: arrayUnion({ user: inputName.value, text: input.value }) 
    });
    input.value = "";
};

// --- التحقق من الفوز وإنهاء التصويت ---
async function handleEndVote(code, data) {
    const votes = data.votes;
    if (Object.keys(votes).length === 0) return alert("ما حدا صوت لسا!");
    
    const maxVotes = Math.max(...Object.values(votes));
    const potentialWinners = Object.keys(votes).filter(p => votes[p] === maxVotes);

    if (potentialWinners.length === 1) {
        const eliminated = potentialWinners[0];
        const newAlive = data.alivePlayers.filter(p => p !== eliminated);
        await updateDoc(doc(db, "rooms", code), { alivePlayers: newAlive });
        await checkWin(code, newAlive, data.roles, true);
    } else {
        alert("تعادل في الأصوات! استمروا في النقاش.");
    }
}

async function checkWin(code, alivePlayers, roles, nextNight = false) {
    const mafia = alivePlayers.filter(p => roles[p] === "🕵️‍♂️ مافيا");
    const citizens = alivePlayers.filter(p => roles[p] !== "🕵️‍♂️ مافيا");

    if (mafia.length === 0) {
        await updateDoc(doc(db, "rooms", code), { status: "game_over", winner: "المواطنين الشرفاء 🎉" });
    } else if (mafia.length >= citizens.length) {
        await updateDoc(doc(db, "rooms", code), { status: "game_over", winner: "المافيا الأشرار 😈" });
    } else if (nextNight) {
        await updateDoc(doc(db, "rooms", code), { 
            status: "night_mafia", 
            votes: {}, 
            hasVoted: [], 
            "nightActions.killed": "", 
            "nightActions.saved": "" 
        });
    }
}

function showGameOver(data) {
    votingSection.style.display = "none"; lobbySection.style.display = "block";
    lobbySection.innerHTML = `<div class="result-card" style="text-align: center;"><h1>انتهت اللعبة</h1><h2>الفوز لـ ${data.winner}</h2><button class="btn-primary" onclick="location.reload()">لعبة جديدة</button></div>`;
}

// --- أزرار البداية والانضمام ---
startGameBtn.onclick = async () => {
    const code = document.getElementById('displayRoomCode').innerText;
    const roomRef = doc(db, "rooms", code);
    const snap = await getDoc(roomRef);
    const players = [...snap.data().players].sort(() => Math.random() - 0.5);
    
    let roles = {};
    roles[players[0]] = "🕵️‍♂️ مافيا";
    roles[players[1]] = "🩺 طبيب";
    roles[players[2]] = "👮 شرطي";
    for(let i=3; i<players.length; i++) roles[players[i]] = "👷 مواطن";

    await updateDoc(roomRef, { 
        roles: roles, 
        status: "night_mafia", 
        alivePlayers: snap.data().players, 
        nightActions: {killed: "", saved: ""},
        votes: {},
        hasVoted: [],
        messages: []
    });
};

document.getElementById('createRoomBtn').onclick = async () => {
    const name = inputName.value.trim();
    if (!name) return alert("اكتب اسمك أولاً");
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await setDoc(doc(db, "rooms", code), { 
        admin: name, 
        players: [name], 
        alivePlayers: [name], 
        status: "waiting", 
        roles: {}, 
        votes: {}, 
        messages: [],
        nightActions: { killed: "", saved: "" } // تهيئة الحقول هنا حلت مشكلة التوقف
    });
    startListening(code);
    setupSection.style.display="none"; lobbySection.style.display="block"; document.getElementById('displayRoomCode').innerText=code;
};

document.getElementById('joinRoomBtn').onclick = async () => {
    const name = inputName.value.trim();
    const code = document.getElementById('roomCodeInput').value.trim();
    if (!name || !code) return alert("عبّي البيانات");
    await updateDoc(doc(db, "rooms", code), { 
        players: arrayUnion(name), 
        alivePlayers: arrayUnion(name) 
    });
    startListening(code);
    setupSection.style.display="none"; lobbySection.style.display="block"; document.getElementById('displayRoomCode').innerText=code;
};
