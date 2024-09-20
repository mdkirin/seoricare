import { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from './firebase.js';

// Firestore 컬렉션 참조
const disinfectionCollection = collection(db, '내시경세척소독');
let selectedRecordId = null;

// Firestore에서 각 필드 값을 로드하여 드롭다운에 추가
async function loadDropdownData() {
    const querySnapshot = await getDocs(disinfectionCollection);

    const productNames = new Set();
    const endoscopeModels = new Set();
    const concentrations = new Set();
    const washerNumbers = new Set();
    const stockQuantities = new Set();

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.제품명) productNames.add(data.제품명);
        if (data.내시경모델) endoscopeModels.add(data.내시경모델);
        if (data.유효농도) concentrations.add(data.유효농도);
        if (data.세척기번호) washerNumbers.add(data.세척기번호);
        if (data.입고수량) stockQuantities.add(data.입고수량);
    });

    addOptionsToDropdown('제품명', productNames);
    addOptionsToDropdown('내시경모델', endoscopeModels);
    addOptionsToDropdown('유효농도', concentrations);
    addOptionsToDropdown('세척기번호', washerNumbers);
    addOptionsToDropdown('입고수량', stockQuantities);
}

// 드롭다운에 옵션 추가 함수
function addOptionsToDropdown(fieldId, optionsSet) {
    const select = document.getElementById(fieldId);
    select.innerHTML = ''; 
    if (optionsSet.size === 0) {
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = fieldId + ' 선택';
        select.appendChild(defaultOption);
    }

    optionsSet.forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
    });

    const directInputOption = document.createElement('option');
    directInputOption.value = '직접입력';
    directInputOption.textContent = '직접입력';
    select.appendChild(directInputOption);
}

// 테이블에 데이터 로드
async function loadDisinfectionRecords() {
    const querySnapshot = await getDocs(disinfectionCollection);
    const tbody = document.getElementById('소독약테이블');
    tbody.innerHTML = ''; 

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const row = document.createElement('tr');
        row.dataset.id = doc.id;
        row.innerHTML = `
            <td>${data.일자}</td>
            <td>${data.내용}</td>
            <td>${data.제품명 || '-'}</td>
            <td>${data.유효기간 || '-'}</td>
            <td>${data.내시경모델 || '-'}</td>
            <td>${data.환자명 || '-'}</td>
            <td>${data.유효농도 || '-'}</td>
            <td>${data.세척기번호 || '-'}</td>
            <td>${data.입고수량 || '-'}</td>
            <td>${data.사용량 || '-'}</td>
            <td>${data.잔여량 || '-'}</td>
        `;
        row.onclick = () => selectRecord(doc.id, data);
        tbody.appendChild(row);
    });
}

// 레코드 선택 시 폼에 값 로드
function selectRecord(id, data) {
    selectedRecordId = id; // 선택된 레코드 ID 저장
    document.getElementById('일자').value = data.일자;
    document.getElementById('내용').value = data.내용; // 내용 선택

    // '내용' 필드에 따라 자동으로 폼 전환
    폼전환(data.내용); // 자동으로 '입고', '교체', '소독'에 맞게 전환

    // '내용'에 맞는 값을 로드
    if (data.내용 === '입고') {
        document.getElementById('제품명').value = data.제품명;
        document.getElementById('유효기간').value = data.유효기간;
        document.getElementById('입고수량').value = data.입고수량;
    } else if (data.내용 === '교체') {
        document.getElementById('제품명-교체').value = data.제품명;
        document.getElementById('사용량').value = data.사용량;
    } else if (data.내용 === '소독') {
        document.getElementById('내시경모델').value = data.내시경모델;
        document.getElementById('환자명').value = data.환자명;
        document.getElementById('유효농도').value = data.유효농도;
        document.getElementById('세척기번호').value = data.세척기번호;
    }

    // 수정 및 삭제 버튼 활성화
    document.getElementById('수정버튼').classList.remove('hidden');
    document.getElementById('삭제버튼').classList.remove('hidden');
    document.getElementById('추가버튼').classList.add('hidden');
}

// 소독약 기록 추가
async function 소독약기록추가() {
    const 내용 = document.getElementById('내용').value;
    const 일자 = document.getElementById('일자').value;

    const newData = { 일자, 내용 };

    if (내용 === '입고') {
        newData.제품명 = getInputValue('제품명');
        newData.유효기간 = document.getElementById('유효기간').value;
        newData.입고수량 = parseInt(getInputValue('입고수량'), 10);
        newData.잔여량 = newData.입고수량;
    } else if (내용 === '교체') {
        newData.제품명 = document.getElementById('제품명-교체').value;
        newData.사용량 = parseInt(document.getElementById('사용량').value, 10);
        newData.잔여량 = -(newData.사용량);
    } else if (내용 === '소독') {
        newData.내시경모델 = getInputValue('내시경모델');
        newData.환자명 = document.getElementById('환자명').value;
        newData.유효농도 = getInputValue('유효농도');
        newData.세척기번호 = getInputValue('세척기번호');
    }

    try {
        await addDoc(disinfectionCollection, newData);
        showalert('소독약 기록이 추가되었습니다.'); // 경고창 표시
        loadDisinfectionRecords(); // 테이블 업데이트
        clearForm();
    } catch (error) {
        console.error('Error adding document: ', error);
    }
}

// 레코드 수정
async function 소독약기록수정() {
    if (!selectedRecordId) {
        alert("수정할 항목을 선택하세요.");
        return;
    }

    const docRef = doc(db, '내시경세척소독', selectedRecordId);
    const updatedData = {
        일자: document.getElementById('일자').value,
        내용: document.getElementById('내용').value,
        제품명: getInputValue('제품명'),
        유효기간: document.getElementById('유효기간').value,
        입고수량: parseInt(getInputValue('입고수량'), 10),
        내시경모델: getInputValue('내시경모델'),
        환자명: document.getElementById('환자명').value,
        유효농도: getInputValue('유효농도'),
        세척기번호: getInputValue('세척기번호'),
    };

    try {
        await updateDoc(docRef, updatedData);
        showalert('소독약 기록이 수정되었습니다.'); // 경고창 표시
        loadDisinfectionRecords(); // 테이블 업데이트
        clearForm();
    } catch (error) {
        console.error('Error updating document: ', error);
    }
}

// 레코드 삭제 함수
async function 소독약기록삭제() {
    if (!selectedRecordId) {
        alert("삭제할 항목을 선택하세요.");
        return;
    }

    const docRef = doc(db, '내시경세척소독', selectedRecordId);

    try {
        await deleteDoc(docRef);  // Firestore에서 레코드 삭제
        showalert('소독약 기록이 삭제되었습니다.'); // 경고창 표시
        loadDisinfectionRecords();  // 테이블 업데이트
        clearForm();  // 폼 초기화
    } catch (error) {
        console.error('Error deleting document: ', error);
    }
}

// 폼 초기화
function clearForm() {
    selectedRecordId = null;
    document.getElementById('일자').value = '';
    document.getElementById('내용').value = '';
    document.getElementById('제품명').value = '';
    document.getElementById('유효기간').value = '';
    document.getElementById('입고수량').value = '';
    document.getElementById('내시경모델').value = '';
    document.getElementById('환자명').value = '';
    document.getElementById('유효농도').value = '';
    document.getElementById('세척기번호').value = '';

    document.getElementById('수정버튼').classList.add('hidden');
    document.getElementById('삭제버튼').classList.add('hidden');
    document.getElementById('추가버튼').classList.remove('hidden');
}

// 입력 값 가져오기 함수 (드롭다운/텍스트 입력 지원)
function getInputValue(field) {
    const select = document.getElementById(field);
    const input = document.getElementById(field + '-input');
    return select.classList.contains('hidden') ? input.value : select.value;
}

// 정렬 기능 추가
function 정렬(field) {
    const table = document.getElementById('소독약테이블');
    const rows = Array.from(table.querySelectorAll('tr'));

    const headerRow = rows.shift(); 

    const sortedRows = rows.sort((a, b) => {
        const aValue = a.querySelector(`td:nth-child(${getColumnIndex(field)})`).textContent.trim();
        const bValue = b.querySelector(`td:nth-child(${getColumnIndex(field)})`).textContent.trim();
        
        if (!isNaN(aValue) && !isNaN(bValue)) {
            return parseFloat(aValue) - parseFloat(bValue);
        }
        return aValue.localeCompare(bValue);
    });

    table.innerHTML = '';
    table.appendChild(headerRow);
    sortedRows.forEach(row => table.appendChild(row));
}

// 열의 인덱스 반환
function getColumnIndex(field) {
    const columns = {
        '일자': 1,
        '내용': 2,
        '제품명': 3,
        '유효기간': 4,
        '내시경모델': 5,
        '환자명': 6,
        '유효농도': 7,
        '세척기번호': 8,
        '입고수량': 9,
        '사용량': 10,
        '잔여량': 11
    };
    return columns[field];
}

// 전역으로 함수 노출
window.clearForm = clearForm;
window.소독약기록추가 = 소독약기록추가;
window.소독약기록수정 = 소독약기록수정;
window.소독약기록삭제 = 소독약기록삭제;
window.정렬 = 정렬;
window.onload = async () => {
    await loadDropdownData();
    await loadDisinfectionRecords();
};

// 이벤트 리스너 추가
document.getElementById('추가버튼').addEventListener('click', 소독약기록추가);
document.getElementById('수정버튼').addEventListener('click', 소독약기록수정);
document.getElementById('삭제버튼').addEventListener('click', 소독약기록삭제);

// 경고창 표시 함수
function showalert(message, duration = 3000) {
    const customAlert = document.getElementById('custom-alert');
    const alertMessage = document.getElementById('alert-message');

    if (customAlert && alertMessage) {
        alertMessage.textContent = message;
        customAlert.classList.add('show');

        setTimeout(() => {
            customAlert.classList.remove('show');
        }, duration);
    } else {
        console.error('showalert elements not found in the DOM.');
    }
}

// 전역 노출
window.showalert = showalert;