// firebase.js 모듈 임포트
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

// 로그아웃 버튼 이벤트 리스너
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// Flatpickr 초기화
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

// 공통 상태 설정 함수
function ToggleButtonActive(button, isEnabled) {
    if (isEnabled) {
        button.disabled = false;
        button.classList.remove('disabled');
    } else {
        button.disabled = true;
        button.classList.add('disabled');
        button.classList.remove('selected');
    }
}

// 옵션 텍스트 순환 함수
function toggleOptionsText(button, options) {
    const currentText = button.textContent;
    const nextIndex = (options.indexOf(currentText) + 1) % options.length;
    button.textContent = options[nextIndex];
}

// 토글 버튼 상태 함수
function toggleButtonSelect(button, options) {
    button.classList.toggle('selected');
    const isSelected = button.classList.contains('selected');

    options.forEach(opt => {
        ToggleButtonActive(opt, isSelected);
        if (!isSelected) {
            opt.classList.remove('selected');
        }
    });
}

// 이벤트 가져오기 함수
async function fetchEvents() {
    const events = [];
    try {
        const querySnapshot = await getDocs(collection(db, '검사예약'));
        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            if (data.start) {
                let 검사표시이름 = '';
                const 검사 = data.검사;

                // 위내시경 관련 검사
                if (검사['위내시경']) {
                    if (검사['위내시경']['검진'] === true) {
                        검사표시이름 += '위암검진 ';
                    } else {
                        검사표시이름 += '위내시경 ';
                    }
                }
                // 대장암검진 관련 검사
                if (검사['대장암검진']) {
                    검사표시이름 += `대장암검진 ${검사['대장암검진']['차수']} `;
                }
                // 대장내시경 관련 검사
                if (검사['대장내시경']) {
                    if (검사['대장내시경']['검진'] === true) {
                        검사표시이름 += '대장암검진 2차 ';
                    } else {
                        검사표시이름 += '대장내시경 ';
                    }
                }
                // 상복부초음파 관련 검사
                if (검사['상복부초음파']) {
                    if (검사['상복부초음파']['검진'] === true) {
                        검사표시이름 += '간암검진 ';
                    } else {
                        검사표시이름 += '상복부초음파 ';
                    }
                }

                // 기타 검사
                for (let examName in 검사) {
                    if (['위내시경', '대장암검진', '대장내시경', '상복부초음파', '건강검진'].includes(examName)) continue;
                    검사표시이름 += `${examName} `;
                }

                events.push({
                    id: docSnap.id,
                    title: `${data.환자이름} (${검사표시이름.trim()})`,
                    start: data.start.toDate(),
                    extendedProps: {
                        차트번호: data.차트번호,
                        메모: data.memo || '',
                        환자이름: data.환자이름,
                        검사: data.검사,
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

// 캘린더 렌더링 함수
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
            //locale: 'ko',
            allDaySlot: false,
            eventMinHeight: 20,
            nowIndicator: true,
            editable: true,
            eventDurationEditable: false,
            eventResizableFromStart: true,
            eventDrop: handleEventDrop, // 드래그 앤 드롭 핸들러 추가
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
            eventClick: handleEventClick,
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

async function handleEventDrop(info) {
    const event = info.event;
    const eventId = event.id;
    const newStart = event.start;

    Swal.fire({
        title: '일정 변경 확인',
        text: '이 일정을 새로운 시간으로 변경하시겠습니까?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '변경',
        cancelButtonText: '취소'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await updateDoc(doc(db, '검사예약', eventId), {
                    start: newStart
                });

                Swal.fire('변경 완료', '일정이 성공적으로 변경되었습니다.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
            } catch (error) {
                Swal.fire('오류', '일정 변경 과정에 문제가 있습니다.', 'error');
                console.error('Error updating document:', error);
                // 원래 위치로 되돌리기
                info.revert();
            }
        } else {
            // 사용자가 취소를 선택한 경우 원래 위치로 되돌리기
            info.revert();
        }
    });
}

// 이벤트 클릭 핸들러
async function handleEventClick(info) {
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
            button.classList.remove('selected');
            button.disabled = true;
            button.classList.add('disabled');
        } else {
            button.classList.remove('selected');
        }
    });

    // 검사 객체에 따라 버튼 선택 및 값 설정
    for (let examName in 검사) {
        if (examName === '위내시경') {
            if (검사[examName]['검진'] === true) {
                // 위암검진 처리
                const 위암검진Button = document.querySelector('button[data-value="위암검진"]');
                위암검진Button.classList.add('selected');

                const 본인부담금Option = document.querySelector('button[data-type="위암검진-본인부담금"]');
                const 진정Option = document.querySelector('button[data-type="위암검진-진정"]');

                ToggleButtonActive(본인부담금Option, true);
                ToggleButtonActive(진정Option, true);

                본인부담금Option.textContent = 검사[examName]['본인부담금'];
                진정Option.textContent = 검사[examName]['진정'] ? '진정' : '비진정';

                본인부담금Option.classList.add('selected');
                진정Option.classList.add('selected');
            } else {
                // 위내시경 처리
                const 위내시경Button = document.querySelector('button[data-value="위내시경"]');
                위내시경Button.classList.add('selected');

                const 진정Option = document.querySelector('button[data-type="위내시경-진정"]');

                ToggleButtonActive(진정Option, true);
                진정Option.textContent = 검사[examName]['진정'] ? '진정' : '비진정';
                진정Option.classList.add('selected');
            }
        } else if (examName === '대장내시경') {
            if (검사[examName]['검진'] === true) {
                // 대장암검진 2차 처리
                const 대장암검진Button = document.querySelector('button[data-value="대장암검진"]');
                대장암검진Button.classList.add('selected');

                const 차수Option = document.querySelector('button[data-type="대장암검진-차수"]');
                const 장정결제Option = document.querySelector('button[data-type="대장암검진-장정결제"]');
                const 장정결제수령Option = document.querySelector('button[data-type="대장암검진-장정결제수령"]');

                ToggleButtonActive(차수Option, true);
                ToggleButtonActive(장정결제Option, true);
                ToggleButtonActive(장정결제수령Option, true);

                차수Option.textContent = '2차';
                장정결제Option.textContent = 검사[examName]['장정결제'];
                장정결제수령Option.textContent = 검사[examName]['장정결제수령'] ? '수령' : '미수령';

                차수Option.classList.add('selected');
                장정결제Option.classList.add('selected');
                장정결제수령Option.classList.add('selected');
            } else {
                // 대장내시경 처리
                const 대장내시경Button = document.querySelector('button[data-value="대장내시경"]');
                대장내시경Button.classList.add('selected');

                const 장정결제Option = document.querySelector('button[data-type="대장내시경-장정결제"]');
                const 장정결제수령Option = document.querySelector('button[data-type="대장내시경-장정결제수령"]');

                ToggleButtonActive(장정결제Option, true);
                ToggleButtonActive(장정결제수령Option, true);

                장정결제Option.textContent = 검사[examName]['장정결제'];
                장정결제수령Option.textContent = 검사[examName]['장정결제수령'] ? '수령' : '미수령';

                장정결제Option.classList.add('selected');
                장정결제수령Option.classList.add('selected');
            }
        } else if (examName === '대장암검진') {
            // 대장암검진 1차 처리
            const 대장암검진Button = document.querySelector('button[data-value="대장암검진"]');
            대장암검진Button.classList.add('selected');

            const 차수Option = document.querySelector('button[data-type="대장암검진-차수"]');

            ToggleButtonActive(차수Option, true);
            차수Option.textContent = 검사[examName]['차수'];
            차수Option.classList.add('selected');

            if (검사[examName]['차수'] === '2차') {
                const 장정결제Option = document.querySelector('button[data-type="대장암검진-장정결제"]');
                const 장정결제수령Option = document.querySelector('button[data-type="대장암검진-장정결제수령"]');

                ToggleButtonActive(장정결제Option, true);
                ToggleButtonActive(장정결제수령Option, true);

                장정결제Option.textContent = 검사['대장내시경']['장정결제'];
                장정결제수령Option.textContent = 검사['대장내시경']['장정결제수령'] ? '수령' : '미수령';

                장정결제Option.classList.add('selected');
                장정결제수령Option.classList.add('selected');
            }
        } else if (examName === '상복부초음파') {
            if (검사[examName]['검진'] === true) {
                // 간암검진 처리
                const 간암검진Button = document.querySelector('button[data-value="간암검진"]');
                간암검진Button.classList.add('selected');

                const 본인부담금Option = document.querySelector('button[data-type="간암검진-본인부담금"]');

                ToggleButtonActive(본인부담금Option, true);
                본인부담금Option.textContent = 검사[examName]['본인부담금'];
                본인부담금Option.classList.add('selected');
            } else {
                // 상복부초음파 처리
                const 상복부초음파Button = document.querySelector('button[data-value="상복부초음파"]');
                상복부초음파Button.classList.add('selected');
            }
        } else if (examName === '건강검진') {
            const 건강검진Button = document.querySelector('button[data-value="건강검진"]');
            건강검진Button.classList.add('selected');

            const 추가검진Options = 검사[examName]['추가검진'];
            for (let optionKey in 추가검진Options) {
                const optionButton = document.querySelector(`button[data-type="건강검진-${optionKey}"]`);
                if (optionButton) {
                    ToggleButtonActive(optionButton, true);
                    optionButton.classList.add('selected');
                }
            }
        } else {
            // 기타 검사 처리
            const mainButton = document.querySelector(`button[data-value='${examName}']`);
            if (mainButton) {
                mainButton.classList.add('selected');
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
}

// 현재 뷰 상태 저장 함수
function saveCurrentViewState() {
    if (calendar) {
        currentViewType = calendar.view.type;
        currentViewDate = calendar.getDate();
    }
}

// 검사 선택 함수
function getSelectedExams() {
    const 검사 = {};

    // 주요 검사 버튼 선택 상태 확인
    document.querySelectorAll('.btn-exam[data-value].selected').forEach(button => {
        const examName = button.getAttribute('data-value');

        if (examName === '건강검진') {
            // 건강검진 하위 항목 저장
            const 추가검진Options = document.querySelectorAll('.btn-exam[data-type^="건강검진-"].selected');
            if (추가검진Options.length > 0) {
                검사['건강검진'] = { '추가검진': {} };
                추가검진Options.forEach(option => {
                    const optionKey = option.getAttribute('data-type').split('-')[1];
                    검사['건강검진']['추가검진'][optionKey] = true;
                });
            }
        } else if (examName === '위암검진') {
            // 위암검진 저장 로직
            검사['위내시경'] = { '검진': true };

            // 본인부담금 저장
            const 본인부담금Option = document.querySelector('.btn-exam[data-type="위암검진-본인부담금"].selected');
            if (본인부담금Option) {
                검사['위내시경']['본인부담금'] = 본인부담금Option.textContent;
            }

            // 진정 여부 저장
            const 진정Option = document.querySelector('.btn-exam[data-type="위암검진-진정"].selected');
            if (진정Option) {
                검사['위내시경']['진정'] = 진정Option.textContent === '진정';
            }
        } else if (examName === '대장암검진') {
            // 대장암검진 저장 로직
            const 차수Option = document.querySelector('.btn-exam[data-type="대장암검진-차수"].selected');
            if (차수Option) {
                const 차수 = 차수Option.textContent;
                if (차수 === '1차') {
                    검사['대장암검진'] = { '차수': 차수 };
                } else if (차수 === '2차') {
                    검사['대장내시경'] = { '검진': true };

                    // 장정결제 저장
                    const 장정결제Option = document.querySelector('.btn-exam[data-type="대장암검진-장정결제"].selected');
                    if (장정결제Option) {
                        검사['대장내시경']['장정결제'] = 장정결제Option.textContent;
                    }

                    // 장정결제수령 저장
                    const 장정결제수령Option = document.querySelector('.btn-exam[data-type="대장암검진-장정결제수령"].selected');
                    if (장정결제수령Option) {
                        검사['대장내시경']['장정결제수령'] = 장정결제수령Option.textContent === '수령';
                    }
                }
            }
        } else if (examName === '간암검진') {
            // 간암검진 저장 로직
            검사['상복부초음파'] = { '검진': true };

            // 본인부담금 저장
            const 본인부담금Option = document.querySelector('.btn-exam[data-type="간암검진-본인부담금"].selected');
            if (본인부담금Option) {
                검사['상복부초음파']['본인부담금'] = 본인부담금Option.textContent;
            }
        } else if (examName === '위내시경') {
            // 위내시경 저장 로직
            검사['위내시경'] = {};

            // 진정 여부 저장
            const 진정Option = document.querySelector('.btn-exam[data-type="위내시경-진정"].selected');
            if (진정Option) {
                검사['위내시경']['진정'] = 진정Option.textContent === '진정';
            }
        } else if (examName === '대장내시경') {
            // 대장내시경 저장 로직
            검사['대장내시경'] = {};

            // 장정결제 저장
            const 장정결제Option = document.querySelector('.btn-exam[data-type="대장내시경-장정결제"].selected');
            if (장정결제Option) {
                검사['대장내시경']['장정결제'] = 장정결제Option.textContent;
            }

            // 장정결제수령 저장
            const 장정결제수령Option = document.querySelector('.btn-exam[data-type="대장내시경-장정결제수령"].selected');
            if (장정결제수령Option) {
                검사['대장내시경']['장정결제수령'] = 장정결제수령Option.textContent === '수령';
            }
        } else {
            // 기타 검사 저장
            검사[examName] = {};
        }
    });

    return 검사;
}

// 예약 등록 버튼 이벤트 리스너
registerBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    const time = timeInput.value;
    const 환자이름 = 환자이름Input.value;
    const 차트번호 = 차트번호Input.value;
    const 검사 = getSelectedExams();
    const 메모 = 메모Input.value;

    // 검사 객체에 필수 정보가 있는지 확인
    let isValid = true;

    // 필수 검사 목록과 해당 옵션
    const 필수검사옵션 = {
        '위암검진': ['위내시경', '본인부담금', '진정'],
        '위내시경': ['위내시경', '진정'],
        '대장암검진': ['대장암검진', '차수'],
        '대장내시경': ['대장내시경', '장정결제', '장정결제수령'],
        '간암검진': ['상복부초음파', '본인부담금']
    };

    // 필수 항목 검사
    for (let examName in 검사) {
        if (examName === '위내시경') {
            if (검사[examName]['검진'] === true) {
                if (!검사[examName]['본인부담금'] || 검사[examName]['진정'] === undefined) {
                    isValid = false;
                    break;
                }
            } else {
                if (검사[examName]['진정'] === undefined) {
                    isValid = false;
                    break;
                }
            }
        } else if (examName === '대장암검진') {
            if (!검사[examName]['차수']) {
                isValid = false;
                break;
            }
            if (검사[examName]['차수'] === '2차' && (!검사['대장내시경']['장정결제'] || 검사['대장내시경']['장정결제수령'] === undefined)) {
                isValid = false;
                break;
            }
        } else if (examName === '대장내시경') {
            if (!검사[examName]['장정결제'] || 검사[examName]['장정결제수령'] === undefined) {
                isValid = false;
                break;
            }
        } else if (examName === '상복부초음파') {
            if (검사[examName]['검진'] === true && !검사[examName]['본인부담금']) {
                isValid = false;
                break;
            }
        }
    }

    if (!time || !환자이름 || !차트번호 || Object.keys(검사).length === 0 || !isValid) {
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
                await addDoc(collection(db, '검사예약'), {
                    start: utcDate,
                    환자이름,
                    차트번호,
                    검사,
                    memo: 메모,
                    status: 'active'
                });

                Swal.fire('등록완료', '검사 예약이 성공적으로 등록되었습니다.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
                resetForm();
            } catch (error) {
                Swal.fire('오류', '검사 예약을 등록하는 과정에 문제가 있습니다.', 'error');
                console.error('Error adding document:', error);
            }
        }
    });
});

// 예약 수정 버튼 이벤트 리스너
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

    // 검사 객체에 필수 정보가 있는지 확인
    let isValid = true;

    // 필수 검사 목록과 해당 옵션
    const 필수검사옵션 = {
        '위암검진': ['위내시경', '본인부담금', '진정'],
        '위내시경': ['위내시경', '진정'],
        '대장암검진': ['대장암검진', '차수'],
        '대장내시경': ['대장내시경', '장정결제', '장정결제수령'],
        '간암검진': ['상복부초음파', '본인부담금']
    };

    // 필수 항목 검사
    for (let examName in 검사) {
        if (examName === '위내시경') {
            if (검사[examName]['검진'] === true) {
                if (!검사[examName]['본인부담금'] || 검사[examName]['진정'] === undefined) {
                    isValid = false;
                    break;
                }
            } else {
                if (검사[examName]['진정'] === undefined) {
                    isValid = false;
                    break;
                }
            }
        } else if (examName === '대장암검진') {
            if (!검사[examName]['차수']) {
                isValid = false;
                break;
            }
            if (검사[examName]['차수'] === '2차' && (!검사['대장내시경']['장정결제'] || 검사['대장내시경']['장정결제수령'] === undefined)) {
                isValid = false;
                break;
            }
        } else if (examName === '대장내시경') {
            if (!검사[examName]['장정결제'] || 검사[examName]['장정결제수령'] === undefined) {
                isValid = false;
                break;
            }
        } else if (examName === '상복부초음파') {
            if (검사[examName]['검진'] === true && !검사[examName]['본인부담금']) {
                isValid = false;
                break;
            }
        }
    }

    if (!time || !환자이름 || !차트번호 || Object.keys(검사).length === 0 || !isValid) {
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
                await updateDoc(doc(db, '검사예약', selectedEventId), {
                    start: utcDate,
                    환자이름,
                    차트번호,
                    검사,
                    memo: 메모
                });
                Swal.fire('수정 완료', '예약 수정이 성공적으로 완료되었습니다.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
                resetForm();
            } catch (error) {
                Swal.fire('수정 실패', '예약 수정 과정에 문제가 있습니다.', 'error');
                console.error('Error updating document:', error);
            }
        }
    });
});

// 예약 삭제 버튼 이벤트 리스너
deleteBtn.addEventListener('click', async () => {
    if (!selectedEventId) {
        Swal.fire('오류', '삭제할 검사를 선택하세요.', 'error');
        return;
    }

    Swal.fire({
        title: '예약 삭제 확인',
        text: '정말 이 예약을 삭제하시겠습니까?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '삭제',
        cancelButtonText: '취소'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await deleteDoc(doc(db, '검사예약', selectedEventId));
                Swal.fire('삭제 완료', '예약이 성공적으로 삭제되었습니다.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
                resetForm();
            } catch (error) {
                Swal.fire('삭제 실패', '예약 삭제 과정에 문제가 있습니다.', 'error');
                console.error('Error deleting document:', error);
            }
        }
    });
});

// 예약 취소 버튼 이벤트 리스너
cancelBtn.addEventListener('click', async () => {
    if (!selectedEventId) {
        Swal.fire('오류', '취소할 검사를 선택하세요.', 'error');
        return;
    }

    Swal.fire({
        title: '예약 취소 확인',
        text: '정말 이 예약을 취소하시겠습니까?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '취소',
        cancelButtonText: '취소 취소'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await updateDoc(doc(db, '검사예약', selectedEventId), {
                    status: 'canceled'
                });
                Swal.fire('취소 완료', '예약이 성공적으로 취소되었습니다.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
                resetForm();
            } catch (error) {
                Swal.fire('취소 실패', '예약 취소 과정에 문제가 있습니다.', 'error');
                console.error('Error updating document:', error);
            }
        }
    });
});

// 예약 복구 버튼 이벤트 리스너
restoreBtn.addEventListener('click', async () => {
    if (!selectedEventId) {
        Swal.fire('오류', '복구할 검사를 선택하세요.', 'error');
        return;
    }

    Swal.fire({
        title: '예약 복구 확인',
        text: '정말 이 예약을 복구하시겠습니까?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '복구',
        cancelButtonText: '취소'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                await updateDoc(doc(db, '검사예약', selectedEventId), {
                    status: 'active'
                });
                Swal.fire('복구 완료', '예약이 성공적으로 복구되었습니다.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
                resetForm();
            } catch (error) {
                Swal.fire('복구 실패', '예약 복구 과정에 문제가 있습니다.', 'error');
                console.error('Error updating document:', error);
            }
        }
    });
});

// 초기화 버튼 이벤트 리스너
resetBtn.addEventListener('click', resetForm);

// 폼 초기화 함수
function resetForm() {
    timeInput.value = '';
    환자이름Input.value = '';
    차트번호Input.value = '';
    메모Input.value = '';
    selectedEventId = null;
    selectedDate = new Date();

    document.querySelectorAll('.btn-exam').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.type) {
            btn.disabled = true;
            btn.classList.add('disabled');
        }
    });

    updateButtonStates();
}

// 버튼 상태 업데이트 함수
function updateButtonStates() {
    const anySelected = document.querySelector('.btn-exam.selected');
    if (anySelected) {
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

// DOMContentLoaded 이벤트 리스너
document.addEventListener('DOMContentLoaded', async function () {
    const events = await fetchEvents();
    renderCalendar(events);
    updateButtonStates();

    // 키보드 "delete" 키 이벤트 리스너 추가
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Delete' && selectedEventId) {
            // deleteBtn 클릭 이벤트 트리거
            deleteBtn.click();
        }
    });
});

document.addEventListener('DOMContentLoaded', function () {
    // 비활성화된 버튼이 selected 속성을 가지면 활성화
    document.querySelectorAll('.btn-exam').forEach(button => {
        button.addEventListener('click', function() {
            if (button.disabled && button.classList.contains('selected')) {
                ToggleButtonActive(button, true);
            }
        });
    });

    // 건강검진 버튼 클릭 시
    document.querySelector('button[data-value="건강검진"]').addEventListener('click', function() {
        const 건강검진Button = this;
        const relatedOptions = document.querySelectorAll('button[data-type^="건강검진-"]');

        // 건강검진 버튼 자체는 selected 토글
        건강검진Button.classList.toggle('selected');

        // 관련 옵션들은 활성화만
        const isSelected = 건강검진Button.classList.contains('selected');
        relatedOptions.forEach(opt => {
            ToggleButtonActive(opt, isSelected);
            if (!isSelected) {
                opt.classList.remove('selected');
            }
        });
    });

    // 건강검진 서브 옵션 클릭 시
    document.querySelectorAll('.btn-exam[data-type^="건강검진-"]').forEach(button => {
        button.addEventListener('click', function() {
            if (!this.disabled) {
                this.classList.toggle('selected');
                updateButtonStates();
            }
        });
    });

    // 위암검진 버튼 클릭 시
    document.querySelector('button[data-value="위암검진"]').addEventListener('click', function() {
        const 본인부담금Option = document.querySelector('button[data-type="위암검진-본인부담금"]');
        const 진정Option = document.querySelector('button[data-type="위암검진-진정"]');

        // 버튼과 옵션 모두 selected로
        this.classList.toggle('selected');
        const isSelected = this.classList.contains('selected');
        본인부담금Option.classList.toggle('selected', isSelected);
        진정Option.classList.toggle('selected', isSelected);

        // 옵션 활성화 상태 설정
        ToggleButtonActive(본인부담금Option, isSelected);
        ToggleButtonActive(진정Option, isSelected);
    });

    // 위암검진-본인부담금 버튼 클릭 시
    document.querySelector('button[data-type="위암검진-본인부담금"]').addEventListener('click', function() {
        toggleOptionsText(this, ['0%', '10%']);
        this.classList.add('selected');
    });

    // 위암검진-진정 버튼 클릭 시
    document.querySelector('button[data-type="위암검진-진정"]').addEventListener('click', function() {
        toggleOptionsText(this, ['진정', '비진정']);
        this.classList.add('selected');
    });

    // 위내시경 버튼 클릭 시
    document.querySelector('button[data-value="위내시경"]').addEventListener('click', function() {
        const 진정Option = document.querySelector('button[data-type="위내시경-진정"]');

        // 버튼과 옵션 모두 selected로
        this.classList.toggle('selected');
        const isSelected = this.classList.contains('selected');
        진정Option.classList.toggle('selected', isSelected);

        // 옵션 활성화 상태 설정
        ToggleButtonActive(진정Option, isSelected);
    });

    // 위내시경-진정 버튼 클릭 시
    document.querySelector('button[data-type="위내시경-진정"]').addEventListener('click', function() {
        toggleOptionsText(this, ['진정', '비진정']);
        this.classList.add('selected');
    });

// 대장암검진 버튼 클릭 시
document.querySelector('button[data-value="대장암검진"]').addEventListener('click', function() {
    const 차수Option = document.querySelector('button[data-type="대장암검진-차수"]');
    const 장정결제Option = document.querySelector('button[data-type="대장암검진-장정결제"]');
    const 장정결제수령Option = document.querySelector('button[data-type="대장암검진-장정결제수령"]');

    // 버튼 selected 토글
    this.classList.toggle('selected');
    const isSelected = this.classList.contains('selected');

    // 차수 옵션 활성화 상태 설정 및 selected 토글
    ToggleButtonActive(차수Option, isSelected);
    차수Option.classList.toggle('selected', isSelected);

    if (!isSelected) {
        // 대장암검진 버튼이 선택 해제되면 모든 관련 옵션 비활성화 및 selected 해제
        ToggleButtonActive(장정결제Option, false);
        ToggleButtonActive(장정결제수령Option, false);
        차수Option.classList.remove('selected');
        장정결제Option.classList.remove('selected');
        장정결제수령Option.classList.remove('selected');
    } else if (차수Option.textContent === '2차') {
        // 차수가 '2차'인 경우 장정결제 및 장정결제수령 옵션 활성화
        ToggleButtonActive(장정결제Option, true);
        ToggleButtonActive(장정결제수령Option, true);
        장정결제Option.classList.add('selected');
        장정결제수령Option.classList.add('selected');
    }
});

// 대장암검진-차수 버튼 클릭 시
document.querySelector('button[data-type="대장암검진-차수"]').addEventListener('click', function() {
    toggleOptionsText(this, ['1차', '2차']);
    this.classList.add('selected');

    const 장정결제Option = document.querySelector('button[data-type="대장암검진-장정결제"]');
    const 장정결제수령Option = document.querySelector('button[data-type="대장암검진-장정결제수령"]');

    if (this.textContent === '2차') {
        // 차수가 '2차'인 경우 옵션 활성화 및 selected 설정
        ToggleButtonActive(장정결제Option, true);
        ToggleButtonActive(장정결제수령Option, true);
        장정결제Option.classList.add('selected');
        장정결제수령Option.classList.add('selected');
    } else {
        // 차수가 '1차'인 경우 옵션 비활성화 및 selected 해제
        ToggleButtonActive(장정결제Option, false);
        ToggleButtonActive(장정결제수령Option, false);
        장정결제Option.classList.remove('selected');
        장정결제수령Option.classList.remove('selected');
    }
});

    // 대장암검진-장정결제 버튼 클릭 시
    document.querySelector('button[data-type="대장암검진-장정결제"]').addEventListener('click', function() {
        toggleOptionsText(this, ['2L', '오라팡', '수프렙']);
        this.classList.add('selected');
    });

    // 대장암검진-장정결제수령 버튼 클릭 시
    document.querySelector('button[data-type="대장암검진-장정결제수령"]').addEventListener('click', function() {
        toggleOptionsText(this, ['미수령', '수령']);
        this.classList.add('selected');
    });

    // 대장내시경 버튼 클릭 시
    document.querySelector('button[data-value="대장내시경"]').addEventListener('click', function() {
        const 장정결제Option = document.querySelector('button[data-type="대장내시경-장정결제"]');
        const 장정결제수령Option = document.querySelector('button[data-type="대장내시경-장정결제수령"]');

        // 버튼과 옵션 모두 selected로
        this.classList.toggle('selected');
        const isSelected = this.classList.contains('selected');
        장정결제Option.classList.toggle('selected', isSelected);
        장정결제수령Option.classList.toggle('selected', isSelected);

        // 옵션 활성화 상태 설정
        ToggleButtonActive(장정결제Option, isSelected);
        ToggleButtonActive(장정결제수령Option, isSelected);
    });

    // 대장내시경-장정결제 버튼 클릭 시
    document.querySelector('button[data-type="대장내시경-장정결제"]').addEventListener('click', function() {
        toggleOptionsText(this, ['2L', '오라팡', '수프렙']);
        this.classList.add('selected');
    });

    // 대장내시경-장정결제수령 버튼 클릭 시
    document.querySelector('button[data-type="대장내시경-장정결제수령"]').addEventListener('click', function() {
        toggleOptionsText(this, ['미수령', '수령']);
        this.classList.add('selected');
    });

    // 간암검진 버튼 클릭 시
    document.querySelector('button[data-value="간암검진"]').addEventListener('click', function() {
        const 본인부담금Option = document.querySelector('button[data-type="간암검진-본인부담금"]');

        // 버튼과 옵션 모두 selected로
        this.classList.toggle('selected');
        const isSelected = this.classList.contains('selected');
        본인부담금Option.classList.toggle('selected', isSelected);

        // 옵션 활성화 상태 설정
        ToggleButtonActive(본인부담금Option, isSelected);
    });

    // 간암검진-본인부담금 버튼 클릭 시
    document.querySelector('button[data-type="간암검진-본인부담금"]').addEventListener('click', function() {
        toggleOptionsText(this, ['0%', '10%']);
        this.classList.add('selected');
    });

    // 기타 검사 버튼 클릭 시
    const 기타검사Buttons = [
        '상복부초음파', '갑상선초음파', '경동맥초음파', '일반채용',
        '공무원채용', '단순결핵', '잠복결핵', '보건증', 'TBPE',
        '요단백', '당화혈색소', '골밀도검사'
    ];

    기타검사Buttons.forEach(exam => {
        const button = document.querySelector(`button[data-value="${exam}"]`);
        if (button) {
            button.addEventListener('click', function() {
                this.classList.toggle('selected');
                updateButtonStates();
            });
        }
    });
});