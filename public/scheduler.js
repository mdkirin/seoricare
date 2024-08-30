// Import Firebase SDK and initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getFirestore, collection, addDoc, query, where, getDocs, updateDoc, doc } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyBhrWAlYTe_iiqsuDBXNV5WVGaw7f19XaI",
    authDomain: "srd-scheduler-1a4b6.firebaseapp.com",
    projectId: "srd-scheduler-1a4b6",
    storageBucket: "srd-scheduler-1a4b6.appspot.com",
    messagingSenderId: "36170465039",
    appId: "1:36170465039:web:8a67ce81c876d97176887a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM elements
const appointmentForm = document.getElementById('appointmentForm');
const registerBtn = document.getElementById('registerBtn');
const deleteBtn = document.getElementById('deleteBtn');
const cancelBtn = document.getElementById('cancelBtn');

// Event listener for registration
registerBtn.addEventListener('click', async () => {
    const time = document.getElementById('time').value;
    const patientName = document.getElementById('patientName').value;
    const chartNumber = document.getElementById('chartNumber').value;
    const examType = document.getElementById('examType').value;
    const memo = document.getElementById('memo').value;

    if (!time || !patientName || !chartNumber) {
        Swal.fire('오류', '모든 필수 입력란을 채워주세요.', 'error');
        return;
    }

    try {
        await addDoc(collection(db, 'appointments'), {
            time,
            patientName,
            chartNumber,
            examType,
            memo
        });
        Swal.fire('성공', '검사 예약이 등록되었습니다.', 'success');
    } catch (error) {
        Swal.fire('오류', '검사 예약 등록 중 문제가 발생했습니다.', 'error');
    }
});

// 달력 초기화 코드
document.addEventListener('DOMContentLoaded', function () {
    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: [] // 여기에 데이터베이스에서 불러온 이벤트 데이터를 넣습니다.
    });
    calendar.render();
});

// Authentication state listener
onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.href = 'login.html'; // Redirect to login if not authenticated
    }
});
