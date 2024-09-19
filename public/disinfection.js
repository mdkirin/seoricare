import { db, collection, addDoc, getDocs } from './firebase.js';

// Firestore 컬렉션 참조
const disinfectionCollection = collection(db, '내시경세척소독');

// Firestore에서 각 필드 값을 로드하여 드롭다운에 추가
async function loadDropdownData() {
    const querySnapshot = await getDocs(disinfectionCollection);

    // 중복 없이 제품명, 내시경모델, 유효농도, 세척기번호, 입고수량을 수집하기 위한 Set
    const productNames = new Set();
    const endoscopeModels = new Set();
    const concentrations = new Set();
    const washerNumbers = new Set();
    const stockQuantities = new Set();

    // 데이터가 있을 때만 각 필드에 추가
    if (!querySnapshot.empty) {
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.제품명) productNames.add(data.제품명);
            if (data.내시경모델) endoscopeModels.add(data.내시경모델);
            if (data.유효농도) concentrations.add(data.유효농도);
            if (data.세척기번호) washerNumbers.add(data.세척기번호);
            if (data.입고수량) stockQuantities.add(data.입고수량);
        });
    }

    // 드롭다운에 값 추가
    addOptionsToDropdown('제품명', productNames);
    addOptionsToDropdown('내시경모델', endoscopeModels);
    addOptionsToDropdown('유효농도', concentrations);
    addOptionsToDropdown('세척기번호', washerNumbers);
    addOptionsToDropdown('입고수량', stockQuantities);
}

// 드롭다운에 옵션 추가 함수
function addOptionsToDropdown(fieldId, optionsSet) {
    const select = document.getElementById(fieldId);
    select.innerHTML = ''; // 기존 옵션 제거

    // 옵션이 없을 경우 기본 옵션 추가
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

    // 직접 입력 옵션 추가
    const directInputOption = document.createElement('option');
    directInputOption.value = '직접입력';
    directInputOption.textContent = '직접입력';
    select.appendChild(directInputOption);
}

// 페이지 로드 시 데이터 로드
window.onload = async () => {
    await loadDropdownData();
    await loadDisinfectionRecords();
};

// 테이블에 데이터 로드
async function loadDisinfectionRecords() {
    const querySnapshot = await getDocs(disinfectionCollection);
    const tbody = document.getElementById('소독약테이블');
    tbody.innerHTML = ''; // 기존 내용 지우기

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const row = document.createElement('tr');
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
        tbody.appendChild(row);
    });
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
        alert('소독약 기록이 추가되었습니다.');
        loadDisinfectionRecords(); // 테이블 업데이트
    } catch (error) {
        console.error('Error adding document: ', error);
    }
}

// 입력 값 가져오기 함수 (드롭다운/텍스트 입력 지원)
function getInputValue(field) {
    const select = document.getElementById(field);
    const input = document.getElementById(field + '-input');
    return select.classList.contains('hidden') ? input.value : select.value;
}

function 정렬(field) {
    const table = document.getElementById('소독약테이블');
    const rows = Array.from(table.querySelectorAll('tr'));

    // 첫 번째 열(헤더)은 제외하고 데이터를 가져옴
    const headerRow = rows.shift();

    // 데이터를 정렬함 (기본적으로 문자열 정렬, 숫자는 parseInt로 변환 가능)
    const sortedRows = rows.sort((a, b) => {
        const aValue = a.querySelector(`td:nth-child(${getColumnIndex(field)})`).textContent.trim();
        const bValue = b.querySelector(`td:nth-child(${getColumnIndex(field)})`).textContent.trim();
        
        if (!isNaN(aValue) && !isNaN(bValue)) {
            return parseFloat(aValue) - parseFloat(bValue);
        }
        return aValue.localeCompare(bValue);
    });

    // 테이블에 다시 정렬된 행 추가
    table.innerHTML = '';
    table.appendChild(headerRow);
    sortedRows.forEach(row => table.appendChild(row));
}

// 테이블 열의 인덱스를 반환하는 헬퍼 함수
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
window.정렬 = 정렬;

// 이벤트 리스너 추가
document.getElementById('추가버튼').addEventListener('click', 소독약기록추가);

// 다른 함수들도 동일하게 노출시킴
window.소독약기록추가 = 소독약기록추가;

// Your existing code...
window.onload = async () => {
    await loadDropdownData();
    await loadDisinfectionRecords();
};