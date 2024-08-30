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

// DOM elements
const appointmentForm = document.getElementById('appointmentForm');
const registerBtn = document.getElementById('registerBtn');
const deleteBtn = document.getElementById('deleteBtn'); // 삭제 버튼
const cancelBtn = document.getElementById('cancelBtn'); // 예약 취소 버튼
const timeInput = document.getElementById('time'); // 예약 시각 입력 필드
const patientNameInput = document.getElementById('patientName'); // 환자 이름 입력 필드
const chartNumberInput = document.getElementById('chartNumber'); // 차트 번호 입력 필드
const examTypeInput = document.getElementById('examType'); // 검사 종류 입력 필드
const memoInput = document.getElementById('memo'); // 메모 입력 필드

let selectedEventId = null; // 선택한 이벤트의 ID를 저장하기 위한 변수

// Function to fetch events from Firestore and display on calendar
async function fetchEvents() {
    const events = [];
    try {
        const querySnapshot = await getDocs(collection(db, 'appointments'));
        querySnapshot.forEach(doc => {
            const data = doc.data();
            console.log('Firestore data:', data); // 콘솔에 Firestore 데이터 출력

            // 날짜와 시간을 결합하여 FullCalendar가 인식할 수 있는 형식으로 변환
            const dateStr = new Date().toISOString().split('T')[0]; // 현재 날짜를 YYYY-MM-DD 형식으로 가져오기
            const dateTimeStr = `${dateStr}T${data.time}:00`; // 예: 2024-08-30T08:00:00
            const endTimeStr = `${dateStr}T${data.time}:30`; // 30분 후의 시간 설정

            events.push({
                id: doc.id, // 이벤트의 ID를 저장
                title: `${data.patientName} (${data.examType})`,
                start: dateTimeStr, // 이벤트 시작 시간
                end: endTimeStr, // 이벤트 종료 시간 (30분 후)
                extendedProps: {
                    chartNumber: data.chartNumber,
                    memo: data.memo,
                    patientName: data.patientName,
                    examType: data.examType
                }
            });
        });
    } catch (error) {
        console.error('Error fetching events:', error); // 오류가 발생하면 콘솔에 표시
    }
    return events;
}

// Initialize calendar
document.addEventListener('DOMContentLoaded', async function () {
    const calendarEl = document.getElementById('calendar');
    const events = await fetchEvents(); // Fetch events from Firestore
    console.log('Events to be loaded in calendar:', events); // 콘솔에 이벤트 데이터 출력
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        slotMinTime: "08:00:00", // 캘린더에 오전 8시부터 표시
        slotMaxTime: "18:00:00", // 캘린더에 오후 6시까지만 표시
        slotDuration: '00:30:00', // 각 슬롯의 간격을 30분으로 설정
        height: 'auto', // 자동 높이
        slotEventOverlap: false, // 이벤트 겹침 방지
        selectable: true, // Allow date selection
        events: events, // Set fetched events
        eventClick: function(info) {
            // Event click action to fill the form with event details
            const eventObj = info.event;
            selectedEventId = eventObj.id; // 선택한 이벤트의 ID를 저장
            
            // 각 필드에 값을 입력
            timeInput.value = eventObj.start.toISOString().substring(11, 16); // 이벤트의 시작 시간을 설정
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
            window.location.reload(); // Reload page to refresh calendar
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
                window.location.reload(); // Reload page to refresh calendar
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
                window.location.reload(); // Reload page to refresh calendar
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
    if (!user) {
        window.location.href = 'login.html'; // Redirect to login if not authenticated
    }
});
