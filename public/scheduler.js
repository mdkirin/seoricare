// scheduler.js
import { db, handleLogout, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, onAuthStateChanged } from './firebase.js'; // Import Firebase services and logout function

let calendar; // Declare calendar as a global variable
let selectedEventId = null;
let currentViewType = 'dayGridMonth'; // Default view type
let currentViewDate = new Date(); // Default to today's date
let selectedDate = new Date(); // Default to today's date

// DOM elements
const registerBtn = document.getElementById('registerBtn');
const updateBtn = document.getElementById('updateBtn');
const deleteBtn = document.getElementById('deleteBtn');
const cancelBtn = document.getElementById('cancelBtn');
const restoreBtn = document.getElementById('restoreBtn');
const timeInput = document.getElementById('time');
const patientNameInput = document.getElementById('patientName');
const chartNumberInput = document.getElementById('chartNumber');
const examTypeInput = document.getElementById('examType');
const memoInput = document.getElementById('memo');
const logoutBtn = document.getElementById('logoutBtn'); // Logout button

// Adding event listener for logout button
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
}

// 예약 시각 필드에 Flatpickr 적용
initializeFlatpickr();

function initializeFlatpickr() {
    flatpickr("#time", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        minuteIncrement: 30,
        defaultDate: timeInput.value || "09:00", // 초기값 설정
        onOpen: function (selectedDates, dateStr, instance) {
            const defaultTime = selectedDate ? selectedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) : "09:00";
            instance.setDate(defaultTime, false); // 두 번째 인자를 false로 설정하여 onChange 트리거 방지
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
            },
            eventDrop: async function (info) {
                const eventObj = info.event;
                selectedEventId = eventObj.id;
                const originalDate = info.oldEvent.start;

                const beforeData = `시각: ${originalDate.toLocaleString()}`;
                const afterData = `새 시각: ${eventObj.start.toLocaleString()}`;

                showConfirmationDialog(beforeData, afterData, async () => {
                    try {
                        await updateDoc(doc(db, 'appointments', selectedEventId), {
                            start: eventObj.start,
                        });
                    } catch (error) {
                        Swal.fire('Error', 'There was an issue moving the event.', 'error');
                        console.error('Error updating event:', error);
                        info.revert();
                    }
                });
            },
            viewDidMount: function () {
                currentViewType = calendar.view.type;
                currentViewDate = calendar.getDate();
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

document.addEventListener('DOMContentLoaded', async function () {
    const events = await fetchEvents();
    renderCalendar(events);
});

registerBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    const time = timeInput.value;
    const patientName = patientNameInput.value;
    const chartNumber = chartNumberInput.value;
    const examType = examTypeInput.value;
    const memo = memoInput.value;

    if (!time || !patientName || !chartNumber) {
        Swal.fire('Error', 'Please fill in all required fields.', 'error');
        return;
    }

    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    const utcDate = new Date(selectedDate.toISOString());

    const beforeData = "기존 데이터 없음"; // 신규 등록이므로 기존 데이터가 없음
    const afterData = `예약 시각: ${utcDate.toLocaleString()} / 환자: ${patientName} / 차트 번호: ${chartNumber} / 검사 종류: ${examType}`;

    showConfirmationDialog(beforeData, afterData, async () => {
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
    const examType = examTypeInput.value;
    const memo = memoInput.value;

    if (!time || !patientName || !chartNumber) {
        Swal.fire('Error', 'Please fill in all required fields.', 'error');
        return;
    }

    const [hours, minutes] = time.split(":");
    selectedDate.setHours(hours);
    selectedDate.setMinutes(minutes);

    const utcDate = new Date(selectedDate.toISOString());

    const beforeData = `시각: ${currentViewDate.toLocaleString()} / 환자: ${patientName} / 차트 번호: ${chartNumber} / 검사 종류: ${examType}`;
    const afterData = `새 시각: ${utcDate.toLocaleString()} / 환자: ${patientName} / 차트 번호: ${chartNumber} / 검사 종류: ${examType}`;

    showConfirmationDialog(beforeData, afterData, async () => {
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
    });
});

deleteBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    if (selectedEventId) {
        const beforeData = `예약 ID: ${selectedEventId} 삭제 예정`;

        showConfirmationDialog(beforeData, "삭제됨", async () => {
            try {
                await deleteDoc(doc(db, 'appointments', selectedEventId));
                Swal.fire('Success', 'Appointment deleted successfully.', 'success');
                const events = await fetchEvents();
                renderCalendar(events);
            } catch (error) {
                Swal.fire('Error', 'There was an issue deleting the appointment.', 'error');
            }
        });
    } else {
        Swal.fire('Error', 'Please select an appointment to delete.', 'error');
    }
});

cancelBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    if (selectedEventId) {
        const beforeData = `예약 ID: ${selectedEventId} 활성화`;
        const afterData = "취소됨";

        showConfirmationDialog(beforeData, afterData, async () => {
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
        });
    } else {
        Swal.fire('Error', 'Please select an appointment to cancel.', 'error');
    }
});

restoreBtn.addEventListener('click', async () => {
    saveCurrentViewState();

    if (selectedEventId) {
        const beforeData = "취소됨";
        const afterData = `예약 ID: ${selectedEventId} 활성화`;

        showConfirmationDialog(beforeData, afterData, async () => {
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
        });
    } else {
        Swal.fire('Error', 'Please select an appointment to restore.', 'error');
    }
});

function showConfirmationDialog(beforeData, afterData, callback) {
    Swal.fire({
        title: '변경 확인',
        html: `<strong>변경 전:</strong><br>${beforeData}<br><br><strong>변경 후:</strong><br>${afterData}`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '확인',
        cancelButtonText: '취소'
    }).then((result) => {
        if (result.isConfirmed) {
            callback();
        }
    });
}
