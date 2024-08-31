// Import Firebase SDK and initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyBTQsXAD6TCv-RLTM-2_LOH8Q91jIurvHo",
    authDomain: "seoricare.firebaseapp.com",
    projectId: "seoricare",
    storageBucket: "seoricare.appspot.com",
    messagingSenderId: "725312668828",
    appId: "1:725312668828:web:f4d6c038176ade87d09959"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let selectedEventId = null;

// DOM elements
const appointmentForm = document.getElementById('appointmentForm');
const registerBtn = document.getElementById('registerBtn');
const deleteBtn = document.getElementById('deleteBtn');
const cancelBtn = document.getElementById('cancelBtn');
const timeInput = document.getElementById('time');
const patientNameInput = document.getElementById('patientName');
const chartNumberInput = document.getElementById('chartNumber');
const examTypeInput = document.getElementById('examType');
const memoInput = document.getElementById('memo');

async function fetchEvents() {
    const events = [];
    try {
        const querySnapshot = await getDocs(collection(db, 'appointments'));
        querySnapshot.forEach(doc => {
            const data = doc.data();
            const dateStr = new Date().toISOString().split('T')[0];
            const dateTimeStr = `${dateStr}T${data.time}:00`;
            const endTimeStr = `${dateStr}T${data.time}:30`;

            events.push({
                id: doc.id,
                title: `${data.patientName} (${data.examType})`,
                start: dateTimeStr,
                end: endTimeStr,
                extendedProps: {
                    chartNumber: data.chartNumber,
                    memo: data.memo,
                    patientName: data.patientName,
                    examType: data.examType
                }
            });
        });
    } catch (error) {
        console.error('Error fetching events:', error);
    }
    return events;
}

// Initialize calendar
document.addEventListener('DOMContentLoaded', async function () {
    const calendarEl = document.getElementById('calendar');
    const events = await fetchEvents(); // Fetch events from Firestore

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridWeek',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        slotMinTime: "08:00:00",
        slotMaxTime: "18:00:00",
        height: 'auto', // 변경된 부분: 높이를 100%로 설정
        contentHeight: 'auto', // 필요에 따라 자동 높이 조정
        slotEventOverlap: false,
        selectable: true,
        events: events, // Use the fetched events
        expandRows: true,
        locale: 'ko',
        allDaySlot: false,
        eventMinHeight: 20,
        nowIndicator: true,
        editable: true,
        select: function(info) {
            timeInput.value = info.startStr.substring(11, 16);
            selectedEventId = null; // New event creation mode
        },
        eventClick: function(info) {
            const eventObj = info.event;
            selectedEventId = eventObj.id;

            // 시간 값을 로컬 시간대로 변환
            const localStartTime = new Date(eventObj.start).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            timeInput.value = localStartTime; // 변환된 시간을 등록창에 표시
            patientNameInput.value = eventObj.extendedProps.patientName;
            chartNumberInput.value = eventObj.extendedProps.chartNumber;
            examTypeInput.value = eventObj.extendedProps.examType;
            memoInput.value = eventObj.extendedProps.memo || '';
        }
    });

    calendar.render();
});

// Event listener for registration
registerBtn.addEventListener('click', async () => {
    const time = timeInput.value;
    const patientName = patientNameInput.value;
    const chartNumber = chartNumberInput.value;
    const examType = examTypeInput.value;
    const memo = memoInput.value;

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
        Swal.fire('성공', '검사 예약이 등록되었습니다.', 'success').then(() => {
            window.location.reload();
        });
    } catch (error) {
        Swal.fire('오류', '검사 예약 등록 중 문제가 발생했습니다.', 'error');
    }
});

// Event listener for deletion
deleteBtn.addEventListener('click', async () => {
    if (selectedEventId) {
        try {
            await deleteDoc(doc(db, 'appointments', selectedEventId));
            Swal.fire('성공', '검사 예약이 삭제되었습니다.', 'success').then(() => {
                window.location.reload();
            });
        } catch (error) {
            Swal.fire('오류', '검사 예약 삭제 중 문제가 발생했습니다.', 'error');
        }
    } else {
        Swal.fire('오류', '삭제할 예약을 선택하세요.', 'error');
    }
});

// Event listener for canceling
cancelBtn.addEventListener('click', async () => {
    if (selectedEventId) {
        try {
            await updateDoc(doc(db, 'appointments', selectedEventId), {
                status: 'canceled'
            });
            Swal.fire('성공', '검사 예약이 취소되었습니다.', 'success').then(() => {
                window.location.reload();
            });
        } catch (error) {
            Swal.fire('오류', '검사 예약 취소 중 문제가 발생했습니다.', 'error');
        }
    } else {
        Swal.fire('오류', '취소할 예약을 선택하세요.', 'error');
    }
});

// Authentication state listener
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('userStatus').innerText = `${user.email}님 환영합니다.`;
    } else {
        window.location.href = 'login.html'; // Redirect to login if not authenticated
    }
});