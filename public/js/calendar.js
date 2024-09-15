import { db } from './firebase-config.js';
import { fetchEvents } from './event-handlers.js';

let calendar;
let currentViewType = 'timeGridWeek';
let currentViewDate = new Date();

async function renderCalendar() {
    const events = await fetchEvents();
    const calendarEl = document.getElementById('calendar');
    
    if (!calendar) {
        calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: currentViewType,
            initialDate: currentViewDate,
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

document.addEventListener('DOMContentLoaded', renderCalendar);
