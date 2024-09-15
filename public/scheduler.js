import { db, handleLogout, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, onAuthStateChanged } from './firebase.js';

let calendar;
let selectedEventId = null;
let currentViewType = 'dayGridMonth';
let currentViewDate = new Date();
let selectedDate = new Date();

const registerBtn = document.getElementById('registerBtn');
const updateBtn = document.getElementById('updateBtn');
const deleteBtn = document.getElementById('deleteBtn');
const cancelBtn = document.getElementById('cancelBtn');
const restoreBtn = document.getElementById('restoreBtn');
const resetBtn = document.getElementById('resetBtn');
const timeInput = document.getElementById('time');
const patientNameInput = document.getElementById('patientName');
const chartNumberInput = document.getElementById('chartNumber');
const memoInput = document.getElementById('memo');
const logoutBtn = document.getElementById('logoutBtn');

if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

initializeFlatpickr();

function initializeFlatpickr() {
    flatpickr("#time", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        minuteIncrement: 30,
        defaultDate: timeInput.value || "09:00",
        onOpen: function (selectedDates, dateStr, instance) {
            const defaultTime = selectedDate ? selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "09:00";
            instance.setDate(defaultTime, false);
        }
    });
}

async function fetchEvents() {
    const events = [];
    try {
        const querySnapshot = await getDocs(collection(db, 'appointments'));
        querySnapshot.forEach(doc => {
            const data = doc.data();
            if (data.start) {
                events.push({
                    id: doc.id,
                    title: `${data.patientName} (${formatExamType(data.examType)})`,
                    start: data.start.toDate(),
                    extendedProps: {
                        chartNumber: data.chartNumber,
                        memo: data.memo,
                        patientName: data.patientName,
                        examType: data.examType,
                        status: data.status || 'active'
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
    if (!calendar) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: currentViewType,
            initialDate: currentViewDate,
            navLinks: true,
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            timeZone: 'local',
            slotMinTime: "08:00:00",
            slotMaxTime: "18:00:00",
            defaultTimedEventDuration: "00:30",
            height: '80%',
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
            navLinkDayClick: function (date) {
                currentViewDate = date;
                selectedDate = date;
                calendar.changeView('timeGridDay', currentViewDate);
            },
            weekNumbers: true,
            navLinkWeekClick: function (weekStart) {
                currentViewDate = weekStart;
                selectedDate = weekStart;
                calendar.changeView('timeGridWeek', currentViewDate);
            },
            select: function (info) {
                selectedDate = info.start;
                timeInput.value = info.startStr.substring(11, 16);
                selectedEventId = null;
                registerBtn.classList.remove('hidden');
                updateBtn.classList.add('hidden');
            },
            eventClick: function (info) {
                const eventObj = info.event;
                selectedEventId = eventObj.id;
                selectedDate = eventObj.start;
                currentViewDate = eventObj.start;
            
                const localStartTime = new Date(eventObj.start).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            
                timeInput.value = localStartTime;
                patientNameInput.value = eventObj.extendedProps.patientName;
                chartNumberInput.value = eventObj.extendedProps.chartNumber;
                memoInput.value = eventObj.extendedProps.memo || '';
            
                const exams = eventObj.extendedProps.examType;
                const formattedExams = formatExamType(exams);
                const selectedExams = exams.mainExams.concat(
                    Object.values(exams.subOptions).flat()
                );
            
                document.querySelectorAll('.btn-exam').forEach(button => {
                    button.classList.remove('active');
                });
            
                selectedExams.forEach(examType => {
                    const button = document.querySelector(`.btn-exam[data-value='${examType}']`);
                    if (button) {
                        button.classList.add('active');
                    }
                });
            
                if (eventObj.extendedProps.status === 'canceled') {
                    restoreBtn.classList.remove('hidden');
                    registerBtn.classList.add('hidden');
                    updateBtn.classList.add('hidden');
                    deleteBtn.classList.add('hidden');
                    cancelBtn.classList.add('hidden');
                } else {
                    restoreBtn.classList.add('hidden');
                    registerBtn.classList.add('hidden');
                    updateBtn.classList.remove('hidden');
                    deleteBtn.classList.remove('hidden');
                    cancelBtn.classList.remove('hidden');
                }
            },
            eventDidMount: function (info) {
                if (info.event.extendedProps.status === 'canceled') {
                    info.el.style.textDecoration = 'line-through';
                    info.el.style.textDecorationThickness = '3px';
                    info.el.style.color = 'gray';
                }
            }
        });

        calendar.render();
    } else {
        calendar.removeAllEvents();
        calendar.addEventSource(events);
    }
}

function saveCurrentViewState() {
    if (calendar) {
        currentViewType = calendar.view.type;
        currentViewDate = calendar.getDate();
    }
}

registerBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    const time = timeInput.value;
    const patientName = patientNameInput.value;
    const chartNumber = chartNumberInput.value;
    const exams = getSelectedExams();
    const memo = memoInput.value;

    if (!time || !patientName || !chartNumber || exams.mainExams.length === 0) {
        Swal.fire('Error', 'Please fill in all required fields.', 'error');
        return;
    }

    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    const utcDate = new Date(selectedDate.toISOString());

    // 검사 종류를 축약형으로 변환
    const formattedExams = formatExamType(exams);

    Swal.fire({
        title: '예약 등록 확인',
        html: `<strong>예약 시각:</strong> ${utcDate.toLocaleString()}<br><strong>환자:</strong> ${patientName}<br><strong>차트 번호:</strong> ${chartNumber}<br><strong>검사 종류:</strong> ${formattedExams}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '등록',
        cancelButtonText: '취소'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await addDoc(collection(db, 'appointments'), {
                    start: utcDate,
                    patientName,
                    chartNumber,
                    examType: exams,
                    memo
                });

                Swal.fire('Success', 'Appointment registered successfully.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
            } catch (error) {
                Swal.fire('Error', 'There was an issue registering the appointment.', 'error');
            }
        }
    });
});

updateBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    if (!selectedEventId) {
        Swal.fire('Error', 'Please select an appointment to update.', 'error');
        return;
    }

    const time = timeInput.value;
    const patientName = patientNameInput.value;
    const chartNumber = chartNumberInput.value;
    const exams = getSelectedExams();
    const memo = memoInput.value;

    if (!time || !patientName || !chartNumber || exams.mainExams.length === 0) {
        Swal.fire('Error', 'Please fill in all required fields.', 'error');
        return;
    }

    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    const utcDate = new Date(selectedDate.toISOString());

    // 검사 종류를 축약형으로 변환
    const formattedExams = formatExamType(exams);

    Swal.fire({
        title: '예약 수정 확인',
        html: `<strong>새 시각:</strong> ${utcDate.toLocaleString()}<br><strong>환자:</strong> ${patientName}<br><strong>차트 번호:</strong> ${chartNumber}<br><strong>검사 종류:</strong> ${formattedExams}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '수정',
        cancelButtonText: '취소'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await updateDoc(doc(db, 'appointments', selectedEventId), {
                    start: utcDate,
                    patientName,
                    chartNumber,
                    examType: exams,
                    memo
                });
                Swal.fire('Success', 'Appointment updated successfully.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
            } catch (error) {
                Swal.fire('Error', 'There was an issue updating the appointment.', 'error');
            }
        }
    });
});

function getSelectedExams() {
    return {
        mainExams: [],
        subOptions: {}
    };
}

resetBtn.addEventListener('click', () => {
    timeInput.value = '';
    patientNameInput.value = '';
    chartNumberInput.value = '';
    memoInput.value = '';
    selectedEventId = null;
    selectedDate = new Date();

    document.querySelectorAll('.active').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.sub-options').forEach(subOption => subOption.classList.add('hidden'));

    updateButtonStates();
});

function updateButtonStates() {
    const anyActive = document.querySelector('.btn-exam.active');
    if (anyActive) {
        registerBtn.classList.add('hidden');
        updateBtn.classList.remove('hidden');
        deleteBtn.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
        resetBtn.classList.remove('hidden');
    } else {
        registerBtn.classList.remove('hidden');
        updateBtn.classList.add('hidden');
        deleteBtn.classList.add('hidden');
        cancelBtn.classList.add('hidden');
        resetBtn.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    const events = await fetchEvents();
    renderCalendar(events);
    updateButtonStates();
});

// 검사 항목 축약형 매핑
const examTypeMap = {
    'stomachScreen': '위',
    'stomachScreendeductible0%': '0%',
    'stomachScreendeductible10%': '10%',
    'stomachScreensedation': '(수)',
    'stomachScreennonsedation': '(비수)',
    'colonScreen': '대장암',
    'colonScreen1st': '1차',
    'colonScreen2nd': '2차',
    'colonoscopy': 'CFS',
    'liverScreen': '간암',
    'liverScreendeductible0%': '0',
    'liverScreendeductible10%': '10',
    'endoscopy': 'EGD',
    'lipidScreen': '지질',
    'lsmScreen': '생활',
    'elderScreen': '노인',
    'cognitionScreen': '인지',
    'depressionScreen': '정신',
    'hbvScreen': 'HBV',
    'bmdScreen': 'BMD',
    'abdUS': '복',
    'thyroidUS': '갑',
    'carotidUS': '경'
};

// 검사 항목을 축약형으로 변환하고 정렬하는 함수
function formatExamType(examTypeObject) {
    // 주요 검사 항목을 축약형으로 변환
    const mainExams = examTypeObject.mainExams.map(type => examTypeMap[type] || type);

    // 하위 옵션들을 축약형으로 변환
    let subExams = [];
    for (let key in examTypeObject.subOptions) {
        const subOptions = examTypeObject.subOptions[key];
        subOptions.forEach(option => {
            const combinedKey = `${key}${option}`; // 예: 'stomachScreen0%'
            subExams.push(examTypeMap[combinedKey] || option);
        });
    }

    // 모든 검사 항목을 하나의 배열로 결합
    const allExams = mainExams.concat(subExams);

    // 우선순위에 따라 검사 항목을 정렬
    const priorityOrder = [
        '위', '0%', '10%', '(수)', '(비수)', // 위암검진 관련 항목 우선
        'CFS', '대장암', '1차', '2차',       // 대장암 검진 및 내시경 관련 항목
        '간암', '0', '10',                     // 간암 관련 항목
        '지질', '생활', '노인', '인지', '정신', // 기타 검진 항목
        'BMD', 'HBV', '복', '갑', '경'       // 기타 초음파 및 검사 항목
    ];

    allExams.sort((a, b) => {
        const indexA = priorityOrder.indexOf(a);
        const indexB = priorityOrder.indexOf(b);
        return (indexA !== -1 ? indexA : priorityOrder.length) - (indexB !== -1 ? indexB : priorityOrder.length);
    });

    return allExams.join(' ');
}
