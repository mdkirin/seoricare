flatpickr("#time", {
    enableTime: true,
    noCalendar: true,
    dateFormat: "H:i",
    time_24hr: true,
    minuteIncrement: 30,
    defaultDate: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
});
