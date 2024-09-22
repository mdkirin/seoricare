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
    getDoc 
} from './firebase.js';

// 모달 관련 변수들
let selectedDate = null;
let selectedExams = []; // 선택된 검사 목록
let medicationData = {};
let additionalTests = [];
let cleaningInfo = {};

// 모달 제어 함수들
function openModal(modalId) {
    closeAllModals();
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => modal.classList.remove('active'));
}

// 단계별 함수들

// 1단계: 검사 선택으로 이동
function toExamSelection() {
    const dateInput = document.getElementById('selected-date');
    if (dateInput && dateInput.value) {
        selectedDate = dateInput.value;
        closeModal('modal-date');
        openModal('modal-exam');

        // 검사 목록 불러오기
        loadExams();
    } else {
        alert('날짜를 선택해주세요.');
    }
}

// 2단계: 약물 입력으로 이동
function toMedicationInput() {
    if (selectedExams.length > 0) {
        closeModal('modal-exam');
        openModal('modal-medication');
    } else {
        alert('최소 하나의 검사를 선택해주세요.');
    }
}

// 3단계: 추가검사 입력으로 이동
function toAdditionalTests() {
    const midazolam = document.getElementById('midazolam').value;
    const propofol = document.getElementById('propofol').value;
    const pethidine = document.getElementById('pethidine').value;

    medicationData = { midazolam, propofol, pethidine };
    closeModal('modal-medication');
    openModal('modal-additional-tests');
}

// 4단계: 세척정보 입력으로 이동
function toCleaningInfo() {
    const biopsy = document.getElementById('biopsy').checked;
    const additionalTest1 = document.getElementById('additional-test-1').checked;
    const additionalTest2 = document.getElementById('additional-test-2').checked;

    additionalTests = [];
    if (biopsy) additionalTests.push('조직검사');
    if (additionalTest1) additionalTests.push('추가검사 1');
    if (additionalTest2) additionalTests.push('추가검사 2');

    closeModal('modal-additional-tests');
    openModal('modal-cleaning-info');
}

// 최종 데이터 제출 함수
async function submitAllData() {
    const cleaningMethod = document.getElementById('cleaning-method').value;
    const disinfectant = document.getElementById('disinfectant').value;

    cleaningInfo = { cleaningMethod, disinfectant };

    // 모든 데이터를 취합하여 데이터베이스에 저장
    const finalData = {
        date: selectedDate,
        exams: selectedExams,
        medication: medicationData,
        additionalTests: additionalTests,
        cleaningInfo: cleaningInfo,
        timestamp: new Date()
    };

    try {
        await addDoc(collection(db, '내시경_데이터'), finalData);
        alert('데이터가 성공적으로 저장되었습니다.');
        closeAllModals();
    } catch (error) {
        console.error('데이터 저장 중 오류 발생:', error);
        alert('데이터 저장 중 오류가 발생했습니다.');
    }
}

// 검사 데이터를 불러와 테이블에 표시하는 함수
async function loadExams() {
    try {
        // Firestore에서 검사 목록 불러오기
        const examCollection = collection(db, '검사목록'); // '검사목록' 컬렉션 이름은 실제 사용하는 이름으로 변경하세요
        const examSnapshot = await getDocs(examCollection);
        const examTableBody = document.querySelector('#exam-table tbody');
        examTableBody.innerHTML = ''; // 기존 내용 초기화

        examSnapshot.forEach((doc) => {
            const examData = doc.data();
            const row = document.createElement('tr');
            row.classList.add('cursor-pointer');

            // 행 클릭 시 선택 또는 선택 해제
            row.addEventListener('click', () => {
                row.classList.toggle('bg-blue-100');
                const examName = examData.name;
                if (selectedExams.includes(examName)) {
                    // 이미 선택된 경우 제거
                    selectedExams = selectedExams.filter(name => name !== examName);
                } else {
                    // 선택되지 않은 경우 추가
                    selectedExams.push(examName);
                }
            });

            // 검사명 셀
            const nameCell = document.createElement('td');
            nameCell.classList.add('px-4', 'py-2');
            nameCell.textContent = examData.name;

            // 설명 셀
            const descCell = document.createElement('td');
            descCell.classList.add('px-4', 'py-2');
            descCell.textContent = examData.description || '';

            row.appendChild(nameCell);
            row.appendChild(descCell);

            examTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('검사 목록을 불러오는 중 오류 발생:', error);
    }
}

// 페이지 로드 시 첫 번째 모달 열기
document.addEventListener('DOMContentLoaded', async () => {
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

    // 페이지 로드 시 날짜 선택 모달 열기
    openModal('modal-date');

    // 이벤트 리스너 등록
    document.getElementById('next-button-date').addEventListener('click', toExamSelection);
    document.getElementById('next-button-exam').addEventListener('click', toMedicationInput);
    document.getElementById('next-button-medication').addEventListener('click', toAdditionalTests);
    document.getElementById('next-button-additional-tests').addEventListener('click', toCleaningInfo);
    document.getElementById('submit-button').addEventListener('click', submitAllData);

    // 이전 버튼들도 필요에 따라 추가
    document.getElementById('prev-button-exam').addEventListener('click', () => openModal('modal-date'));
    document.getElementById('prev-button-medication').addEventListener('click', () => openModal('modal-exam'));
    document.getElementById('prev-button-additional-tests').addEventListener('click', () => openModal('modal-medication'));
    document.getElementById('prev-button-cleaning-info').addEventListener('click', () => openModal('modal-additional-tests'));
});

// 기존의 예약 로드 함수 등은 필요에 따라 추가하십시오.
// 이 코드에서는 모달 동작에 필요한 부분에 집중하였습니다.
