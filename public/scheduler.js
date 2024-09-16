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
const 환자이름Input = document.getElementById('환자이름');
const 차트번호Input = document.getElementById('차트번호');
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
                    title: `${data.환자이름} (${formatExamType(JSON.parse(data.examType))})`, // Parsing JSON string to object
                    start: data.start.toDate(),
                    extendedProps: {
                        차트번호: data.차트번호,
                        memo: data.memo,
                        환자이름: data.환자이름,
                        examType: JSON.parse(data.examType),
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
                환자이름Input.value = eventObj.extendedProps.환자이름;
                차트번호Input.value = eventObj.extendedProps.차트번호;
                memoInput.value = eventObj.extendedProps.memo || '';

                const exams = eventObj.extendedProps.examType;
                const formattedExams = formatExamType(exams);
                const selectedExams = exams.exams.concat(
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
    const 환자이름 = 환자이름Input.value;
    const 차트번호 = 차트번호Input.value;
    const exams = getSelectedExams();
    const memo = memoInput.value;

    if (!time || !환자이름 || !차트번호 || exams.length === 0) {
        Swal.fire('오류', '필수 항목은 누락할 수 없습니다.', 'error');
        return;
    }

    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    const utcDate = new Date(selectedDate.toISOString());

    Swal.fire({
        title: '예약 등록 확인',
        html: `<strong>예약 시각:</strong> ${utcDate.toLocaleString()}<br><strong>환자:</strong> ${환자이름}<br><strong>차트 번호:</strong> ${차트번호}<br><strong>검사 종류:</strong> ${formatExamType(exams)}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '등록',
        cancelButtonText: '취소'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await addDoc(collection(db, 'appointments'), {
                    start: utcDate,
                    환자이름,
                    차트번호,
                    examType: exams, // Save as an object
                    memo
                });

                Swal.fire('등록완료', '검사 예약이 성공적으로 등록되었습니다.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
            } catch (error) {
                Swal.fire('오류', '검사 예약을 등록하는 과정에 문제가 있습니다.', 'error');
            }
        }
    });
});

updateBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    if (!selectedEventId) {
        Swal.fire('오류', '수정할 검사를 선택하세요.', 'error');
        return;
    }

    const time = timeInput.value;
    const 환자이름 = 환자이름Input.value;
    const 차트번호 = 차트번호Input.value;
    const exams = getSelectedExams();
    const memo = memoInput.value;

    if (!time || !환자이름 || !차트번호 || exams.length === 0) {
        Swal.fire('오류', '필수 항목은 누락할 수 없습니다.', 'error');
        return;
    }

    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    const utcDate = new Date(selectedDate.toISOString());

    Swal.fire({
        title: '예약 수정 확인',
        html: `<strong>새 시각:</strong> ${utcDate.toLocaleString()}<br><strong>환자:</strong> ${환자이름}<br><strong>차트 번호:</strong> ${차트번호}<br><strong>검사 종류:</strong> ${formatExamType(exams)}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '수정',
        cancelButtonText: '취소'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await updateDoc(doc(db, 'appointments', selectedEventId), {
                    start: utcDate,
                    환자이름,
                    차트번호,
                    examType: exams, // Save as an object
                    memo
                });
                Swal.fire('수정 완료', '예약 수정이 성공적으로 완료되었습니다.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
            } catch (error) {
                Swal.fire('수정 실패', '예약 수정 과정에 문제가 있습니다.', 'error');
            }
        }
    });
});


function getSelectedExams() {
    const exams = [];

    // Collect main exams
    document.querySelectorAll('.btn-exam[data-value].active').forEach(button => {
        const examName = button.getAttribute('data-value');
        const exam = {
            name: examName,
            options: []
        };

        // Collect sub-options for this main exam
        document.querySelectorAll(`.btn-exam[data-type^="${examName}"].active`).forEach(subButton => {
            exam.options.push(subButton.textContent);
        });

        exams.push(exam);
    });

    return exams;
}

resetBtn.addEventListener('click', () => {
    timeInput.value = '';
    환자이름Input.value = '';
    차트번호Input.value = '';
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

// 검사 항목 축약형 매핑 (한글로 변경)
const examTypeMap = {
    '건강검진': '검진',
    '이상지질': '지질',
    '생활습관': '생활',
    '노인신체': '노인',
    '인지기능': '인지',
    '정신건강': '정신',
    'B형간염': 'HBV',
    '골밀도': 'BMD',
    '위암검진': '위',
    '대장암검진': '대장암',
    '위내시경': 'EGD',
    '대장내시경': 'CFS',
    '간암검진': '간암',
    '상복부초음파': '복',
    '갑상선초음파': '갑',
    '경동맥초음파': '경',
    '일반채용': '일채',
    '공무원채용': '공채',
    '단순결핵': '단결',
    '잠복결핵': '잠결',
    '보건증': '보건',
    'TBPE': 'TBPE',
    '요단백': '요단',
    '당화혈색소': '당화',
    '골밀도검사': 'BMD검사',
    '0%': '0',
    '10%': '10',
    '진정': '(수)',
    '비진정': '(비수)',
    '1차': '1차',
    '2차': '2차',
    '2L': '2L',
    '오라팡': '오라팡',
    '수프렙': '수프렙',
    '미수령': '미수',
    '수령': '수령'
};

// 검사 항목을 축약형으로 변환하고 정렬하는 함수
function formatExamType(examTypeObject) {
    // 주요 검사 항목을 축약형으로 변환
    const exams = examTypeObject.exams.map(type => examTypeMap[type] || type);

    // 하위 옵션들을 축약형으로 변환
    let subExams = [];
    for (let key in examTypeObject.subOptions) {
        const subOptions = examTypeObject.subOptions[key];
        subOptions.forEach(option => {
            const combinedKey = `${key}${option}`; // 예: 'stomachScreen0%'
            subExams.push(examTypeMap[option] || option); // Using option directly
        });
    }

    // 모든 검사 항목을 하나의 배열로 결합
    const allExams = exams.concat(subExams);

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

// 검사 버튼 로직
document.addEventListener('DOMContentLoaded', function () {
    // 건강검진 버튼 클릭 시 서브 옵션 활성화/비활성화
    document.querySelector('button[data-value="건강검진"]').addEventListener('click', function() {
        const relatedOptions = document.querySelectorAll('button[data-type="건강검진-옵션"]');

        // 버튼 자체의 active 상태 토글
        this.classList.toggle('active');
        
        // 서브 옵션의 disabled 속성을 토글
        relatedOptions.forEach(option => {
            if (option.disabled) {
                option.disabled = false;
                option.classList.remove('disabled');
            } else {
                option.disabled = true;
                option.classList.add('disabled');
                option.classList.remove('active'); // 비활성화 시 색상도 초기화
            }
        });
    });

    // 서브 옵션 클릭 시 활성화 상태 토글
    document.querySelectorAll('.btn-exam[data-type="건강검진-옵션"]').forEach(button => {
        button.addEventListener('click', function() {
            if (!button.disabled) {
                button.classList.toggle('active');
            }
        });
    });

    // 위암검진, 대장암검진, 간암검진 버튼 클릭 시 활성화 상태 토글 및 서브 옵션 활성화
    document.querySelector('button[data-value="위암검진"]').addEventListener('click', function() {
        this.classList.toggle('active');
        const relatedOptions = document.querySelectorAll('button[data-type="위암검진-본인부담금"], button[data-type="위암검진-진정"]');
        relatedOptions.forEach(option => {
            option.disabled = !this.classList.contains('active');
            option.classList.toggle('disabled', !this.classList.contains('active'));
            option.classList.toggle('active', this.classList.contains('active'));
        });
    });

    document.querySelector('button[data-value="대장암검진"]').addEventListener('click', function() {
        this.classList.toggle('active');
        const relatedOption = document.querySelector('button[data-type="대장암검진-차수"]');
        relatedOption.disabled = !this.classList.contains('active');
        relatedOption.classList.toggle('disabled', !this.classList.contains('active'));
        relatedOption.classList.toggle('active', this.classList.contains('active'));
    });

    document.querySelector('button[data-value="간암검진"]').addEventListener('click', function() {
        this.classList.toggle('active');
        const relatedOption = document.querySelector('button[data-type="간암검진-본인부담금"]');
        relatedOption.disabled = !this.classList.contains('active');
        relatedOption.classList.toggle('disabled', !this.classList.contains('active'));
        relatedOption.classList.toggle('active', this.classList.contains('active'));
    });

    document.querySelector('button[data-value="위내시경"]').addEventListener('click', function() {
        this.classList.toggle('active');
        const relatedOption = document.querySelector('button[data-type="위내시경-진정"]');
        relatedOption.disabled = !this.classList.contains('active');
        relatedOption.classList.toggle('disabled', !this.classList.contains('active'));
        relatedOption.classList.toggle('active', this.classList.contains('active'));
    });

    document.querySelector('button[data-value="대장내시경"]').addEventListener('click', function() {
        this.classList.toggle('active');
        const relatedOptions = document.querySelectorAll('button[data-type="대장내시경-장정결제"], button[data-type="대장내시경-장정결제수령"]');
        relatedOptions.forEach(option => {
            option.disabled = !this.classList.contains('active');
            option.classList.toggle('disabled', !this.classList.contains('active'));
            option.classList.toggle('active', this.classList.contains('active'));
        });
    });

    // 초음파 및 기타 검사 버튼 클릭 시 활성화 상태 토글
    document.querySelectorAll('.btn-exam[data-value="상복부초음파"], .btn-exam[data-value="갑상선초음파"], .btn-exam[data-value="경동맥초음파"], .btn-exam[data-value="일반채용"], .btn-exam[data-value="공무원채용"], .btn-exam[data-value="단순결핵"], .btn-exam[data-value="잠복결핵"], .btn-exam[data-value="보건증"], .btn-exam[data-value="TBPE"], .btn-exam[data-value="요단백"], .btn-exam[data-value="당화혈색소"], .btn-exam[data-value="골밀도검사"]').forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('active');
        });
    });

    // 토글 로직 추가
    document.querySelector('button[data-type="위암검진-본인부담금"]').addEventListener('click', function() {
        toggleOptionsText(this, ['0%', '10%']);
    });

    document.querySelector('button[data-type="위암검진-진정"]').addEventListener('click', function() {
        toggleOptionsText(this, ['진정', '비진정']);
    });

    document.querySelector('button[data-type="대장암검진-차수"]').addEventListener('click', function() {
        toggleOptionsText(this, ['1차', '2차']);

        // 2차로 토글되면 관련 버튼 활성화 및 active 상태 부여
        const isSecondStage = this.textContent === '2차';
        const relatedOptions = document.querySelectorAll('button[data-type="대장암검진-장정결제"], button[data-type="대장암검진-장정결제수령"]');
        relatedOptions.forEach(option => {
            option.disabled = !isSecondStage;
            option.classList.toggle('disabled', !isSecondStage);
            option.classList.toggle('active', isSecondStage);
        });
    });

    document.querySelector('button[data-type="대장암검진-장정결제"]').addEventListener('click', function() {
        toggleOptionsText(this, ['2L', '오라팡', '수프렙']);
    });

    document.querySelector('button[data-type="대장암검진-장정결제수령"]').addEventListener('click', function() {
        toggleOptionsText(this, ['미수령', '수령']);
    });

    document.querySelector('button[data-type="간암검진-본인부담금"]').addEventListener('click', function() {
        toggleOptionsText(this, ['0%', '10%']);
    });

    document.querySelector('button[data-type="위내시경-진정"]').addEventListener('click', function() {
        toggleOptionsText(this, ['진정', '비진정']);
    });

    document.querySelector('button[data-type="대장내시경-장정결제"]').addEventListener('click', function() {
        toggleOptionsText(this, ['2L', '오라팡', '수프렙']);
    });

    document.querySelector('button[data-type="대장내시경-장정결제수령"]').addEventListener('click', function() {
        toggleOptionsText(this, ['미수령', '수령']);
    });
});

function toggleOptionsText(button, options) {
    const currentText = button.textContent;
    const nextIndex = (options.indexOf(currentText) + 1) % options.length;
    button.textContent = options[nextIndex];
}
