import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

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
let currentView = 'timeGridWeek'; // Current view state
let selectedDate = new Date(); // Initially set to today's date

// DOM elements
const appointmentForm = document.getElementById('appointmentForm');
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

// Logout function
function handleLogout() {
    signOut(auth).then(() => {
        window.location.href = 'login.html'; // Redirect to login on successful logout
    }).catch((error) => {
        console.error('Error during logout:', error);
    });
}

// Adding event listener for logout button
if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
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
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: currentView,
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
            selectedDate = date; // Update the selected date
            calendar.changeView('timeGridDay', selectedDate); // Switch to day view
            console.log('Navigating to selected date:', selectedDate);
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
            selectedDate = eventObj.start; // Update selected date on event click
        
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
        }
    });

    calendar.render();
}

document.addEventListener('DOMContentLoaded', async function () {
    const events = await fetchEvents(); // Fetch events from Firestore
    renderCalendar(events); // Render the calendar
});

// Event listener for registration
registerBtn.addEventListener('click', async () => {
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

        // SweetAlert2 with auto-close
        Swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Appointment registered successfully.',
            showConfirmButton: false,
            timer: 1000,
            showClass: {
                popup: 'swal2-fade-in' // Use custom fade-in class
            },
            hideClass: {
                popup: 'swal2-fade-out' // Use custom fade-out class
            }
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
            showClass: {
                popup: 'swal2-fade-in' // Use custom fade-in class
            },
            hideClass: {
                popup: 'swal2-fade-out' // Use custom fade-out class
            }
        });
    }
});

// Event listener for update
updateBtn.addEventListener('click', async () => {
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
                showClass: {
                    popup: 'swal2-fade-in'
                },
                hideClass: {
                    popup: 'swal2-fade-out'
                }
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


// Authentication state listener
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('userStatus').innerText = `${user.email}님 환영합니다.`;
    } else {
        window.location.href = 'login.html'; // Redirect to login if not authenticated
    }
});

