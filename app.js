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

// --- نظام المراقبة ---
function startListening(code) {
    onSnapshot(doc(db, "rooms", code), (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        const myName = inputName.value.trim();
        const isAdmin = data.admin === myName;
        const isAlive = data.alivePlayers.includes(myName);

        // إظهار اللاعبين (الأحياء بـ 👤 والأموات بـ 💀)
        document.getElementById('playersList').innerHTML = data.players.map(p => 
            `<li>${data.alivePlayers.includes(p) ? '👤' : '💀'} ${p} ${p === myName ? '(أنت)' : ''}</li>`
        ).join('');

        if (isAdmin && data.status === "waiting" && data.players.length >= 4) startGameBtn.style.display = "block";
        else startGameBtn.style.display = "none";

        // إدارة الحالات
        if (data.status === "night_mafia") showMafiaTurn(code, data, isAlive);
        else if (data.status === "night_doctor") showDoctorTurn(code, data, isAlive);
        else if (data.status === "night_detective") showDetectiveTurn(code, data, isAlive);
        else if (data.status === "morning_result") showMorningResult(code, data, isAdmin);
        else if (data.status === "voting") showVotingUI(code, data, isAdmin, isAlive);
        else if (data.status === "game_over") showGameOver(data);
    });
}

// --- المافيا ---
function showMafiaTurn(code, data, isAlive) {
    const myName = inputName.value.trim();
    votingSection.style.display = "none"; lobbySection.style.display = "block";
    if (!isAlive) return lobbySection.innerHTML = "<div class='role-card'><h2>💀 أنت ميت</h2><p>راقب بصمت..</p></div>";
    
    if (data.roles[myName] === "🕵️‍♂️ مافيا") {
        lobbySection.innerHTML = `<div class="role-card"><h2>🔪 من الضحية؟</h2><div class="voting-grid">
            ${data.alivePlayers.filter(p=>data.roles[p]!=="🕵️‍♂️ مافيا").map(p=>`<button class="btn-secondary" onclick="mafiaKill('${code}','${p}')">${p}</button>`).join('')}
        </div></div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h2>🌙 ليل..</h2><p>المافيا يختارون ضحيتهم..</p></div>`;
    }
}
window.mafiaKill = async (code, target) => { await updateDoc(doc(db, "rooms", code), { "nightActions.killed": target, status: "night_doctor" }); };

// --- الطبيب ---
function showDoctorTurn(code, data, isAlive) {
    const myName = inputName.value.trim();
    if (data.roles[myName] === "🩺 طبيب" && isAlive) {
        lobbySection.innerHTML = `<div class="role-card"><h2>💉 انقذ شخصاً</h2><div class="voting-grid">
            ${data.alivePlayers.map(p=>`<button class="btn-secondary" onclick="doctorSave('${code}','${p}')">${p}</button>`).join('')}
        </div></div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h2>🚑 الطبيب..</h2><p>يتحرك في شوارع القرية..</p></div>`;
    }
}
window.doctorSave = async (code, target) => { await updateDoc(doc(db, "rooms", code), { "nightActions.saved": target, status: "night_detective" }); };

// --- الشرطي ---
function showDetectiveTurn(code, data, isAlive) {
    const myName = inputName.value.trim();
    if (data.roles[myName] === "👮 شرطي" && isAlive) {
        lobbySection.innerHTML = `<div class="role-card"><h2>🔍 من المشتبه به؟</h2><div class="voting-grid">
            ${data.alivePlayers.filter(p=>p!==myName).map(p=>`<button class="btn-secondary" onclick="detCheck(this, '${code}','${p}','${data.roles[p]}')">${p}</button>`).join('')}
        </div></div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h2>👮 الشرطي..</h2><p>يبحث عن الأدلة..</p></div>`;
    }
}
window.detCheck = (btn, code, target, role) => {
    const isMafia = role === "🕵️‍♂️ مافيا";
    btn.innerHTML = `${target}: ${isMafia ? "مافيا! 🔥" : "شريف ✅"}`;
    btn.style.background = isMafia ? "#ff3366" : "#28a745";
    setTimeout(async () => { await updateDoc(doc(db, "rooms", code), { status: "morning_result" }); }, 2000);
};

// --- الصباح والقتل الفعلي ---
async function showMorningResult(code, data, isAdmin) {
    const killed = data.nightActions.killed;
    const saved = data.nightActions.saved;

    let resultMsg = "";
    let finalKilled = null;

    // معالجة النتيجة بناءً على اختيارات المافيا والطبيب
    if (killed && killed === saved) {
        resultMsg = "ما حدا مات، الشخص اللي انقتل شفاه الطبيب! 🛡️";
    } else if (killed && killed !== saved) {
        finalKilled = killed;
        resultMsg = `للأسف.. مات <b>${finalKilled}</b> 💀`;
    } else {
        resultMsg = "ليلة هادئة.. نجا الجميع! ☀️";
    }

    // تحديث قاعدة البيانات للمشرف فقط وتحديث مصفوفة الأحياء
    if (isAdmin && finalKilled && data.alivePlayers.includes(finalKilled)) {
        let newAlive = data.alivePlayers.filter(p => p !== finalKilled);
        await updateDoc(doc(db, "rooms", code), { alivePlayers: newAlive });
        await checkWin(code, newAlive, data.roles);
    }

    lobbySection.innerHTML = `<div class="role-card"><h1>☀️ الصباح</h1><p>${resultMsg}</p>
        ${isAdmin ? `<button class="btn-primary" onclick="startVote('${code}')">فتح التصويت 🗳️</button>` : ""}</div>`;
}

window.startVote = async (code) => { 
    // تفريغ أحداث الليل هنا لضمان عدم اختفاء رسالة الصباح فجأة
    await updateDoc(doc(db, "rooms", code), { 
        status: "voting", 
        votes: {}, 
        hasVoted: [], 
        messages: [],
        "nightActions.killed": "",
        "nightActions.saved": ""
    }); 
};

// --- التصويت والشات ---
function showVotingUI(code, data, isAdmin, isAlive) {
    votingSection.style.display = "block"; lobbySection.style.display = "none";
    
    // تصميم واضح لأزرار التصويت للجميع لضمان القدرة على التصويت على المافيا
    document.getElementById('votingList').innerHTML = data.alivePlayers.map(p => `
        <div class="vote-card" style="cursor:pointer; border:1px solid #ccc; padding:10px; margin:5px; border-radius:5px; background:#f8f9fa;" ${isAlive ? `onclick="vote('${code}', '${p}')"` : ""}>
            <span class="vote-count-badge" style="font-weight:bold; color:#dc3545;">[ ${data.votes[p] || 0} ]</span> التصويت لـ <b>${p}</b>
        </div>`).join('');

    // الشات
    if (!document.getElementById('chat-area')) {
        votingSection.insertAdjacentHTML('beforeend', `<div id="chat-area" style="margin-top:20px;">${isAlive ? `<div id="chat-box" style="height:150px; overflow-y:scroll; border:1px solid #ddd; padding:10px; margin-bottom:10px; background:#fff;"></div><input id="chatInput" placeholder="اكتب رسالة..." style="width:70%; padding:5px;"><button onclick="sendMsg('${code}')" style="width:25%; padding:5px;">ارسل</button>` : `<h2>💀 الأموات لا يتكلمون</h2>`}</div>`);
    }
    
    if (isAlive) {
        const chatBox = document.getElementById('chat-box');
        chatBox.innerHTML = data.messages.map(m => `<p style="margin:5px 0;"><b>${m.user}:</b> ${m.text}</p>`).join('');
        chatBox.scrollTop = chatBox.scrollHeight; // النزول التلقائي لآخر رسالة
    }

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
    
    // إعطاء المواطن صوتين وباقي الأدوار صوت واحد
    const weight = data.roles[myName] === "👷 مواطن" ? 2 : 1;
    await updateDoc(roomRef, { [`votes.${target}`]: (data.votes[target] || 0) + weight, hasVoted: arrayUnion(myName) });
};

window.sendMsg = async (code) => {
    const text = document.getElementById('chatInput').value;
    if(!text.trim()) return;
    await updateDoc(doc(db, "rooms", code), { messages: arrayUnion({ user: inputName.value, text: text }) });
    document.getElementById('chatInput').value = "";
};

// --- إنهاء التصويت والعودة لليل ---
async function handleEndVote(code, data) {
    const votes = data.votes;
    const keys = Object.keys(votes);
    
    if (keys.length === 0) {
        alert("لم يصوت أحد! يجب التصويت قبل إنهاء الجولة.");
        return;
    }

    const max = Math.max(...Object.values(votes));
    const winners = keys.filter(p => votes[p] === max);
    
    if (winners.length > 1) {
        alert("تعادل! أعيدوا التصويت.");
        await updateDoc(doc(db, "rooms", code), { votes: {}, hasVoted: [] });
    } else {
        const eliminated = winners[0];
        const newAlive = data.alivePlayers.filter(p => p !== eliminated);
        
        // إزالة اللاعب المطرود من مصفوفة الأحياء فوراً
        await updateDoc(doc(db, "rooms", code), { alivePlayers: newAlive });
        await checkWin(code, newAlive, data.roles, true); 
    }
}

async function checkWin(code, alivePlayers, roles, nextNight = false) {
    const mafia = alivePlayers.filter(p => roles[p] === "🕵️‍♂️ مافيا");
    const citizens = alivePlayers.filter(p => roles[p] !== "🕵️‍♂️ مافيا");

    if (mafia.length === 0) {
        await updateDoc(doc(db, "rooms", code), { status: "game_over", winner: "المواطنين 🎉" });
    } else if (mafia.length >= citizens.length) {
        await updateDoc(doc(db, "rooms", code), { status: "game_over", winner: "المافيا 😈" });
    } else if (nextNight) {
        await updateDoc(doc(db, "rooms", code), { status: "night_mafia", votes: {}, hasVoted: [] });
    }
}

function showGameOver(data) {
    votingSection.style.display = "none"; lobbySection.style.display = "block";
    lobbySection.innerHTML = `<div class="role-card"><h1>انتهت اللعبة!</h1><h2>الفوز لـ ${data.winner}</h2><button class="btn-primary" onclick="location.reload()">لعبة جديدة</button></div>`;
}

// إنشاء وانضمام الغرف
document.getElementById('createRoomBtn').onclick = async () => {
    const name = inputName.value.trim();
    if(!name) return alert("الرجاء كتابة اسمك أولاً");
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await setDoc(doc(db, "rooms", code), { admin: name, players: [name], alivePlayers: [name], status: "waiting", roles: {}, votes: {}, hasVoted: [], messages: [], nightActions: {killed: "", saved: ""} });
    startListening(code);
    setupSection.style.display="none"; lobbySection.style.display="block"; document.getElementById('displayRoomCode').innerText=code;
};

document.getElementById('joinRoomBtn').onclick = async () => {
    const name = inputName.value.trim();
    const code = document.getElementById('roomCodeInput').value.trim();
    if(!name || !code) return alert("الرجاء كتابة الاسم وكود الغرفة");
    const ref = doc(db, "rooms", code);
    await updateDoc(ref, { players: arrayUnion(name), alivePlayers: arrayUnion(name) });
    startListening(code);
    setupSection.style.display="none"; lobbySection.style.display="block"; document.getElementById('displayRoomCode').innerText=code;
};
