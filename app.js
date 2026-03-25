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

// عناصر الواجهة من الـ HTML
const setupSection = document.getElementById('setup-section');
const lobbySection = document.getElementById('lobby-section');
const votingSection = document.getElementById('voting-section');
const playersListUI = document.getElementById('playersList');
const displayRoomCode = document.getElementById('displayRoomCode');
const startGameBtn = document.getElementById('startGameBtn');
const endVotingBtn = document.getElementById('endVotingBtn');
const inputName = document.getElementById('playerName');
const inputRoomCode = document.getElementById('roomCodeInput');

// إخفاء الـ Splash screen
window.onload = () => { 
    setTimeout(() => document.getElementById('splash-screen').classList.add('fade-out'), 2000); 
};

// --- إنشاء غرفة ---
document.getElementById('createRoomBtn').onclick = async () => {
    const name = inputName.value.trim();
    if (!name) return alert("اكتب اسمك أولاً!");
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    await setDoc(doc(db, "rooms", code), { 
        admin: name, 
        players: [name], 
        status: "waiting", 
        roles: {}, 
        votes: {}, 
        hasVoted: [], 
        messages: [] 
    });
    startListening(code);
    showLobby(code);
};

// --- انضمام لغرفة ---
document.getElementById('joinRoomBtn').onclick = async () => {
    const name = inputName.value.trim();
    const code = inputRoomCode.value.trim();
    if (!name || !code) return alert("دخل اسمك وكود الغرفة!");
    const roomRef = doc(db, "rooms", code);
    const snap = await getDoc(roomRef);
    if (snap.exists()) {
        await updateDoc(roomRef, { players: arrayUnion(name) });
        startListening(code);
        showLobby(code);
    } else {
        alert("الغرفة غير موجودة!");
    }
};

// --- مراقبة التغييرات في اللعبة ---
function startListening(code) {
    onSnapshot(doc(db, "rooms", code), (snapshot) => {
        const data = snapshot.data();
        if (!data) return;
        const myName = inputName.value.trim();
        const isAdmin = data.admin === myName;

        if (playersListUI) playersListUI.innerHTML = data.players.map(p => `<li>👤 ${p}</li>`).join('');
        
        if (isAdmin && data.players.length >= 4 && data.status === "waiting") {
            startGameBtn.style.display = "block";
        } else {
            startGameBtn.style.display = "none";
        }

        // تحويل الواجهات حسب الحالة
        if (data.status === "night_mafia") showMafiaTurn(code, data);
        else if (data.status === "night_doctor") showDoctorTurn(code, data);
        else if (data.status === "night_detective") showDetectiveTurn(code, data);
        else if (data.status === "morning_result") showMorningResult(code, data, isAdmin);
        else if (data.status === "voting") showVotingUI(code, data, isAdmin);
        else if (data.status === "result") showFinalResult(data);
    });
}

function showLobby(code) { 
    setupSection.style.display = "none"; 
    lobbySection.style.display = "block"; 
    displayRoomCode.innerText = code; 
}

// --- بدء اللعبة وتوزيع 4 أدوار أساسية ---
startGameBtn.onclick = async () => {
    const code = displayRoomCode.innerText;
    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);
    const players = roomSnap.data().players;

    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const roles = {};
    roles[shuffled[0]] = "🕵️‍♂️ مافيا";
    roles[shuffled[1]] = "🩺 طبيب";
    roles[shuffled[2]] = "👮 شرطي";
    for(let i=3; i<shuffled.length; i++) roles[shuffled[i]] = "👷 مواطن";

    await updateDoc(roomRef, {
        status: "night_mafia", 
        roles: roles,
        votes: {},      
        hasVoted: [],
        nightActions: { killed: "", saved: "" },
        messages: []
    });
};

// --- مرحلة المافيا ---
function showMafiaTurn(code, data) {
    const myName = inputName.value.trim();
    lobbySection.style.display = "block";
    if (data.roles[myName] === "🕵️‍♂️ مافيا") {
        lobbySection.innerHTML = `
            <div class="role-card" style="border-color: #ff3366;">
                <h2 style="color: #ff3366;">سكينك جاهزة؟ 🔪</h2>
                <div class="voting-grid">
                    ${data.players.filter(p => p !== myName).map(p => `
                        <button class="btn-secondary" onclick="mafiaKill('${code}', '${p}')">${p}</button>
                    `).join('')}
                </div>
            </div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h1>🌙</h1><h2>الليل بدأ..</h2><p>المافيا يخططون الآن بصمت..</p></div>`;
    }
}

window.mafiaKill = async (code, target) => {
    await updateDoc(doc(db, "rooms", code), { "nightActions.killed": target, status: "night_doctor" });
};

// --- مرحلة الطبيب ---
function showDoctorTurn(code, data) {
    const myName = inputName.value.trim();
    if (data.roles[myName] === "🩺 طبيب") {
        lobbySection.innerHTML = `
            <div class="role-card" style="border-color: #28a745;">
                <h2 style="color: #28a745;">يا حكيم.. مين بدك تنقذ؟ 💉</h2>
                <div class="voting-grid">
                    ${data.players.map(p => `
                        <button class="btn-secondary" onclick="doctorSave('${code}', '${p}')">${p}</button>
                    `).join('')}
                </div>
            </div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h1>🚑</h1><h2>الطبيب يتحرك..</h2><p>هل سينجو الضحية؟</p></div>`;
    }
}

window.doctorSave = async (code, target) => {
    await updateDoc(doc(db, "rooms", code), { "nightActions.saved": target, status: "night_detective" });
};

// --- مرحلة الشرطي (الميزة الجديدة) ---
function showDetectiveTurn(code, data) {
    const myName = inputName.value.trim();
    if (data.roles[myName] === "👮 شرطي") {
        lobbySection.innerHTML = `
            <div class="role-card" style="border-color: #007bff;">
                <h2 style="color: #007bff;">سيادة الشرطي.. مين شاكك فيه؟ 🔍</h2>
                <div class="voting-grid">
                    ${data.players.filter(p => p !== myName).map(p => `
                        <button class="btn-secondary" onclick="detectiveInvestigate('${code}','${p}','${data.roles[p]}')">${p}</button>
                    `).join('')}
                </div>
            </div>`;
    } else {
        lobbySection.innerHTML = `<div class="role-card"><h1>👮</h1><h2>الشرطي يحقق..</h2><p>العدالة قادمة!</p></div>`;
    }
}

window.detectiveInvestigate = async (code, target, role) => {
    const result = role === "🕵️‍♂️ مافيا" ? "مافيا! 🔥" : "مواطن شريف ✅";
    alert(`تحقيقاتك تقول أن ${target} هو: ${result}`);
    await updateDoc(doc(db, "rooms", code), { status: "morning_result" });
};

// --- نتيجة الصباح ---
function showMorningResult(code, data, isAdmin) {
    const killed = data.nightActions.killed;
    const saved = data.nightActions.saved;
    let message = killed === saved ? "الطبيب أنقذ الشخص! لم يمت أحد هذه الليلة." : `للأسف، استيقظت القرية على خبر مقتل <b>${killed}</b> 💀`;
    
    lobbySection.innerHTML = `
        <div class="role-card">
            <h1>☀️ طلع الصباح</h1>
            <p style="margin:20px 0; font-size:1.2rem;">${message}</p>
            ${isAdmin ? `<button class="btn-primary" onclick="startVote('${code}')">فتح باب النقاش والتصويت 🗳️</button>` : `<p>بانتظار الآدمن لفتح التصويت...</p>`}
        </div>`;
}

window.startVote = async (code) => {
    await updateDoc(doc(db, "rooms", code), { status: "voting", votes: {}, hasVoted: [], messages: [] });
};

// --- واجهة التصويت والدردشة ---
function showVotingUI(code, data, isAdmin) {
    setupSection.style.display = "none"; 
    lobbySection.style.display = "none"; 
    votingSection.style.display = "block";
    
    // 1. تحديث قائمة اللاعبين للتصويت
    document.getElementById('votingList').innerHTML = data.players.map(p => `
        <div class="vote-card" onclick="vote('${code}', '${p}')">
            <span class="vote-count-badge">${data.votes[p] || 0}</span>
            ${p}
        </div>`).join('');
    
    // 2. تحديث شاشة الدردشة
    let chatContent = data.messages.map(m => `<p style="margin:5px 0;"><b>${m.user}:</b> ${m.text}</p>`).join('');
    
    if (!document.getElementById('chat-container')) {
        const chatDiv = document.createElement('div');
        chatDiv.id = 'chat-container';
        chatDiv.innerHTML = `
            <div id="chat-box" style="background:#1a1a1a; height:120px; overflow-y:auto; margin-top:20px; padding:10px; border-radius:10px; text-align:left; border:1px solid #333;">
                ${chatContent}
            </div>
            <div style="display:flex; margin-top:10px;">
                <input id="chatInput" type="text" placeholder="تناقشوا هنا..." style="flex:1; padding:10px; border-radius:5px 0 0 5px; background:#222; color:white; border:1px solid #444;">
                <button id="sendChatBtn" style="padding:10px; background:#ff3366; color:white; border:none; border-radius:0 5px 5px 0; cursor:pointer;">ارسل</button>
            </div>`;
        votingSection.appendChild(chatDiv);
        document.getElementById('sendChatBtn').onclick = () => sendMessage(code);
    } else {
        document.getElementById('chat-box').innerHTML = chatContent;
        document.getElementById('chat-box').scrollTop = document.getElementById('chat-box').scrollHeight;
    }

    if (isAdmin) {
        endVotingBtn.style.display = "block";
        endVotingBtn.onclick = () => handleEndVoting(code, data);
    }
}

window.sendMessage = async (code) => {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;
    await updateDoc(doc(db, "rooms", code), { 
        messages: arrayUnion({ user: inputName.value, text: text }) 
    });
    input.value = "";
};

// --- تصويت المواطن بصوتين ---
window.vote = async (code, target) => {
    const myName = inputName.value.trim();
    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);
    const data = roomSnap.data();

    if (data.hasVoted.includes(myName)) return alert("صوتت خلص!");

    const voteWeight = data.roles[myName] === "👷 مواطن" ? 2 : 1;

    await updateDoc(roomRef, { 
        [`votes.${target}`]: (data.votes[target] || 0) + voteWeight, 
        hasVoted: arrayUnion(myName) 
    });
};

// --- إنهاء التصويت ومنع التعادل ---
async function handleEndVoting(code, data) {
    const votes = data.votes;
    const playersWithVotes = Object.keys(votes);
    if (playersWithVotes.length === 0) return alert("ما حدا صوت!");

    const maxVotes = Math.max(...Object.values(votes));
    const winners = playersWithVotes.filter(p => votes[p] === maxVotes);

    if (winners.length > 1) {
        alert("تعادل بالأصوات! لازم تعيدوا التصويت لتتفقوا على شخص واحد.");
        await updateDoc(doc(db, "rooms", code), { 
            votes: {}, 
            hasVoted: [], 
            messages: arrayUnion({user: "📢 النظام", text: "⚠️ تعادل بالأصوات! تم إعادة التصويت، تناقشوا مجدداً."}) 
        });
    } else {
        await updateDoc(doc(db, "rooms", code), { status: "result", eliminated: winners[0] });
    }
}

function showFinalResult(data) {
    votingSection.style.display = "none"; lobbySection.style.display = "block";
    lobbySection.innerHTML = `
        <div class="role-card">
            <h2>قرار القرية النهائي ⚖️</h2>
            <p>تم طرد اللاعب:</p>
            <h1 style="font-size: 3rem; color: #fff; margin:20px 0;">💀 ${data.eliminated} 💀</h1>
            <button onclick="location.reload()" class="btn-primary">لعبة جديدة 🔄</button>
        </div>`;
}
