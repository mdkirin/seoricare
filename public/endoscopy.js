import { 
    db, 
    auth, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    Timestamp, 
    onAuthStateChanged, 
    signOut, 
    doc, 
    getDoc, 
    updateDoc
} from './firebase.js';

// 모달 관련 변수들
let selectedDate = null;
let selectedExams = []; // 선택된 검사 목록
let medicationData = {};
let additionalTests = [];
let cleaningInfo = {};
let selectedExamIds = []; // 선택된 예약 문서 ID 목록

// 스크롤 이동 함수
function scrollToStep(step) {
    const section = document.getElementById(`step-${step}`);
    section.scrollIntoView({ behavior: 'smooth' });
    updateActiveDot(step);
}

// 도트 네비게이션 업데이트 함수
function updateActiveDot(step) {
    document.querySelectorAll('.dot').forEach(dot => {
        dot.classList.remove('active');
    });
    document.querySelector(`.dot[data-step="${step}"]`).classList.add('active');
}

// 검사 목록 불러오기 함수
async function loadExams() {
    const examTableBody = document.querySelector('#exam-table tbody');
    examTableBody.innerHTML = ''; // 기존 내용 초기화

    const selectedDateStart = new Date(selectedDate);
    const selectedDateEnd = new Date(selectedDate);
    selectedDateEnd.setDate(selectedDateEnd.getDate() + 1);

    const q = query(
        collection(db, '검사예약'),
        where('start', '>=', Timestamp.fromDate(selectedDateStart)),
        where('start', '<', Timestamp.fromDate(selectedDateEnd))
    );

    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('불러온 문서 데이터:', data); // 콘솔 로그 추가
        const examType = Object.keys(data.검사)[0]; // 첫 번째 검사 종류 가져오기
        const examData = data.검사[examType];

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-4 py-2">${data.start.toDate().toLocaleTimeString()}</td>
            <td class="px-4 py-2">${data.환자이름 || 'N/A'}</td>
            <td class="px-4 py-2">${examType}</td>
            <td class="px-4 py-2">${examData.검진 ? '예' : '아니오'}</td>
            <td class="px-4 py-2">${examData.진정 ? '예' : '아니오'}</td>
        `;
        row.classList.add('btn-exam');
        row.setAttribute('data-value', JSON.stringify({ docId: doc.id, examType }));
        examTableBody.appendChild(row);
    });

    // 검��� 선택 버튼의 이벤트 리스너 설정
    document.querySelectorAll('.btn-exam[data-value]').forEach(button => {
        button.addEventListener('click', function() {
            this.classList.toggle('selected');
            this.classList.toggle('bg-blue-200'); // 선택된 항목에 배경색 추가
            updateSelectedExams();
        });
    });
}

// 단계별 함수들

// 1단계: 검사 선택으로 이동
function toExamSelection() {
    const dateInput = document.getElementById('selected-date');
    if (dateInput && dateInput.value) {
        selectedDate = dateInput.value;
        console.log('선택된 날짜:', selectedDate); // 콘솔 로그 추가
        document.getElementById('selected-date-display').textContent = `선택된 날짜: ${selectedDate}`;
        scrollToStep(2);

        // 검사 목록 불러오기
        loadExams();
    } else {
        alert('날짜를 선택해주세요.');
    }
}

// 2단계: 약물 입력으로 이동
function toMedicationInput() {
    console.log('선택된 검사 목록:', selectedExams); // 콘솔 로그 추가
    if (selectedExams.length > 0) {
        scrollToStep(3);
    } else {
        alert('최소 하나의 검사를 선택해주세요.');
    }
}

// 3단계: 추가검사 입력으로 이동
function toAdditionalTests() {
    // 약물 데이터 저장
    const midazolam = document.getElementById('midazolam').value;
    const propofol = document.getElementById('propofol').value;
    const pethidine = document.getElementById('pethidine').value;

    medicationData = { midazolam, propofol, pethidine };

    // 선택된 검사에 따라 추가검사 모달 내용 업데이트
    const gastroscopyInputs = document.getElementById('gastroscopy-inputs');
    const colonoscopyInputs = document.getElementById('colonoscopy-inputs');
    const biopsyLocationsDiv = document.getElementById('biopsy-locations');

    // 초기화
    gastroscopyInputs.style.display = 'none';
    colonoscopyInputs.style.display = 'none';
    biopsyLocationsDiv.innerHTML = '';

    // 선택된 검사에 따라 입력 필드 표시
    selectedExams.forEach(exam => {
        if (exam.examType === '위내시경') {
            gastroscopyInputs.style.display = 'block';
        }
        if (exam.examType === '대장내시경') {
            colonoscopyInputs.style.display = 'block';

            // 대장내시경 조직검사 개수 입력 이벤트 리스너 추가
            const biopsyCountInput = document.getElementById('biopsy-count');
            biopsyCountInput.removeEventListener('input', handleBiopsyCountInput);
            biopsyCountInput.addEventListener('input', handleBiopsyCountInput);
        }
    });

    scrollToStep(4);
}

function handleBiopsyCountInput() {
    const count = parseInt(this.value) || 0;
    const biopsyLocationsDiv = document.getElementById('biopsy-locations');
    biopsyLocationsDiv.innerHTML = ''; // 기존 내용 초기화

    for (let i = 1; i <= count; i++) {
        const locationValue = document.getElementById(`biopsy-location-${i}`).value;
        if (locationValue) {
            biopsyLocations.push(locationValue);
        }
    }
}

// 4단계: 세척 정보 입력으로 이동
function toCleaningInfo() {
    scrollToStep(5);
}

// 5단계: 데이터 제출
async function submitAllData() {
    if (selectedExamIds.length === 0) {
        alert('검사를 선택해주세요.');
        return;
    }

    try {
        for (const exam of selectedExams) {
            const { docId, examType } = exam;
            const appointmentDocRef = doc(db, '검사예약', docId);
            const appointmentDocSnap = await getDoc(appointmentDocRef);

            if (appointmentDocSnap.exists()) {
                const appointmentData = appointmentDocSnap.data();

                const updatedData = {};

                // 진정약물 추가
                updatedData[`검사.${examType}.진정약물`] = medicationData;

                // 추가검사 정보 업데이트
                if (examType === '위내시경') {
                    const cloTest = document.getElementById('clo-test').checked;
                    const gastroscopyBiopsyCount = parseInt(document.getElementById('gastroscopy-biopsy-count').value) || 0;
                    updatedData[`검사.${examType}.CLO검사`] = cloTest;
                    updatedData[`검사.${examType}.위조직검사개수`] = gastroscopyBiopsyCount;
                } else if (examType === '대장내시경') {
                    const polypectomy = document.getElementById('polypectomy').checked;
                    const biopsyCount = parseInt(document.getElementById('biopsy-count').value) || 0;
                    const biopsyLocations = [];
                    for (let i = 1; i <= biopsyCount; i++) {
                        const locationValue = document.getElementById(`biopsy-location-${i}`).value;
                        if (locationValue) {
                            biopsyLocations.push(locationValue);
                        }
                    }
                    updatedData[`검사.${examType}.용종절제술`] = polypectomy;
                    updatedData[`검사.${examType}.대장조직검사개수`] = biopsyCount;
                    updatedData[`검사.${examType}.조직검사위치`] = biopsyLocations;
                }

                // 데이터베이스 업데이트
                console.log(`업데이트할 데이터 (${docId}, ${examType}):`, updatedData);
                await updateDoc(appointmentDocRef, updatedData);

                // 마약류 재고량 차감
                await updateDrugInventory(medicationData);
            }
        }
        alert('데이터가 성공적으로 저장되었습니다.');
    } catch (error) {
        console.error('데이터 저장 중 오류 발생:', error);
        alert('데이터 저장 중 오류가 발생했습니다.');
    }
}

// 마약류 재고량 차감 함수
async function updateDrugInventory(medicationData) {
    const drugCollection = collection(db, '마약류_저장소');
    const drugs = ['midazolam', 'propofol', 'pethidine'];

    for (const drug of drugs) {
        const usedAmount = parseFloat(medicationData[drug]) || 0;
        if (usedAmount > 0) {
            const q = query(drugCollection, where('제품명', '==', drug));
            const querySnapshot = await getDocs(q);

            querySnapshot.forEach(async (doc) => {
                const drugData = doc.data();
                const newStock = drugData.재고량 - usedAmount;

                if (newStock <= 0) {
                    await updateDoc(doc.ref, {
                        재고량: 0,
                        상태: '사용완료'
                    });
                } else {
                    await updateDoc(doc.ref, {
                        재고량: newStock
                    });
                }
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    // 오늘 날짜로 미리 세팅
    const dateInput = document.getElementById('selected-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }

    // 이벤트 리스너 등록
    document.getElementById('next-button-date').addEventListener('click', toExamSelection);
    document.getElementById('prev-button-exam').addEventListener('click', () => scrollToStep(1));
    document.getElementById('next-button-exam').addEventListener('click', toMedicationInput);
    document.getElementById('prev-button-medication').addEventListener('click', () => scrollToStep(2));
    document.getElementById('next-button-medication').addEventListener('click', toAdditionalTests);
    document.getElementById('prev-button-additional-tests').addEventListener('click', () => scrollToStep(3));
    document.getElementById('next-button-additional-tests').addEventListener('click', toCleaningInfo);
    document.getElementById('prev-button-cleaning-info').addEventListener('click', () => scrollToStep(4));
    document.getElementById('submit-button').addEventListener('click', submitAllData);

    // 프로포폴 용량의 step을 1로 설정
    const propofolInput = document.getElementById('propofol');
    if (propofolInput) {
        propofolInput.step = 1;
    }

    // 조직검사 개수 입력 필드의 step을 1로 설정
    const gastroscopyBiopsyCountInput = document.getElementById('gastroscopy-biopsy-count');
    if (gastroscopyBiopsyCountInput) {
        gastroscopyBiopsyCountInput.step = 1;
        gastroscopyBiopsyCountInput.min = 0; // 음수 값 방지
    }

    const biopsyCountInput = document.getElementById('biopsy-count');
    if (biopsyCountInput) {
        biopsyCountInput.step = 1;
        biopsyCountInput.min = 0; // 음수 값 방지
    }

    document.querySelectorAll('.increment').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.previousElementSibling;
            if (input && input.type === 'number') {
                const step = input.id === 'propofol' || input.id === 'biopsy-count' || input.id === 'gastroscopy-biopsy-count' ? 1 : 0.5;
                input.value = (parseFloat(input.value) + step).toFixed(input.id === 'biopsy-count' || input.id === 'gastroscopy-biopsy-count' ? 0 : 1);
            }
        });
    });

    document.querySelectorAll('.decrement').forEach(button => {
        button.addEventListener('click', function() {
            const input = this.nextElementSibling;
            if (input && input.type === 'number') {
                const step = input.id === 'propofol' || input.id === 'biopsy-count' || input.id === 'gastroscopy-biopsy-count' ? 1 : 0.5;
                input.value = Math.max(0, (parseFloat(input.value) - step)).toFixed(input.id === 'biopsy-count' || input.id === 'gastroscopy-biopsy-count' ? 0 : 1); // 음수 값 방지
            }
        });
    });

    // 도트 네비게이션 이벤트 리스너 등록
    document.querySelectorAll('.dot').forEach(dot => {
        dot.addEventListener('click', function() {
            const step = this.getAttribute('data-step');
            scrollToStep(step);
        });
    });

    // 사용자 이름 요소
    const userNameElement = document.getElementById('userName');

    // 사용자 인증 상태 확인
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Firestore의 사용자 컬렉션에서 사용자 정보 가져오기
            const userDocRef = doc(db, '사용자', user.uid); // '사용자'는 컬렉션 이름입니다.
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                userNameElement.textContent = userData.name || userData.email || '사용자명';
            } else {
                console.log('사용자 문서를 찾을 수 없습니다.');
                userNameElement.textContent = '사용자명';
            }
        } else {
            userNameElement.textContent = '게스트';
            // 인증되지 않은 사용자는 로그인 페이지로 리디렉션
            window.location.href = 'login.html';
        }
    });

    // 로그아웃 버튼 기능 추가
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(auth).then(() => {
                // 로그아웃 성공 시 처리
                window.location.href = 'login.html'; // 로그인 페이지로 리디렉션
            }).catch((error) => {
                console.error('로그아웃 중 오류 발생:', error);
                alert('로그아웃 중 오류가 발생했습니다.');
            });
        });
    }

    // 페이지 로드 시 첫 번째 단계로 스크롤 이동
    scrollToStep(1);
});

// 검사 선택 버튼의 이벤트 리스너 설정
document.querySelectorAll('.btn-exam[data-value]').forEach(button => {
    button.addEventListener('click', function() {
        this.classList.toggle('selected');
        this.classList.toggle('bg-blue-200'); // 선택된 항목에 배경색 추가
        updateSelectedExams();
    });
});

// 선택된 검사를 업데이트하는 함수
function updateSelectedExams() {
    selectedExams = [];
    selectedExamIds = []; // 선택된 예약 문서 ID 목록 초기화
    document.querySelectorAll('.btn-exam.selected').forEach(button => {
        const examData = JSON.parse(button.getAttribute('data-value'));
        selectedExams.push(examData);
        selectedExamIds.push(examData.docId); // 선택된 예약 문서 ID 추가
    });
    console.log('선택된 검사:', selectedExams); // 콘솔 로그 추가
    console.log('선택된 예약 문서 ID 목록:', selectedExamIds); // 콘솔 로그 추가
}

// 기존의 예약 로드 함수 등은 필요에 따라 추가하십시오.
// 이 코드에서는 모달 동작에 필요한 부분에 집중하였습니다.

