import { db } from './firebase-config.js';
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

let selectedEventId = null;

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

// Add CRUD event listeners and handlers here
document.addEventListener('DOMContentLoaded', async function () {
    const events = await fetchEvents(); // Fetch events from Firestore
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

function saveCurrentViewState() {
    if (calendar) {
        currentViewType = calendar.view.type;
        currentViewDate = calendar.getDate();
    }
}

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

export { fetchEvents };
