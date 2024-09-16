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
const 메모Input = document.getElementById('메모');
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
                let 검사표시이름 = '';
                const 검사 = data.검사;

                // 위내시경 관련 검사
                if (검사['위내시경'] && 검사['위내시경']['검진']) {
                    검사표시이름 += '위암검진 ';
                }
                // 대장내시경 관련 검사
                if (검사['대장내시경'] && 검사['대장내시경']['검진'] && 검사['대장내시경']['차수'] === '2차') {
                    검사표시이름 += '대장암검진 2차 ';
                }
                // 상복부초음파 관련 검사
                if (검사['상복부초음파'] && 검사['상복부초음파']['검진']) {
                    검사표시이름 += '간암검진 ';
                }

                // 기타 검사
                for (let examName in 검사) {
                    if (['위내시경', '대장내시경', '상복부초음파'].includes(examName)) continue;
                    검사표시이름 += `${examName} `;
                }

                events.push({
                    id: doc.id,
                    title: `${data.환자이름} (${검사표시이름.trim()})`, // 검사표시이름 표시
                    start: data.start.toDate(),
                    extendedProps: {
                        차트번호: data.차트번호,
                        메모: data.메모,
                        환자이름: data.환자이름,
                        검사: 검사, // 검사 객체 저장
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
                메모Input.value = eventObj.extendedProps.메모 || '';

                const 검사 = eventObj.extendedProps.검사;

                // 모든 검사 버튼 초기화
                document.querySelectorAll('.btn-exam').forEach(button => {
                    if (button.dataset.type) {
                        button.classList.remove('active');
                        button.disabled = true;
                        button.classList.add('disabled');
                    } else {
                        button.classList.remove('active');
                    }
                });

                // 검사 객체에 따라 버튼 활성화
                for (let examName in 검사) {
                    if (examName === '위내시경' && 검사[examName]['검진']) {
                        // 위암검진 버튼 활성화
                        const 위암검진Button = document.querySelector('button[data-value="위암검진"]');
                        위암검진Button.classList.add('active');
                        const 본인부담금Option = document.querySelector('button[data-type="위암검진-본인부담금"]');
                        const 진정Option = document.querySelector('button[data-type="위암검진-진정"]');

                        // 본인부담금 설정
                        if (검사[examName]['본인부담금']) {
                            본인부담금Option.textContent = 검사[examName]['본인부담금'];
                            본인부담금Option.classList.add('active');
                            본인부담금Option.disabled = false;
                            본인부담금Option.classList.remove('disabled');
                        }

                        // 진정 설정
                        if (검사[examName]['진정'] !== undefined) {
                            if (검사[examName]['진정']) {
                                진정Option.textContent = '진정';
                            } else {
                                진정Option.textContent = '비진정';
                            }
                            진정Option.classList.add('active');
                            진정Option.disabled = false;
                            진정Option.classList.remove('disabled');
                        }
                    }

                    // 대장내시경 관련 검사 처리
                    if (examName === '대장내시경' && 검사[examName]['검진']) {
                        const 대장암검진Button = document.querySelector('button[data-value="대장암검진"]');
                        대장암검진Button.classList.add('active');
                        const 차수Option = document.querySelector('button[data-type="대장암검진-차수"]');
                        const 장정결제Option = document.querySelector('button[data-type="대장암검진-장정결제"]');
                        const 장정결제수령Option = document.querySelector('button[data-type="대장암검진-장정결제수령"]');

                        // 차수 설정
                        if (검사[examName]['차수']) {
                            차수Option.textContent = 검사[examName]['차수'];
                            차수Option.classList.add('active');
                            차수Option.disabled = false;
                            차수Option.classList.remove('disabled');
                        }

                        // 장정결제 설정
                        if (검사[examName]['장정결제']) {
                            장정결제Option.textContent = 검사[examName]['장정결제'];
                            장정결제Option.classList.add('active');
                            장정결제Option.disabled = false;
                            장정결제Option.classList.remove('disabled');
                        }

                        // 장정결제수령 설정
                        if (검사[examName]['장정결제수령'] !== undefined) {
                            if (검사[examName]['장정결제수령']) {
                                장정결제수령Option.textContent = '수령';
                            } else {
                                장정결제수령Option.textContent = '미수령';
                            }
                            장정결제수령Option.classList.add('active');
                            장정결제수령Option.disabled = false;
                            장정결제수령Option.classList.remove('disabled');
                        }
                    }

                    // 상복부초음파 관련 검사 처리
                    if (examName === '상복부초음파' && 검사[examName]['검진']) {
                        const 간암검진Button = document.querySelector('button[data-value="간암검진"]');
                        간암검진Button.classList.add('active');
                        const 본인부담금Option = document.querySelector('button[data-type="간암검진-본인부담금"]');

                        // 본인부담금 설정
                        if (검사[examName]['본인부담금']) {
                            본인부담금Option.textContent = 검사[examName]['본인부담금'];
                            본인부담금Option.classList.add('active');
                            본인부담금Option.disabled = false;
                            본인부담금Option.classList.remove('disabled');
                        }
                    }

                    // 건강검진 관련 검사 처리
                    if (examName === '건강검진') {
                        const 건강검진Button = document.querySelector('button[data-value="건강검진"]');
                        건강검진Button.classList.add('active');
                        const 건강검진Options = 검사[examName]['건강검진-옵션'];
                        if (건강검진Options && Object.keys(건강검진Options).length > 0) {
                            const 건강검진OptionButtons = document.querySelectorAll('button[data-type^="건강검진-옵션"]');
                            건강검진OptionButtons.forEach(button => {
                                const optionKey = button.getAttribute('data-type').split('-')[1];
                                if (건강검진Options[optionKey]) {
                                    button.classList.add('active');
                                }
                            });
                        }
                    }

                    // 기타 검사 처리 (예: 노인신체, 인지기능, 정신건강 등)
                    if (['노인신체', '인지기능', '정신건강'].includes(examName)) {
                        const mainButton = document.querySelector(`button[data-value='${examName}']`);
                        if (mainButton) {
                            mainButton.classList.add('active');
                        }
                    }
                }

                // 예약 상태에 따라 버튼 표시
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

                updateButtonStates();
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
    const 검사 = getSelectedExams();
    const 메모 = 메모Input.value;

    if (!time || !환자이름 || !차트번호 || Object.keys(검사).length === 0) {
        Swal.fire('오류', '필수 항목은 누락할 수 없습니다.', 'error');
        return;
    }

    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    const utcDate = new Date(selectedDate.toISOString());

    Swal.fire({
        title: '예약 등록 확인',
        html: `<strong>예약 시각:</strong> ${utcDate.toLocaleString()}<br><strong>환자:</strong> ${환자이름}<br><strong>차트 번호:</strong> ${차트번호}<br><strong>검사 종류:</strong> ${JSON.stringify(검사)}`,
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
                    검사, // 객체로 저장
                    메모
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
    const 검사 = getSelectedExams();
    const 메모 = 메모Input.value;

    if (!time || !환자이름 || !차트번호 || Object.keys(검사).length === 0) {
        Swal.fire('오류', '필수 항목은 누락할 수 없습니다.', 'error');
        return;
    }

    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    const utcDate = new Date(selectedDate.toISOString());

    Swal.fire({
        title: '예약 수정 확인',
        html: `<strong>새 시각:</strong> ${utcDate.toLocaleString()}<br><strong>환자:</strong> ${환자이름}<br><strong>차트 번호:</strong> ${차트번호}<br><strong>검사 종류:</strong> ${JSON.stringify(검사)}`,
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
                    검사, // 객체로 저장
                    메모
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
    const 검사 = {};

    // 주요 검사 버튼 활성화 상태 확인
    document.querySelectorAll('.btn-exam[data-value].active').forEach(button => {
        const examName = button.getAttribute('data-value');

        if (examName === '위암검진') {
            // 위암검진을 위내시경으로 저장
            검사['위내시경'] = { 검진: true };

            // 본인부담금 수집
            const 본인부담금Option = document.querySelector('.btn-exam[data-type="위암검진-본인부담금"].active');
            if (본인부담금Option) {
                검사['위내시경']['본인부담금'] = 본인부담금Option.textContent;
            }

            // 진정 여부 수집
            const 진정Option = document.querySelector('.btn-exam[data-type="위암검진-진정"].active');
            if (진정Option) {
                검사['위내시경']['진정'] = 진정Option.textContent === '진정';
            }

        } else if (examName === '대장암검진') {
            // 대장암검진을 대장내시경으로 저장
            const 차수Option = document.querySelector('.btn-exam[data-type="대장암검진-차수"].active');
            if (차수Option && 차수Option.textContent === '2차') {
                검사['대장내시경'] = { 검진: true, 차수: '2차' };

                const 장정결제Option = document.querySelector('.btn-exam[data-type="대장암검진-장정결제"].active');
                if (장정결제Option) {
                    검사['대장내시경']['장정결제'] = 장정결제Option.textContent;
                }

                const 장정결제수령Option = document.querySelector('.btn-exam[data-type="대장암검진-장정결제수령"].active');
                if (장정결제수령Option) {
                    검사['대장내시경']['장정결제수령'] = 장정결제수령Option.textContent === '수령';
                }
            }

        } else if (examName === '간암검진') {
            // 간암검진을 상복부초음파로 저장
            검사['상복부초음파'] = { 검진: true };

            const 본인부담금Option = document.querySelector('.btn-exam[data-type="간암검진-본인부담금"].active');
            if (본인부담금Option) {
                검사['상복부초음파']['본인부담금'] = 본인부담금Option.textContent;
            }

        } else if (examName === '건강검진') {
            // 건강검진을 검사 객체에 추가하고 하부 옵션 수집
            검사['건강검진'] = {};

            const 건강검진Options = document.querySelectorAll('button[data-type="건강검진-옵션"].active');
            건강검진Options.forEach(option => {
                const optionKey = option.getAttribute('data-type').split('-')[1];
                검사['건강검진'][optionKey] = true;
            });

        } else {
            // 기타 검사
            검사[examName] = {}; // 각 검사에 대해 객체 생성

            // 하부 옵션 수집
            document.querySelectorAll(`.btn-exam[data-type^="${examName}"].active`).forEach(subButton => {
                const optionType = subButton.getAttribute('data-type').split('-')[1]; // 예: "진정"
                const optionValue = subButton.textContent;

                if (optionType === "검진") {
                    // 검진 여부 저장
                    검사[examName][optionType] = true;
                } else if (optionType === "본인부담금") {
                    // 본인부담금 저장
                    검사[examName][optionType] = optionValue;
                } else if (optionType === "추가검진") {
                    // 추가검진은 배열로 저장
                    if (!검사[examName][optionType]) {
                        검사[examName][optionType] = [];
                    }
                    검사[examName][optionType].push(optionValue);
                }
            });
        }
    });

    return 검사;
}

resetBtn.addEventListener('click', () => {
    timeInput.value = '';
    환자이름Input.value = '';
    차트번호Input.value = '';
    메모Input.value = '';
    selectedEventId = null;
    selectedDate = new Date();

    document.querySelectorAll('.btn-exam').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.type) {
            btn.disabled = true;
            btn.classList.add('disabled');
        }
    });

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

// 검사 버튼 로직
document.addEventListener('DOMContentLoaded', function () {
    // 공통 토글 함수
    function toggleButtonState(button, options) {
        button.classList.toggle('active');
        if (button.classList.contains('active')) {
            options.forEach(opt => {
                opt.disabled = false;
                opt.classList.add('active');
                opt.classList.remove('disabled');
            });
        } else {
            options.forEach(opt => {
                opt.disabled = true;
                opt.classList.remove('active');
                opt.classList.add('disabled');
                
            });
        }
    }

    // 공통 토글 함수 외부로 분리 (재사용성 높임)
    function toggleOptionsText(button, options) {
        const currentText = button.textContent;
        const nextIndex = (options.indexOf(currentText) + 1) % options.length;
        button.textContent = options[nextIndex];
    }

    // "건강검진" 버튼 클릭 시 하부 옵션 활성화만 하고 'active' 상태는 변경하지 않음
    document.querySelector('button[data-value="건강검진"]').addEventListener('click', function() {
        const 건강검진Button = document.querySelector('button[data-value="건강검진"]');
        건강검진Button.classList.toggle('active');
        const relatedOptions = document.querySelectorAll('button[data-type="건강검진-옵션"]');
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

    // "건강검진" 서브 옵션 클릭 시 활성화 상태 토글
    document.querySelectorAll('.btn-exam[data-type="건강검진-옵션"]').forEach(button => {
        button.addEventListener('click', function() {
            if (!button.disabled) {
                button.classList.toggle('active');
            }
        });
    });

    // 위암검진 
    document.querySelector('button[data-value="위암검진"]').addEventListener('click', function() {
        const 본인부담금Option = document.querySelector('button[data-type="위암검진-본인부담금"]');
        const 진정Option = document.querySelector('button[data-type="위암검진-진정"]');
        toggleButtonState(this, [본인부담금Option, 진정Option]);
    });
    // 위암검진-본인부담금
    document.querySelector('button[data-type="위암검진-본인부담금"]').addEventListener('click', function() {
        toggleOptionsText(this, ['0%', '10%']);
    });
    // 위암검진-진정
    document.querySelector('button[data-type="위암검진-진정"]').addEventListener('click', function() {
        toggleOptionsText(this, ['진정', '비진정']);
    });

    // 대장암검진 
    document.querySelector('button[data-value="대장암검진"]').addEventListener('click', function() {
        const 차수Option = document.querySelector('button[data-type="대장암검진-차수"]');
        const isSecondStage = 차수Option.textContent === '2차';
        const 대장암검진Button = document.querySelector('button[data-value="대장암검진"]');
        const 장정결제Option = document.querySelector('button[data-type="대장암검진-장정결제"]');
        const 장정결제수령Option = document.querySelector('button[data-type="대장암검진-장정결제수령"]');
        toggleButtonState(this, [차수Option]);
        if  (대장암검진Button.classList.contains('active')) {
            if (isSecondStage) {
                장정결제Option.disabled = false;
                장정결제Option.classList.remove('disabled');
                장정결제Option.classList.add('active');
                장정결제수령Option.disabled = false;
                장정결제수령Option.classList.remove('disabled');
                장정결제수령Option.classList.add('active');
            }
        } else {
            장정결제Option.disabled = true;
            장정결제Option.classList.add('disabled');
            장정결제Option.classList.remove('active');
            장정결제수령Option.disabled = true;
            장정결제수령Option.classList.add('disabled');
            장정결제수령Option.classList.remove('active');
        }
    });

    // 대장암검진-차수 
    document.querySelector('button[data-type="대장암검진-차수"]').addEventListener('click', function() {
        toggleOptionsText(this, ['1차', '2차']);
        const isSecondStage = this.textContent === '2차';
        const 장정결제Option = document.querySelector('button[data-type="대장암검진-장정결제"]');
        const 장정결제수령Option = document.querySelector('button[data-type="대장암검진-장정결제수령"]');
        
            if (isSecondStage) {
                장정결제Option.disabled = false;
                장정결제Option.classList.remove('disabled');
                장정결제Option.classList.add('active');
                장정결제수령Option.disabled = false;
                장정결제수령Option.classList.remove('disabled');
                장정결제수령Option.classList.add('active');
            } else {
                장정결제Option.disabled = true;
                장정결제Option.classList.add('disabled');
                장정결제Option.classList.remove('active');
                장정결제수령Option.disabled = true;
                장정결제수령Option.classList.add('disabled');
                장정결제수령Option.classList.remove('active');
            }
       
    }); 

    // 대장암검진-장정결제 
    document.querySelector('button[data-type="대장암검진-장정결제"]').addEventListener('click', function() {
        toggleOptionsText(this, ['2L', '오라팡', '수프렙']);
    });

    // 대장암검진-장정결제수령 
    document.querySelector('button[data-type="대장암검진-장정결제수령"]').addEventListener('click', function() {
        toggleOptionsText(this, ['미수령', '수령']);
    });

    // 간암검진
    document.querySelector('button[data-value="간암검진"]').addEventListener('click', function() {
        const 본인부담금Option = document.querySelector('button[data-type="간암검진-본인부담금"]');
        toggleButtonState(this, [본인부담금Option]);
    });
    // 간암검진-본인부담금
    document.querySelector('button[data-type="간암검진-본인부담금"]').addEventListener('click', function() {
        toggleOptionsText(this, ['0%', '10%']);
    });
    // 위내시경 버튼 클릭 시
    document.querySelector('button[data-value="위내시경"]').addEventListener('click', function() {
        const relatedOptions = document.querySelectorAll('button[data-type="위내시경-진정"]');
        toggleButtonState(this, Array.from(relatedOptions));
    });
    // 위암검진-진정
    document.querySelector('button[data-type="위내시경-진정"]').addEventListener('click', function() {
        toggleOptionsText(this, ['진정', '비진정']);
    });

    // 대장내시경
    document.querySelector('button[data-value="대장내시경"]').addEventListener('click', function() {
        const relatedOptions = document.querySelectorAll('button[data-type="대장내시경-장정결제"], button[data-type="대장내시경-장정결제수령"]');
        toggleButtonState(this, Array.from(relatedOptions));
    });
    // 대장내시경-장정결제
    document.querySelector('button[data-type="대장내시경-장정결제"]').addEventListener('click', function() {
        toggleOptionsText(this, ['2L', '오라팡', '수프렙']);
    });
    // 대장내시경-장정결제수령
    document.querySelector('button[data-type="대장내시경-장정결제수령"]').addEventListener('click', function() {
        toggleOptionsText(this, ['미수령', '수령']);
    });
    // 기타 검사 버튼 클릭 시 활성화 상태 토글
    document.querySelectorAll('.btn-exam[data-value="상복부초음파"], .btn-exam[data-value="갑상선초음파"], .btn-exam[data-value="경동맥초음파"], .btn-exam[data-value="일반채용"], .btn-exam[data-value="공무원채용"], .btn-exam[data-value="단순결핵"], .btn-exam[data-value="잠복결핵"], .btn-exam[data-value="보건증"], .btn-exam[data-value="TBPE"], .btn-exam[data-value="요단백"], .btn-exam[data-value="당화혈색소"], .btn-exam[data-value="골밀도검사"]').forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('active');
            updateButtonStates();
        });
    });
})