// scheduler.js
import { db, handleLogout, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from './firebase.js'; // Import Firebase services and logout function

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
flatpickr("#time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 30,
    defaultDate: timeInput.value // 현재 입력된 시간을 기본값으로 설정
});

function initializeFlatpickr() {
    flatpickr("#time", {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        minuteIncrement: 30,
        defaultDate: timeInput.value || "09:00", // 초기값 설정
        onOpen: function(selectedDates, dateStr, instance) {
            // 타임피커가 열릴 때 기본값을 selectedDate로 설정
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
                        status: data.status || 'active' // Default status
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
        // Only initialize the calendar if it doesn't exist
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: currentViewType, // Use stored view type
            initialDate: currentViewDate, // Use stored date
            navLinks: true, // Enable clickable dates
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
            navLinkDayClick: function(date, jsEvent) {
                currentViewDate = date; // Update the current view date
                selectedDate = date; // Ensure selectedDate is updated
                calendar.changeView('timeGridDay', currentViewDate); // Switch to day view
            },
            weekNumbers: true,
            navLinkWeekClick: function(weekStart, jsEvent) {
                currentViewDate = weekStart; // Update the current view date
                selectedDate = weekStart; // Ensure selectedDate is updated
                calendar.changeView('timeGridWeek', currentViewDate); // Switch to week view
            },
            select: function(info) {
                selectedDate = info.start; // Set selected date on select
                timeInput.value = info.startStr.substring(11, 16);
                selectedEventId = null;
                registerBtn.classList.remove('hidden');
                updateBtn.classList.add('hidden');
            },
            eventClick: function(info) {
                const eventObj = info.event;
                selectedEventId = eventObj.id;
                selectedDate = eventObj.start; // Update selected date on event click
                currentViewDate = eventObj.start; // Update view date

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

                initializeFlatpickr();


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
            eventDidMount: function(info) {
                if (info.event.extendedProps.status === 'canceled') {
                    info.el.style.textDecoration = 'line-through';
                    info.el.style.textDecorationThickness = '3px';
                    info.el.style.color = 'gray';
                }
            },
            eventDrop: async function(info) {
                const eventObj = info.event;
                selectedEventId = eventObj.id;

                try {
                    await updateDoc(doc(db, 'appointments', selectedEventId), {
                        start: eventObj.start,
                    });
                } catch (error) {
                    Swal.fire('Error', 'There was an issue moving the event.', 'error');
                    console.error('Error updating event:', error);
                    info.revert();
                }
            },
            viewDidMount: function() {
                // Save current view type and date on view change
                currentViewType = calendar.view.type;
                currentViewDate = calendar.getDate();
            }
        });

        calendar.render(); // Render the calendar
    } else {
        calendar.removeAllEvents(); // Clear existing events
        calendar.addEventSource(events); // Add new events
    }
}

function saveCurrentViewState() {
    if (calendar) {
        currentViewType = calendar.view.type;
        currentViewDate = calendar.getDate();
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    const events = await fetchEvents(); // Fetch events from Firestore
    initializeFlatpickr();
    renderCalendar(events); // Render the calendar
});

// Event listener for registration
registerBtn.addEventListener('click', async () => {
    saveCurrentViewState(); // Save view state

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

    try {
        await addDoc(collection(db, 'appointments'), {
            start: utcDate,
            patientName,
            chartNumber,
            examType,
            memo
        });

        Swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Appointment registered successfully.',
            showConfirmButton: false,
            timer: 1000,
        }).then(async () => {
            const events = await fetchEvents();
            renderCalendar(events); // Refresh calendar without reloading
        });

    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'There was an issue registering the appointment.',
            showConfirmButton: false,
            timer: 1000,
        });
    }
});

// Event listener for update
updateBtn.addEventListener('click', async () => {
    saveCurrentViewState(); // Save view state

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

    try {
        await updateDoc(doc(db, 'appointments', selectedEventId), {
            start: utcDate,
            patientName,
            chartNumber,
            examType,
            memo
        });
        Swal.fire('Success', 'Appointment updated successfully.', 'success').then(async () => {
            const events = await fetchEvents();
            renderCalendar(events); // Refresh calendar without reloading
        });
    } catch (error) {
        Swal.fire('Error', 'There was an issue updating the appointment.', 'error');
    }
});

// Event listeners for deletion and cancellation...
deleteBtn.addEventListener('click', async () => {
    saveCurrentViewState(); // Save view state

    if (selectedEventId) {
        try {
            await deleteDoc(doc(db, 'appointments', selectedEventId));
            Swal.fire('Success', 'Appointment deleted successfully.', 'success').then(async () => {
                const events = await fetchEvents();
                renderCalendar(events); // Refresh calendar without reloading
            });
        } catch (error) {
            Swal.fire('Error', 'There was an issue deleting the appointment.', 'error');
        }
    } else {
        Swal.fire('Error', 'Please select an appointment to delete.', 'error');
    }
});

cancelBtn.addEventListener('click', async () => {
    saveCurrentViewState(); // Save view state

    if (selectedEventId) {
        try {
            await updateDoc(doc(db, 'appointments', selectedEventId), {
                status: 'canceled'
            });
            Swal.fire('Success', 'Appointment canceled successfully.', 'success').then(async () => {
                const events = await fetchEvents();
                renderCalendar(events); // Refresh calendar without reloading
            });
        } catch (error) {
            Swal.fire('Error', 'There was an issue canceling the appointment.', 'error');
        }
    } else {
        Swal.fire('Error', 'Please select an appointment to cancel.', 'error');
    }
});

restoreBtn.addEventListener('click', async () => {
    saveCurrentViewState(); // Save view state

    if (selectedEventId) {
        try {
            await updateDoc(doc(db, 'appointments', selectedEventId), {
                status: 'active'
            });
            Swal.fire({
                icon: 'success',
                title: '복구 성공',
                text: '검사 예약이 복구되었습니다.',
                showConfirmButton: false,
                timer: 1000,
            }).then(async () => {
                const events = await fetchEvents();
                renderCalendar(events); // Refresh calendar without reloading
            });
        } catch (error) {
            Swal.fire('오류', '검사 예약 복구 중 문제가 발생했습니다.', 'error');
        }
    } else {
        Swal.fire('오류', '복구할 예약을 선택하세요.', 'error');
    }
});
