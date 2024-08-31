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
let currentView = 'timeGridWeek'; // 현재 뷰를 저장하는 변수

// DOM elements
const appointmentForm = document.getElementById('appointmentForm');
const registerBtn = document.getElementById('registerBtn');
const updateBtn = document.getElementById('updateBtn'); // 수정 버튼 추가
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
            if (data.start) {
                events.push({
                    id: doc.id,
                    title: `${data.patientName} (${data.examType})`,
                    start: data.start.toDate(),
                    extendedProps: {
                        chartNumber: data.chartNumber,
                        memo: data.memo,
                        patientName: data.patientName,
                        examType: data.examType,
                        status: data.status || 'active' // 기본 상태는 'active'
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error fetching events:', error);
    }
    return events;
}

function renderCalendar(events) {
    const calendarEl = document.getElementById('calendar');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: currentView,
        //themeSystem: 'bootstrap5',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        timeZone: 'local',
        slotMinTime: "08:00:00",
        slotMaxTime: "18:00:00",
        defaultTimedEventDuration: "00:30",
        height: 'auto',
        contentHeight: 'auto',
        slotEventOverlap: false,
        selectable: true,
        events: events,
        dayMaxEventRows: 5,
        expandRows: false,
        locale: 'ko',
        allDaySlot: false,
        eventMinHeight: 20,
        nowIndicator: true,
        editable: true,
        eventDurationEditable: false,
        eventResizableFromStart: true,
        datesSet: function(view) {
            currentView = view.view.type;
        },
        select: function(info) {
            timeInput.value = info.startStr.substring(11, 16);
            selectedEventId = null;
            registerBtn.classList.remove('hidden');
            updateBtn.classList.add('hidden');
        },
        eventClick: function(info) {
            const eventObj = info.event;
            selectedEventId = eventObj.id;

            const localStartTime = new Date(eventObj.start).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });

            timeInput.value = localStartTime;
            patientNameInput.value = eventObj.extendedProps.patientName;
            chartNumberInput.value = eventObj.extendedProps.chartNumber;
            examTypeInput.value = eventObj.extendedProps.examType;
            memoInput.value = eventObj.extendedProps.memo || '';

            registerBtn.classList.add('hidden');
            updateBtn.classList.remove('hidden');
        },
        eventDidMount: function(info) {
            // 이벤트가 취소된 상태일 때, 취소선 스타일을 추가하고 굵기를 설정
            if (info.event.extendedProps.status === 'canceled') {
                info.el.style.textDecoration = 'line-through'; // 취소선 스타일 추가
                info.el.style.textDecorationThickness = '3px'; // 취소선 굵기 설정
                info.el.style.color = 'gray'; // 텍스트 색상 변경 (선택 사항)
            }
        },
        eventDrop: async function(info) {
            const eventObj = info.event;
            selectedEventId = eventObj.id;

            try {
                await updateDoc(doc(db, 'appointments', selectedEventId), {
                    start: eventObj.start,
                });
                
                //Swal.fire('성공', '이벤트가 성공적으로 이동되었습니다.', 'success');
            } catch (error) {
                Swal.fire('오류', '이벤트 이동 중 문제가 발생했습니다.', 'error');
                console.error('Error updating event:', error);
                info.revert();
            }
        }
    });

    calendar.render();
}


// Initialize calendar
document.addEventListener('DOMContentLoaded', async function () {
    const events = await fetchEvents(); // Fetch events from Firestore
    renderCalendar(events); // 달력 렌더링
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

    // 현재 날짜와 선택한 시간을 결합하여 Firestore에 저장할 Date 객체 생성
    const selectedDate = new Date();
    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    // UTC로 시간 저장
    const utcDate = new Date(selectedDate.toISOString());

    try {
        await addDoc(collection(db, 'appointments'), {
            start: utcDate, // UTC 시간으로 저장
            patientName,
            chartNumber,
            examType,
            memo
        });
        Swal.fire('성공', '검사 예약이 등록되었습니다.', 'success').then(async () => {
            const events = await fetchEvents();
            renderCalendar(events); // 새로고침 없이 달력 다시 그리기
        });
    } catch (error) {
        Swal.fire('오류', '검사 예약 등록 중 문제가 발생했습니다.', 'error');
    }
});

// Event listener for update
updateBtn.addEventListener('click', async () => {
    if (!selectedEventId) {
        Swal.fire('오류', '수정할 예약을 선택하세요.', 'error');
        return;
    }

    const time = timeInput.value;
    const patientName = patientNameInput.value;
    const chartNumber = chartNumberInput.value;
    const examType = examTypeInput.value;
    const memo = memoInput.value;

    if (!time || !patientName || !chartNumber) {
        Swal.fire('오류', '모든 필수 입력란을 채워주세요.', 'error');
        return;
    }

    // 현재 날짜와 선택한 시간을 결합하여 Firestore에 저장할 Date 객체 생성
    const selectedDate = new Date();
    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    // UTC로 시간 저장
    const utcDate = new Date(selectedDate.toISOString());

    try {
        await updateDoc(doc(db, 'appointments', selectedEventId), {
            start: utcDate, // UTC 시간으로 저장
            patientName,
            chartNumber,
            examType,
            memo
        });
        Swal.fire('성공', '검사 예약이 수정되었습니다.', 'success').then(async () => {
            const events = await fetchEvents();
            renderCalendar(events); // 새로고침 없이 달력 다시 그리기
        });
    } catch (error) {
        Swal.fire('오류', '검사 예약 수정 중 문제가 발생했습니다.', 'error');
    }
});

// Event listeners for deletion and canceling...
deleteBtn.addEventListener('click', async () => {
    if (selectedEventId) {
        try {
            await deleteDoc(doc(db, 'appointments', selectedEventId));
            Swal.fire('성공', '검사 예약이 삭제되었습니다.', 'success').then(async () => {
                const events = await fetchEvents();
                renderCalendar(events); // 새로고침 없이 달력 다시 그리기
            });
        } catch (error) {
            Swal.fire('오류', '검사 예약 삭제 중 문제가 발생했습니다.', 'error');
        }
    } else {
        Swal.fire('오류', '삭제할 예약을 선택하세요.', 'error');
    }
});

cancelBtn.addEventListener('click', async () => {
    if (selectedEventId) {
        try {
            await updateDoc(doc(db, 'appointments', selectedEventId), {
                status: 'canceled'
            });
            Swal.fire('성공', '검사 예약이 취소되었습니다.', 'success').then(async () => {
                const events = await fetchEvents();
                renderCalendar(events); // 새로고침 없이 달력 다시 그리기
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
