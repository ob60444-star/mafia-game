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
        
        // إدارة ظهور زر البدء
        if (isAdmin && data.players.length >= 3 && data.status === "waiting") {
            startGameBtn.style.display = "block";
        } else {
            startGameBtn.style.display = "none";
        }

        // تحويل الحالات (Logic Switch)
        if (data.status === "night_mafia") {
            showMafiaTurn(code, data);
        } else if (data.status === "night_doctor") {
            showDoctorTurn(code, data);
        } else if (data.status === "morning_result") {
            showMorningResult(data);
        } else if (data.status === "voting") {
            showVotingUI(code, data, isAdmin);
        } else if (data.status === "result") {
            showFinalResult(data);
        }
    });
}

function showLobby(code) { 
    setupSection.style.display = "none"; 
    lobbySection.style.display = "block"; 
    displayRoomCode.innerText = code; 
}

// دالة بدء اللعبة وتوزيع الأدوار
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

// --- مرحلة ليل المافيا ---
function showMafiaTurn(code, data) {
    const myName = inputName.value.trim();
    const myRole = data.roles[myName];
    setupSection.style.display = "none";
    lobbySection.style.display = "block";

    if (myRole === "🕵️‍♂️ مافيا") {
        lobbySection.innerHTML = `
            <div class="role-card" style="border-color: #ff3366;">
                <h2 style="color: #ff3366;">سكينك جاهزة؟ 🔪</h2>
                <p>اختار الضحية لتبدأ الجريمة..</p>
                <div class="voting-grid">
                    ${data.players.filter(p => p !== myName).map(p => `
                        <button class="btn-secondary" onclick="mafiaKill('${code}', '${p}')">${p}</button>
                    `).join('')}
                </div>
            </div>`;
    } else {
        lobbySection.innerHTML = `
            <div class="role-card">
                <h1 style="font-size: 4rem;">🌙</h1>
                <h2>ليل مرعب..</h2>
                <p>المافيا عم يختاروا ضحيتهم هلق.. استر ببيتك!</p>
            </div>`;
    }
}

window.mafiaKill = async (code, target) => {
    await updateDoc(doc(db, "rooms", code), { 
        "nightActions.killed": target,
        "status": "night_doctor" 
    });
};

// --- مرحلة ليل الطبيب ---
function showDoctorTurn(code, data) {
    const myName = inputName.value.trim();
    const myRole = data.roles[myName];
    setupSection.style.display = "none";
    lobbySection.style.display = "block";

    if (myRole === "🩺 طبيب") {
        lobbySection.innerHTML = `
            <div class="role-card" style="border-color: #28a745;">
                <h2 style="color: #ff3366;">خبر عاجل: تم قتل أحد اللاعبين! 💀</h2>
                <p>يا حكيم.. معك فرصة وحدة لتنقذ حدا، مين هو؟</p>
                <div class="voting-grid">
                    ${data.players.map(p => `
                        <button class="btn-secondary" style="border: 1px solid #28a745;" onclick="doctorSave('${code}', '${p}')">${p}</button>
                    `).join('')}
                </div>
            </div>`;
    } else {
        lobbySection.innerHTML = `
            <div class="role-card">
                <h1 style="font-size: 4rem;">🚑</h1>
                <h2>الإسعاف في الطريق..</h2>
                <p>المافيا ضربوا ضربتهم، والطبيب عم يحاول ينقذ الموقف!</p>
            </div>`;
    }
}

window.doctorSave = async (code, target) => {
    await updateDoc(doc(db, "rooms", code), { 
        "nightActions.saved": target,
        "status": "morning_result" 
    });
};

// --- مرحلة نتيجة الصباح ---
function showMorningResult(data) {
    setupSection.style.display = "none";
    lobbySection.style.display = "block";
    const killed = data.nightActions.killed;
    const saved = data.nightActions.saved;

    let message = "";
    let icon = "☀️";

    if (killed === saved) {
        message = `المافيا حاولوا يقتلوا <b>${killed}</b>، بس الطبيب البطل كان أسرع وأنقذه! <br> صرنا الصبح وما حدا مات.`;
        icon = "😇";
    } else {
        message = `للأسف.. القرية صحيت على خبر حزين. المافيا غدروا بـ <b>${killed}</b> ومات!`;
        icon = "💀";
    }

    lobbySection.innerHTML = `
        <div class="role-card">
            <h1 style="font-size: 4rem;">${icon}</h1>
            <h2>طلع الصبح!</h2>
            <p style="font-size: 1.2rem; margin: 20px 0;">${message}</p>
            <button class="btn-primary" onclick="location.reload()">العودة للرئيسية 🔄</button>
        </div>`;
}

// --- نظام التصويت والنتائج النهائية (اختياري حالياً) ---
function showVotingUI(code, data, isAdmin) {
    setupSection.style.display = "none"; 
    lobbySection.style.display = "none"; 
    votingSection.style.display = "block";
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
    votingSection.style.display = "none"; 
    lobbySection.style.display = "block";
    lobbySection.innerHTML = `
        <div class="role-card">
            <h2>النتيجة النهائية ⚖️</h2>
            <p>القرية قررت طرد:</p>
            <h1 style="font-size: 3rem; color: #fff;">💀 ${data.eliminated} 💀</h1>
            <button onclick="location.reload()" class="btn-primary" style="margin-top:20px;">لعبة جديدة 🔄</button>
        </div>
    `;
}
