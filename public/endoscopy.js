import { db, handleLogout, collection, getDocs, updateDoc, doc, query, where, addDoc, getDoc } from './firebase.js';

let selectedAppointment = null;

document.addEventListener('DOMContentLoaded', () => {
    const dateSelect = document.getElementById('date-select');
    const logoutBtn = document.getElementById('logoutBtn');

    dateSelect.value = new Date().toISOString().split('T')[0];
    dateSelect.addEventListener('change', loadAppointments);
    logoutBtn.addEventListener('click', handleLogout);

    loadAppointments();
});

async function loadAppointments() {
    const dateSelect = document.getElementById('date-select');
    const selectedDate = dateSelect.value;
    const appointmentTable = document.getElementById('appointment-table').getElementsByTagName('tbody')[0];
    appointmentTable.innerHTML = '';

    const q = query(collection(db, '검사예약'), where('date', '==', selectedDate));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.검사 && (data.검사.위내시경 || data.검사.대장내시경)) {
            const row = appointmentTable.insertRow();
            row.innerHTML = `
                <td class="py-2 px-4 border-b">${data.time}</td>
                <td class="py-2 px-4 border-b">${data.환자이름}</td>
                <td class="py-2 px-4 border-b">${data.검사.위내시경 ? '위내시경' : ''}${data.검사.위내시경 && data.검사.대장내시경 ? ', ' : ''}${data.검사.대장내시경 ? '대장내시경' : ''}</td>
                <td class="py-2 px-4 border-b">
                    <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded focus:outline-none focus:shadow-outline" onclick="showExamDetailForm('${doc.id}')">
                        상세 정보 입력
                    </button>
                </td>
            `;
        }
    });
}

window.showExamDetailForm = function(appointmentId) {
    selectedAppointment = appointmentId;
    document.getElementById('exam-detail-form').classList.remove('hidden');
    document.getElementById('exam-summary').classList.add('hidden');

    // CLO 검사 옵션 표시 여부 설정
    getAppointmentById(appointmentId).then(appointment => {
        if (appointment && appointment.검사.위내시경) {
            document.getElementById('clo-test-container').classList.remove('hidden');
        } else {
            document.getElementById('clo-test-container').classList.add('hidden');
        }
    });
}

document.getElementById('save-exam-detail').addEventListener('click', saveExamDetail);

function saveExamDetail() {
    const midazolam = document.getElementById('midazolam').value;
    const propofol = document.getElementById('propofol').value;
    const pethidine = document.getElementById('pethidine').value;
    const biopsyCount = document.getElementById('biopsy-count').value;
    const cloTest = document.getElementById('clo-test').value;

    const summaryContent = document.getElementById('summary-content');
    summaryContent.innerHTML = `
        <p><strong>미다졸람:</strong> ${midazolam} mg</p>
        <p><strong>프로포폴:</strong> ${propofol} mg</p>
        <p><strong>페티딘:</strong> ${pethidine} mg</p>
        <p><strong>조직검사 갯수:</strong> ${biopsyCount}</p>
        ${cloTest !== 'hidden' ? `<p><strong>CLO 검사:</strong> ${cloTest === 'yes' ? '예' : '아니오'}</p>` : ''}
    `;

    document.getElementById('exam-detail-form').classList.add('hidden');
    document.getElementById('exam-summary').classList.remove('hidden');
}

document.getElementById('confirm-exam-detail').addEventListener('click', confirmExamDetail);

async function confirmExamDetail() {
    const midazolam = document.getElementById('midazolam').value;
    const propofol = document.getElementById('propofol').value;
    const pethidine = document.getElementById('pethidine').value;
    const biopsyCount = document.getElementById('biopsy-count').value;
    const cloTest = document.getElementById('clo-test').value;

    const examDetails = {
        midazolam: parseFloat(midazolam),
        propofol: parseFloat(propofol),
        pethidine: parseFloat(pethidine),
        biopsyCount: parseInt(biopsyCount),
        cloTest: cloTest === 'yes'
    };

    try {
        const appointmentRef = doc(db, '검사예약', selectedAppointment);
        await updateDoc(appointmentRef, { examDetails: examDetails });

        // 내시경_소독일지 업데이트
        await updateEndoscopyDisinfectionLog(selectedAppointment, examDetails);

        showalert('검사 상세 정보가 저장되었습니다.');
        document.getElementById('exam-summary').classList.add('hidden');
        loadAppointments();
    } catch (error) {
        console.error('Error updating document: ', error);
        showalert('검사 상세 정보 저장 중 오류가 발생했습니다.');
    }
}

document.getElementById('edit-exam-detail').addEventListener('click', () => {
    document.getElementById('exam-summary').classList.add('hidden');
    document.getElementById('exam-detail-form').classList.remove('hidden');
});

async function updateEndoscopyDisinfectionLog(appointmentId, examDetails) {
    const appointment = await getAppointmentById(appointmentId);
    if (!appointment) return;

    const logEntry = {
        date: appointment.date,
        time: appointment.time,
        patientName: appointment.환자이름,
        examType: appointment.검사.위내시경 ? '위내시경' : '대장내시경',
        midazolam: examDetails.midazolam,
        propofol: examDetails.propofol,
        pethidine: examDetails.pethidine,
        biopsyCount: examDetails.biopsyCount,
        cloTest: examDetails.cloTest
    };

    try {
        const logRef = collection(db, '내시경_소독일지');
        await addDoc(logRef, logEntry);
    } catch (error) {
        console.error('Error updating endoscopy disinfection log: ', error);
        showalert('내시경 소독일지 업데이트 중 오류가 발생했습니다.');
    }
}

async function getAppointmentById(appointmentId) {
    const appointmentRef = doc(db, '검사예약', appointmentId);
    const appointmentSnap = await getDoc(appointmentRef);
    return appointmentSnap.exists() ? appointmentSnap.data() : null;
}

function showalert(message) {
    const alertElement = document.getElementById('custom-alert');
    const alertMessage = document.getElementById('alert-message');
    alertMessage.textContent = message;
    alertElement.classList.add('opacity-100');
    setTimeout(() => {
        alertElement.classList.remove('opacity-100');
    }, 3000);
}
