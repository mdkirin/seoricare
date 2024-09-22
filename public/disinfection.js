// File: public/disinfection.js

import { 
    db, 
    collection, 
    addDoc, 
    getDocs, 
    updateDoc, 
    doc, 
    increment, 
    arrayUnion, 
    getDoc, 
    where, 
    query 
} from './firebase.js';  // Firebase 관련 모듈 가져오기

// Firestore 컬렉션 참조
const disinfectionCollection = collection(db, '내시경_소독약재고');
const cleaningLogCollection = collection(db, '내시경_세척일지');
let selectedRecordIds = []; // 선택된 소독약의 ID 배열
let productNames = new Set(); // Firestore에서 불러온 제품명 저장

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

// Firestore에서 기존 제품명 불러는 함수
async function loadExistingProductNames() {
    try {
        const querySnapshot = await getDocs(disinfectionCollection);
        let firstProductName = null; // 첫 번째 제품명을 저장할 변수

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.제품명) {
                productNames.add(data.제품명); // 중복 방지를 위해 Set 사용
                if (!firstProductName) {
                    firstProductName = data.제품명; // 첫 번째 제품명을 저장
                }
            }
        });

        // 제품명 드랍다운에 옵션 추가
        const 제품명Dropdown = document.getElementById('제품명-dropdown');
        if (제품명Dropdown) {
            // Firestore에서 불러온 제품명 옵션 추가
            productNames.forEach((name) => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                제품명Dropdown.appendChild(option);
            });

            // '직접 입력' 옵션 추가
            const 직접입력Option = document.createElement('option');
            직접입력Option.value = '직접 입력';
            직접입력Option.textContent = '직접 입력';
            제품명Dropdown.appendChild(직접입력Option);

            // 첫 번째 제품명을 기본 선택값으로 설정
            if (firstProductName) {
                제품명Dropdown.value = firstProductName;
            }

            // 제품명 드롭다운 변경 이벤트 리스너 추가
            제품명Dropdown.addEventListener('change', function() {
                const 제품명직접입력 = document.getElementById('제품명-직접입력');
                if (this.value === '직접 입력') {
                    제품명직접입력.style.display = 'block';
                } else {
                    제품명직접입력.style.display = 'none';
                }
            });
        }
    } catch (error) {
        console.error('기존 제품명 불러오기 중 오류 발생:', error);
        showalert('기존 제품명 불러오기 중 오류가 발생하였습니다.');
    }
}

// 소독약 입고 함수 수정
async function 소독약입고() {
    const 입고일자 = document.getElementById('입고일자').value;
    const 제품명Dropdown = document.getElementById('제품명-dropdown').value;
    const 제품명직접입력 = document.getElementById('제품명-직접입력').value;
    const 유효기간 = document.getElementById('유효기간').value;
    const 입고수량 = parseInt(document.getElementById('입고수량').value, 10);

    const 제품명 = 제품명Dropdown === '직접 입력' ? 제품명직접입력 : 제품명Dropdown;

    if (!입고일자 || !제품명 || !유효기간 || !입고수량) {
        showalert('모든 필드를 정확히 입력해주세요.');
        return;
    }

    try {
        // 소독약 재고에 추가
        await addDoc(disinfectionCollection, {
            입고일자: 입고일자,
            제품명: 제품명,
            유효기간: 유효기간,
            입고량: 입고수량,
            잔여량: 입고수량,
            사용여부: '미사용',
            사용일자: ''
        });

        // 세척일지에 입고 기록 추가
        await addDoc(cleaningLogCollection, {
            일자: 입고일자,
            활동구분: '입고',
            내용: 제품명,
            수량: 입고수량,
            잔여량: await 전체잔여량계산(),
            비고: `유효기간: ${유효기간}`
        });

        showalert('소독약이 성공적으로 입고되었습니다.');
        loadDisinfectionRecords();
        loadCleaningLogs();
        loadExistingProductNames();
        clearForm();
        close입고모달();
    } catch (error) {
        console.error('소독약 입고 중 오류 발생:', error);
        showalert('소독약 입고 중 오류가 발생하였습니다.');
    }
}

// 소독약 교체 함수
async function 소독약교체() {
    const 교체일자 = document.getElementById('교체일자-모달').value;
    const selectedDisinfectant = document.querySelector('input[name="소독약"]:checked');

    if (!교체일자) {
        showalert('교체일자를 선택해주세요.');
        return;
    }

    if (!selectedDisinfectant) {
        showalert('교체할 소독약을 선택해주세요.');
        return;
    }

    try {
        const docRef = doc(disinfectionCollection, selectedDisinfectant.value);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            const 새잔여량 = data.잔여량 - 2; // 2 bottles 사용

            await updateDoc(docRef, {
                잔여량: 새잔여량,
                사용여부: 새잔여량 > 0 ? '사용중' : '사용완료',
                사용일자: 교체일자
            });

            // 세척일지에 교체 기록 추가
            await addDoc(cleaningLogCollection, {
                일자: 교체일자,
                활동구분: '교체',
                내용: data.제품명,
                수량: 2, // 2 bottles 사용
                잔여량: 새잔여량,
                비고: `유효기간: ${data.유효기간}`
            });

            showalert('소독약이 성공적으로 교체되었습니다.');
            loadDisinfectionRecords();
            loadCleaningLogs();
            close교체모달();
        }
    } catch (error) {
        console.error('소독약 교체 중 오류 발생:', error);
        showalert('소독약 교체 중 오류가 발생하였습니다.');
    }
}

// 전체 잔여량 계산 함수
async function 전체잔여량계산() {
    try {
        const querySnapshot = await getDocs(disinfectionCollection);
        let 총잔여량 = 0;
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.사용여부 === '미사용') {
                총잔여량 += data.잔여량;
            }
        });
        return 총잔여량;
    } catch (error) {
        console.error('잔여량 계산 중 오류 발생:', error);
        return 0;
    }
}

// 소독약 수정 함수 정의
async function 소독약수정(disinfectantId, updatedData) {
    try {
        const docRef = doc(disinfectionCollection, disinfectantId);
        await updateDoc(docRef, updatedData);
        showalert('소독약 정보가 성공적으로 수정되었습니다.');
        loadDisinfectionRecords(); // 재고 테이블 업데이트
    } catch (error) {
        console.error('소독약 수정 중 오류 발생:', error);
        showalert('소독약 수정 중 오류가 발생하였습니다.');
    }
}

// 입고 모달 열기 함수
function open입고모달() {
    const modal = document.getElementById('입고모달');
    if (modal) {
        modal.style.display = 'flex';
        setTodayAsDefault('입고일자');
        loadExistingProductNames();
    }
}

// 입고 모달 닫기 함수
function close입고모달() {
    const modal = document.getElementById('입고모달');
    if (modal) {
        modal.style.display = 'none';
        clearForm();
    }
}

// 교체 모달 열기 함수
function open교체모달() {
    const modal = document.getElementById('교체모달');
    if (modal) {
        modal.style.display = 'flex';
        setTodayAsDefault('교체일자-모달');
        loadUnusedDisinfectants();
    }
}

// 교체 모달 닫기 함수
function close교체모달() {
    const modal = document.getElementById('교체모달');
    if (modal) {
        modal.style.display = 'none';
        // 필요한 경우 여기에 폼 초기화 로직을 추가할 수 있습니다.
    }
}

// 미사용 소독약 목록 로드 함수 (교체 모달용)
async function loadUnusedDisinfectants() {
    try {
        const querySnapshot = await getDocs(query(disinfectionCollection, where("잔여량", ">=", 2)));
        const 사용소독약리스트 = document.getElementById('사용소독약리스트');
        사용소독약리스트.innerHTML = ''; // 기존 목록 초기화

        // 테이블 생성
        const table = document.createElement('table');
        table.className = 'w-full border-collapse border border-gray-300';
        
        // 테이블 헤더 생성
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr class="bg-gray-100">
                <th class="border border-gray-300 px-4 py-2">선택</th>
                <th class="border border-gray-300 px-4 py-2">제품명</th>
                <th class="border border-gray-300 px-4 py-2">입고일</th>
                <th class="border border-gray-300 px-4 py-2">유효기간</th>
                <th class="border border-gray-300 px-4 py-2">잔여량</th>
            </tr>
        `;
        table.appendChild(thead);

        // 테이블 본문 생성
        const tbody = document.createElement('tbody');
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="border border-gray-300 px-4 py-2 text-center">
                    <input type="radio" name="소독약" value="${doc.id}" id="disinfectant-${doc.id}">
                </td>
                <td class="border border-gray-300 px-4 py-2">${data.제품명 || ''}</td>
                <td class="border border-gray-300 px-4 py-2">${data.입고일자 || ''}</td>
                <td class="border border-gray-300 px-4 py-2">${data.유효기간 || ''}</td>
                <td class="border border-gray-300 px-4 py-2">${data.잔여량 !== undefined ? data.잔여량 + ' bottles' : ''}</td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        사용소독약리스트.appendChild(table);
    } catch (error) {
        console.error('사용 가능한 소독약 목록 로드 중 오류 발생:', error);
        showalert('사용 가능한 소독약 목록을 불러오는 중 오류가 발생했습니다.');
    }
}

// 폼 초기화 함수
function clearForm() {
    document.getElementById('입고일자').value = '';
    document.getElementById('제품명-dropdown').value = '';
    document.getElementById('제품명-직접입력').value = '';
    document.getElementById('유효기간').value = '';
    document.getElementById('입고수량').value = '';
}

// 테이블 정렬 함수
function sortTable(columnIndex) {
    const table = document.getElementById('소독약재고테이블');
    const rows = Array.from(table.rows).slice(1);
    const isAscending = table.getAttribute('data-sort-order') === 'asc';
    const newOrder = isAscending ? 'desc' : 'asc';

    rows.sort((rowA, rowB) => {
        const cellA = rowA.cells[columnIndex].innerText;
        const cellB = rowB.cells[columnIndex].innerText;

        if (cellA < cellB) return isAscending ? -1 : 1;
        if (cellA > cellB) return isAscending ? 1 : -1;
        return 0;
    });

    rows.forEach(row => table.appendChild(row));
    table.setAttribute('data-sort-order', newOrder);
}

// 소독약 선택 함수 정의
function selectDisinfectionItem(disinfectantId) {
    if (selectedRecordIds.includes(disinfectantId)) {
        // 이미 선택된 경우 제거
        selectedRecordIds = selectedRecordIds.filter(id => id !== disinfectantId);
    } else {
        // 선택되지 않은 경우 추가
        if (selectedRecordIds.length < 2) { // 최대 2개 선택
            selectedRecordIds.push(disinfectantId);
        } else {
            showalert('소독약은 최대 2개까지 선택할 수 있습니다.');
            return;
        }
    }

    // 선택 상태 업데이트 (예: 체크박스 상태 변경)
    const checkbox = document.getElementById(`disinfectant-${disinfectantId}`);
    if (checkbox) {
        checkbox.checked = selectedRecordIds.includes(disinfectantId);
    }
}

// 오늘 날짜를 기본값으로 설정하는 함수
function setTodayAsDefault(inputId) {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById(inputId).value = today;
}

// 세척일지 로드 함수 수정
async function loadCleaningLogs() {
    try {
        const querySnapshot = await getDocs(cleaningLogCollection);
        const tableBody = document.querySelector('#세척일지테이블 tbody');

        if (!tableBody) {
            console.error('세척일지 테이블의 tbody 요소를 찾을 수 없습니다.');
            return;
        }

        tableBody.innerHTML = ''; // 기존 내용 초기화

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = tableBody.insertRow();

            row.insertCell(0).textContent = data.일자 || '';
            row.insertCell(1).textContent = data.활동구분 || '';
            row.insertCell(2).textContent = data.내용 || '';
            row.insertCell(3).textContent = data.수량 || '';
            row.insertCell(4).textContent = data.잔여량 || '';
            row.insertCell(5).textContent = data.비고 || '';
        });
    } catch (error) {
        console.error('세척일지 로드 중 오류 발생:', error);
    }
}

// 재고 테이블 로드 함수 수정
async function loadDisinfectionRecords() {
    try {
        const querySnapshot = await getDocs(disinfectionCollection);
        const tableBody = document.querySelector('#소독약재고테이블 tbody');

        if (!tableBody) {
            console.error('재고 테이블의 tbody 요소를 찾을 수 없습니다.');
            return;
        }

        tableBody.innerHTML = ''; // 기존 내용 초기화

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = tableBody.insertRow();

            // 각 셀에 데이터 추가 전 null 체크
            row.insertCell(0).textContent = data.입고일자 || '';
            row.insertCell(1).textContent = data.제품명 || '';
            row.insertCell(2).textContent = data.유효기간 || '';
            row.insertCell(3).textContent = data.사용여부 || '';
            row.insertCell(4).textContent = data.사용일자 || '';
            row.insertCell(5).textContent = data.잔여량 !== undefined ? data.잔여량 : '';
        });

        // 전체 잔여량 표시
        const 총잔여량 = await 전체잔여량계산();
        const 총잔여량Element = document.getElementById('총잔여량');
        if (총잔여량Element) {
            총잔여량Element.textContent = `총 잔여량: ${총잔여량} bottles`;
        } else {
            console.error('총잔여량을 표시할 요소를 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('재고 기록 로드 중 오류 발생:', error);
    }
}

// 전역으로 함수 노출 (함수 정의 후)
window.소독약입고 = 소독약입고;
window.open입고모달 = open입고모달;
window.close입고모달 = close입고모달;
window.open교체모달 = open교체모달;
window.close교체모달 = close교체모달;
window.소독약교체 = 소독약교체;
window.selectDisinfectionItem = selectDisinfectionItem;
window.setTodayAsDefault = setTodayAsDefault;
window.clearForm = clearForm;
window.sortTable = sortTable;
window.소독약수정 = 소독약수정;

// 초기화 호출
document.addEventListener('DOMContentLoaded', () => {
    loadExistingProductNames();
    loadCleaningLogs();
    loadDisinfectionRecords();
    
    // 입고 버튼 이벤트 리스너 추가
    const 입고버튼 = document.getElementById('입고버튼');
    if (입고버튼) {
        입고버튼.addEventListener('click', open입고모달);
    }

    // 교체 버튼 이벤트 리스너 추가
    const 교체버튼 = document.getElementById('교체버튼');
    if (교체버튼) {
        교체버튼.addEventListener('click', open교체모달);
    }
});