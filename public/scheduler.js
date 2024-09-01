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
                    title: `${data.patientName} (${data.examType})`,
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
            
                // 로컬 시간 형식으로 예약 시각 표시
                const localStartTime = new Date(eventObj.start).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            
                timeInput.value = localStartTime;
                patientNameInput.value = eventObj.extendedProps.patientName;
                chartNumberInput.value = eventObj.extendedProps.chartNumber;
                memoInput.value = eventObj.extendedProps.memo || '';
            
                // 선택된 검사 종류 가져오기
                const selectedExams = eventObj.extendedProps.examType.split(', ');
            
                // 모든 버튼 초기화 (비활성화)
                document.querySelectorAll('.btn-exam').forEach(button => {
                    button.classList.remove('active');
                });
            
                // 검사 종류에 해당하는 버튼을 활성화
                selectedExams.forEach(examType => {
                    const button = document.querySelector(`.btn-exam[data-value='${examType}']`);
                    if (button) {
                        button.classList.add('active');
                    }
                });
            
                // 버튼 상태 업데이트 및 섹션 표시 업데이트
                updateButtonStates();
                updateSectionVisibility(); // 활성화된 버튼이 있는 섹션을 펼침
            
                // 상태에 따라 복구, 등록, 수정, 삭제 버튼 표시/숨기기
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
    const examType = formatExamType(getSelectedExams());
    const memo = memoInput.value;

    if (!time || !patientName || !chartNumber || !examType) {
        Swal.fire('Error', 'Please fill in all required fields.', 'error');
        return;
    }

    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    const utcDate = new Date(selectedDate.toISOString());

    Swal.fire({
        title: '예약 등록 확인',
        html: `<strong>예약 시각:</strong> ${utcDate.toLocaleString()}<br><strong>환자:</strong> ${patientName}<br><strong>차트 번호:</strong> ${chartNumber}<br><strong>검사 종류:</strong> ${examType}`,
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
                    examType,
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
    const examType = getSelectedExams(); // Assuming you implement this function to get selected exams
    const memo = memoInput.value;

    if (!time || !patientName || !chartNumber || !examType) {
        Swal.fire('Error', 'Please fill in all required fields.', 'error');
        return;
    }

    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    const utcDate = new Date(selectedDate.toISOString());

    Swal.fire({
        title: '예약 수정 확인',
        html: `<strong>새 시각:</strong> ${utcDate.toLocaleString()}<br><strong>환자:</strong> ${patientName}<br><strong>차트 번호:</strong> ${chartNumber}<br><strong>검사 종류:</strong> ${examType}`,
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
                    examType,
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

deleteBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    if (selectedEventId) {
        Swal.fire({
            title: '예약 삭제 확인',
            html: '해당 예약을 정말 삭제하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '삭제',
            cancelButtonText: '취소'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await deleteDoc(doc(db, 'appointments', selectedEventId));
                    Swal.fire('Success', 'Appointment deleted successfully.', 'success');
                    const events = await fetchEvents();
                    renderCalendar(events);
                } catch (error) {
                    Swal.fire('Error', 'There was an issue deleting the appointment.', 'error');
                }
            }
        });
    } else {
        Swal.fire('Error', 'Please select an appointment to delete.', 'error');
    }
});

cancelBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    if (selectedEventId) {
        Swal.fire({
            title: '예약 취소 확인',
            html: '해당 예약을 정말 취소하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '취소',
            cancelButtonText: '유지'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(db, 'appointments', selectedEventId), {
                        status: 'canceled'
                    });
                    Swal.fire('Success', 'Appointment canceled successfully.', 'success');
                    const events = await fetchEvents();
                    renderCalendar(events);
                } catch (error) {
                    Swal.fire('Error', 'There was an issue canceling the appointment.', 'error');
                }
            }
        });
    } else {
        Swal.fire('Error', 'Please select an appointment to cancel.', 'error');
    }
});

restoreBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    if (selectedEventId) {
        Swal.fire({
            title: '예약 복구 확인',
            html: '해당 예약을 정말 복구하시겠습니까?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: '복구',
            cancelButtonText: '취소'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await updateDoc(doc(db, 'appointments', selectedEventId), {
                        status: 'active'
                    });
                    Swal.fire('Success', 'Appointment restored successfully.', 'success');
                    const events = await fetchEvents();
                    renderCalendar(events);
                } catch (error) {
                    Swal.fire('Error', 'There was an issue restoring the appointment.', 'error');
                }
            }
        });
    } else {
        Swal.fire('Error', 'Please select an appointment to restore.', 'error');
    }
});

function getSelectedExams() {
    let exams = [];

    // 활성화된 검사 버튼들을 찾아서 examType 배열에 추가
    document.querySelectorAll('.btn-exam.active').forEach(btn => {
        exams.push(btn.getAttribute('data-value'));
    });

    // 활성화된 하위 옵션도 추가
    document.querySelectorAll('.btn-cancer-option.active, .btn-cancer-type.active').forEach(btn => {
        exams.push(btn.getAttribute('data-value'));
    });

    return exams.join(', ');
}



// Toggle sub-options based on selected button type
function toggleSubOptions(screenType) {
    const options = document.querySelectorAll(`[data-type='${screenType}']`);
    options.forEach(option => {
        option.classList.toggle('hidden');
    });
}


// Update button states to show/hide action buttons based on active buttons
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

resetBtn.addEventListener('click', () => {
    // 등록 섹션 초기화
    timeInput.value = '';
    patientNameInput.value = '';
    chartNumberInput.value = '';
    memoInput.value = '';
    selectedEventId = null;
    selectedDate = new Date();

    // 모든 버튼 비활성화 및 섹션 숨김
    document.querySelectorAll('.active').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.sub-options').forEach(subOption => subOption.classList.add('hidden'));
    
    updateSectionVisibility();
    updateButtonStates();
});










// 섹션을 열고 닫지 않도록 수정, 활성화된 버튼이 있는 섹션은 항상 펼쳐짐
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    section.classList.remove('hidden'); // 섹션을 항상 펼침
}

// 검사 항목 클릭 시 하위 옵션을 표시
document.querySelectorAll('.btn-exam').forEach(button => {
    button.addEventListener('click', function () {
        const type = this.dataset.value;

        // 검사 항목 활성화
        this.classList.toggle('active');

        // 해당 검사 항목에 따라 하위 옵션 보이기
        const subOptions = document.querySelector(`.sub-options[data-type='${type}']`);
        if (subOptions) {
            subOptions.classList.toggle('hidden', !this.classList.contains('active'));
        } else {
            console.warn(`Sub-options for type ${type} not found.`);
        }

        // 섹션 업데이트
        updateSectionVisibility();
    });
});

// 하위 옵션을 라디오 버튼처럼 작동하도록 설정
document.querySelectorAll('.btn-cancer-option, .btn-cancer-type').forEach(button => {
    button.addEventListener('click', function () {
        const type = this.dataset.type;

        // 배타적인 선택 설정
        const group = this.classList.contains('btn-cancer-option') ? '.btn-cancer-option' : '.btn-cancer-type';
        document.querySelectorAll(`${group}[data-type='${type}']`).forEach(btn => {
            btn.classList.remove('active');
        });

        // 현재 버튼 활성화
        this.classList.add('active');
        
        // 섹션이 닫히지 않도록 보장
        updateSectionVisibility();
    });
});


// 활성화된 버튼이 있는 섹션을 항상 보이도록 유지
function updateSectionVisibility() {
    document.querySelectorAll('.section').forEach(section => {
        const activeBtn = section.querySelector('.btn-exam.active');
        if (activeBtn) {
            section.classList.remove('hidden');
        }
    });
}

// 페이지 로드 시 초기 상태 설정
document.addEventListener('DOMContentLoaded', async function () {
    const events = await fetchEvents();
    renderCalendar(events);

    // 초기 상태 설정
    updateSectionVisibility();
    updateButtonStates();
});

// 검사 항목 축약형 매핑
const examTypeMap = {
    'stomachScreen': '위',
    'stomachScreen0%': '위0%',
    'stomachScreen10%': '위10%',
    'stomachScreen진정': '위(수)',
    'stomachScreen비진정': '위(비수)',
    'colonScreen': '대장암',
    'colonScreen1차': '대장1차',
    'colonScreen2차': '대장2차',
    'colonoscopy': '대장',
    'liverScreen0%': '간0',
    'liverScreen10%': '간10',
    'endoscopy': '위',
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
function formatExamType(examTypeString) {
    const examTypes = examTypeString.split(', ').map(type => examTypeMap[type] || type);
    
    // 우선순위에 따라 검사 항목을 정렬
    const priorityOrder = ['위', '대장', '대장2차', '간0', '간10', '지질', '생활', '노인', '인지', '정신', 'BMD', 'HBV', '복', '갑', '경'];
    examTypes.sort((a, b) => priorityOrder.indexOf(a) - priorityOrder.indexOf(b));
    
    return examTypes.join(' ');
}
