window.onload = () => {
    setTimeout(() => {
        const splash = document.getElementById('splash-screen');
        if(splash) splash.classList.add('fade-out');
    }, 2000);
};

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

const btnCreate = document.getElementById('createRoomBtn');
const btnJoin = document.getElementById('joinRoomBtn');
const inputName = document.getElementById('playerName');
const inputRoomCode = document.getElementById('roomCodeInput');

// إنشاء غرفة
btnCreate.addEventListener('click', async () => {
    const name = inputName.value.trim();
    if (!name) return alert("اكتب اسمك أولاً!");

    const roomCode = Math.floor(1000 + Math.random() * 9000).toString();
    await setDoc(doc(db, "rooms", roomCode), {
        admin: name,
        players: [name],
        status: "waiting",
        roles: {},
        votes: {},
        hasVoted: []
    });

    startListening(roomCode);
    showLobby(roomCode);
});

// انضمام لغرفة
btnJoin.addEventListener('click', async () => {
    const name = inputName.value.trim();
    const code = inputRoomCode.value.trim();
    if (!name || !code) return alert("دخل بياناتك!");

    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);

    if (roomSnap.exists()) {
        await updateDoc(roomRef, { players: arrayUnion(name) });
        startListening(code);
        showLobby(code);
    } else {
        alert("الغرفة غير موجودة!");
    }
});

// مراقبة الغرفة
function startListening(code) {
    onSnapshot(doc(db, "rooms", code), (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        const myName = inputName.value.trim();
        const isAdmin = data.admin === myName;

        // تحديث قائمة اللاعبين في اللوبي
        if (playersListUI) {
            playersListUI.innerHTML = data.players.map(p => `<li>👤 ${p}</li>`).join('');
        }

        // إظهار زر البدء للآدمن
        if (isAdmin && data.players.length >= 3 && data.status === "waiting") {
            startGameBtn.style.display = "block";
        }

        // الحالات المختلفة للعبة
        if (data.status === "started") {
            showRoleCard(data, isAdmin, code);
        } else if (data.status === "voting") {
            showVotingUI(code, data, isAdmin);
        } else if (data.status === "result") {
            showFinalResult(data);
        }
    });
}

function showRoleCard(data, isAdmin, code) {
    setupSection.style.display = "none";
    lobbySection.style.display = "block";
    
    const myName = inputName.value.trim();
    const myRole = data.roles[myName] || "مراقب";

    lobbySection.innerHTML = `
        <div class="role-card">
            <h2 style="color: #ff3366;">دورك السري</h2>
            <h1 style="font-size: 3rem; margin: 15px 0;">${myRole}</h1>
            ${isAdmin ? `<button id="btnManualVote" class="btn-primary" style="background:#ffc107; color:#000;">بدء التصويت للكل 🗳️</button>` : `<p style="color:#888;">بانتظار الآدمن لبدء التصويت...</p>`}
        </div>
    `;

    if (isAdmin) {
        const btn = document.getElementById('btnManualVote');
        if(btn) btn.onclick = async () => {
            await updateDoc(doc(db, "rooms", code), { status: "voting" });
        };
    }
}

// بدء اللعبة وتوزيع الأدوار
startGameBtn.addEventListener('click', async () => {
    const code = displayRoomCode.innerText;
    const roomRef = doc(db, "rooms", code);
    const roomSnap = await getDoc(roomRef);
    const players = roomSnap.data().players;

    const shuffled = [...players].sort(() => 0.5 - Math.random());
    const roles = {};
    const votesInit = {};
    
    const mafiaCount = Math.max(1, Math.floor(players.length / 4));
    
    shuffled.forEach((p, i) => {
        votesInit[p] = 0;
        if (i < mafiaCount) roles[p] = "🕵️‍♂️ مافيا";
        else if (i === mafiaCount) roles[p] = "🩺 طبيب";
        else roles[p] = "👷 مواطن";
    });

    await updateDoc(roomRef, {
        status: "started",
        roles: roles,
        votes: votesInit,
        hasVoted: []
    });
});

function showVotingUI(code, data, isAdmin) {
    setupSection.style.display = "none";
    lobbySection.style.display = "none";
    votingSection.style.display = "block";

    const votingList = document.getElementById('votingList');
    votingList.innerHTML = "";

    data.players.forEach(player => {
        const div = document.createElement('div');
        div.className = "vote-card";
        const vCount = (data.votes && data.votes[player]) ? data.votes[player] : 0;

        div.innerHTML = `<span class="vote-count-badge">${vCount}</span><span>${player}</span>`;

        div.onclick = async () => {
            const myName = inputName.value.trim();
            if (data.hasVoted && data.hasVoted.includes(myName)) return alert("صوّتت وخلصنا! 😂");
            
            await updateDoc(doc(db, "rooms", code), {
                [`votes.${player}`]: vCount + 1,
                "hasVoted": arrayUnion(myName)
            });
        };
        votingList.appendChild(div);
    });

    // زر إنهاء التصويت للآدمن
    if (isAdmin) {
        endVotingBtn.style.display = "block";
        endVotingBtn.onclick = async () => {
            const votes = data.votes || {};
            if (Object.keys(votes).length === 0) return alert("ما حدا صوّت!");
            const winner = Object.keys(votes).reduce((a, b) => votes[a] > votes[b] ? a : b);
            await updateDoc(doc(db, "rooms", code), { status: "result", eliminated: winner });
        };
    }
}

function showFinalResult(data) {
    votingSection.style.display = "none";
    const lobby = document.getElementById('lobby-section');
    lobby.style.display = "block";
    
    lobby.innerHTML = `
        <div class="role-card" style="border-color:#ff3366;">
            <h2>النتيجة النهائية ⚖️</h2>
            <p>تم طرد:</p>
            <h1 style="font-size: 3rem; color: #fff;">💀 ${data.eliminated} 💀</h1>
            <button onclick="location.reload()" class="btn-secondary">لعبة جديدة 🔄</button>
        </div>
    `;
}

function showLobby(code) {
    setupSection.style.display = "none";
    lobbySection.style.display = "block";
    displayRoomCode.innerText = code;
}
