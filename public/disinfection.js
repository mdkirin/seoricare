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
    query, 
    deleteDoc 
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

// Firestore에서 기존 제품명 불러 
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
        console.error('소독약 입고 중 오 발:', error);
        showalert('약 입고 중 오류가 발생하였습니다.');
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
                수량: 2, // 2 bottles 사
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
        showalert('소독약 정보가 성공적으로 수정되니다.');
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
        // 필요한 경우 여기에 폼 초기화 로직을 가할 수 있습니다.
    }
}

// 미사 소독약 목록 로드 함수 (교체 달용)
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
                <td class="border border-gray-300 px-4 py-2">${data.잔여량 !== undefined ? data.잔여량 + ' 병' : ''}</td>
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

// 공통 에러 처리 함수
function handleError(error, message) {
    console.error(message, error);
    showalert(message);
}

// DOM 요소 선택 함수
function $(selector) {
    return document.querySelector(selector);
}

// 날짜 형식 통일 함수
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\. /g, '-').replace('.', '');
}

// 재고 테이블 로드 함수 수정
async function loadDisinfectionRecords() {
    try {
        const querySnapshot = await getDocs(disinfectionCollection);
        const tableBody = $('#소독약재고테이블 tbody');

        if (!tableBody) {
            throw new Error('재고 테이블의 tbody 요소를 찾을 수 없습니다.');
        }

        tableBody.innerHTML = ''; // 기존 내용 초기화

        const rows = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${formatDate(data.입고일자)}</td>
                <td>${data.제품명 || ''}</td>
                <td>${formatDate(data.유효기간)}</td>
                <td>${data.사용여부 || ''}</td>
                <td>${formatDate(data.사용일자)}</td>
                <td>${data.잔여량 !== undefined ? `${data.잔여량} 병` : ''}</td>
            `;

            rows.push(row);
        });

        // 날짜 기준으로 오름차순 정렬
        rows.sort((a, b) => {
            const dateA = new Date(a.cells[0].textContent);
            const dateB = new Date(b.cells[0].textContent);
            return dateA - dateB;
        });

        // 정렬된 행을 테이블에 추가
        rows.forEach(row => tableBody.appendChild(row));

        // 전체 잔여량 표시
        const 총잔여량 = await 전체잔여량계산();
        const 총잔여량Element = $('#총잔여량');
        if (총잔여량Element) {
            총잔여량Element.textContent = `총 잔여량: ${총잔여량} 병`;
        } else {
            throw new Error('총잔여량을 표시할 요소를 찾을 수 없습니다.');
        }

        // 정렬 상태 표시
        const headerRow = $('#소독약재고테이블 thead tr');
        if (headerRow) {
            headerRow.querySelectorAll('th').forEach((th, index) => {
                th.classList.remove('sort-asc', 'sort-desc');
                if (index === 0) {
                    th.classList.add('sort-asc');
                }
            });
        }
    } catch (error) {
        handleError(error, '재고 기록 로드 중 오류가 발생했습니다.');
    }
}

// 세척 테이블 로드 함수 수정
async function loadCleaningLogs() {
    try {
        const querySnapshot = await getDocs(cleaningLogCollection);
        const tableBody = $('#세척일지테이블 tbody');

        if (!tableBody) {
            throw new Error('세척일지 테이블의 tbody 요소를 찾을 수 없습니다.');
        }

        tableBody.innerHTML = ''; // 기존 내용 초기화

        const rows = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${formatDate(data.일자)}</td>
                <td>${data.활동구분 || ''}</td>
                <td>${data.내용 || ''}</td>
                <td>${data.수량 !== undefined ? `${data.수량} 병` : ''}</td>
                <td>${data.잔여량 !== undefined ? `${data.잔여량} 병` : ''}</td>
                <td>${data.비고 || ''}</td>
            `;

            rows.push(row);
        });

        // 날짜 기준으로 오름차순 정렬
        rows.sort((a, b) => {
            const dateA = new Date(a.cells[0].textContent);
            const dateB = new Date(b.cells[0].textContent);
            return dateA - dateB;
        });

        // 정렬된 행을 테이블에 추가
        rows.forEach(row => tableBody.appendChild(row));

        // 정렬 상태 표시
        const headerRow = $('#세척일지테이블 thead tr');
        if (headerRow) {
            headerRow.querySelectorAll('th').forEach((th, index) => {
                th.classList.remove('sort-asc', 'sort-desc');
                if (index === 0) {
                    th.classList.add('sort-asc');
                }
            });
        }
    } catch (error) {
        handleError(error, '세척일지 로드 중 오류가 발생했습니다.');
    }
}

// 정렬 함수
function sortTable(tableId, columnIndex) {
    const table = $(`#${tableId}`);
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    const header = table.querySelector(`th:nth-child(${columnIndex + 1})`);
    const isAscending = !header.classList.contains('sort-asc');

    // 모든 헤더의 정렬 클래스 초기화
    table.querySelectorAll('th').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
    });

    // 현재 헤더에 정렬 클래스 추가
    header.classList.add(isAscending ? 'sort-asc' : 'sort-desc');

    // 정렬 로직
    rows.sort((rowA, rowB) => {
        const cellA = rowA.cells[columnIndex].textContent.trim();
        const cellB = rowB.cells[columnIndex].textContent.trim();

        // 날짜 형식 확인 및 비교
        const dateA = new Date(cellA);
        const dateB = new Date(cellB);
        if (!isNaN(dateA) && !isNaN(dateB)) {
            return isAscending ? dateA - dateB : dateB - dateA;
        }

        // 숫자 형식 확인 및 비교
        const numA = parseFloat(cellA);
        const numB = parseFloat(cellB);
        if (!isNaN(numA) && !isNaN(numB)) {
            return isAscending ? numA - numB : numB - numA;
        }

        // 문자열 비교
        return isAscending
            ? cellA.localeCompare(cellB, 'ko')
            : cellB.localeCompare(cellA, 'ko');
    });

    // 정렬된 행 다시 삽입
    rows.forEach(row => tbody.appendChild(row));
}

// 전역 변수 추가
let selectedRecordId = null;

// 수정 모달 열기 함수
function open수정모달() {
    const modal = $('#수정모달');
    if (modal) {
        modal.style.display = 'flex';
        loadDisinfectionRecordsForEdit();
        
        // 입고일자 열에 정렬 상태 표시
        const headerRow = $('#수정테이블 thead tr');
        if (headerRow) {
            headerRow.querySelectorAll('th').forEach((th, index) => {
                th.classList.remove('sort-asc', 'sort-desc');
                if (index === 1) { // 입고일자 열
                    th.classList.add('sort-asc');
                }
            });
        }
    }
}

// 수정 모달 닫기 함수
function close수정모달() {
    const modal = $('#수정모달');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 수정을 위한 재고 테이블 로드 함수
async function loadDisinfectionRecordsForEdit() {
    try {
        const querySnapshot = await getDocs(disinfectionCollection);
        const tableBody = $('#수정테이블 tbody');

        if (!tableBody) {
            throw new Error('수정 테이블의 tbody 요소를 찾을 수 없습니다.');
        }

        tableBody.innerHTML = ''; // 기존 내용 초기화

        const rows = [];

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            rows.push({ id: doc.id, ...data });
        });

        // 입고일자 기준으로 오름차순 정렬
        rows.sort((a, b) => {
            const dateA = new Date(a.입고일자);
            const dateB = new Date(b.입고일자);
            return dateA - dateB;
        });

        rows.forEach((data) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><input type="radio" name="editSelection" value="${data.id}"></td>
                <td>${formatDate(data.입고일자)}</td>
                <td>${data.제품명 || ''}</td>
                <td>${formatDate(data.유효기간)}</td>
                <td>${data.사용여부 || ''}</td>
                <td>${formatDate(data.사용일자)}</td>
                <td>${data.잔여량 !== undefined ? `${data.잔여량} 병` : ''}</td>
            `;

            tableBody.appendChild(row);
        });

        // 라디오 버튼 이벤트 리스너 추가
        tableBody.querySelectorAll('input[type="radio"]').forEach(radio => {
            radio.addEventListener('change', function() {
                selectedRecordId = this.value;
                makeRowEditable(this.closest('tr'));
            });
        });
    } catch (error) {
        handleError(error, '수정을 위한 재고 기록 로드 중 오류가 발생했습니다.');
    }
}

// 날짜를 'YYYY-MM-DD' 형식의 문자열로 변환하는 함수
function formatDateForInput(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        return '';
    }
    return date.toISOString().split('T')[0];
}

// 선택된 행을 편집 가능하게 만드는 함수
function makeRowEditable(row) {
    const cells = row.cells;
    for (let i = 1; i < cells.length; i++) {
        const cell = cells[i];
        const originalText = cell.textContent.trim();
        if (i === 1 || i === 3 || i === 5) { // 날짜 필드
            const date = new Date(originalText);
            const formattedDate = formatDateForInput(date);
            cell.innerHTML = `<input type="date" value="${formattedDate}" class="editable-input">`;
        } else if (i === 6) { // 잔여량 필드
            cell.innerHTML = `<input type="number" value="${originalText.replace(/[^0-9]/g, '')}" class="editable-input">`;
        } else if (i === 4) { // 사용여부 필드
            cell.innerHTML = `
                <select class="editable-input">
                    <option value="미사용" ${originalText === '미사용' ? 'selected' : ''}>미사용</option>
                    <option value="사용중" ${originalText === '사용중' ? 'selected' : ''}>사용중</option>
                    <option value="사용완료" ${originalText === '사용완료' ? 'selected' : ''}>사용완료</option>
                </select>
            `;
        } else {
            cell.innerHTML = `<input type="text" value="${originalText}" class="editable-input">`;
        }
        cell.classList.add('editable-cell');
    }
}

// 수정 완료 함수
async function 수정완료() {
    if (!selectedRecordId) {
        showalert('수정할 항목을 선택해주세요.');
        return;
    }

    try {
        const row = $(`input[value="${selectedRecordId}"]`).closest('tr');
        const updatedData = {
            입고일자: row.cells[1].querySelector('input').value,
            제품명: row.cells[2].querySelector('input').value,
            유효기간: row.cells[3].querySelector('input').value,
            사용여부: row.cells[4].querySelector('select').value,
            사용일자: row.cells[5].querySelector('input').value,
            잔여량: parseInt(row.cells[6].querySelector('input').value) || 0
        };

        // 빈 문자열인 날짜 필드 제거
        ['입고일자', '유효기간', '사용일자'].forEach(key => {
            if (updatedData[key] === '') {
                delete updatedData[key];
            }
        });

        await updateDoc(doc(disinfectionCollection, selectedRecordId), updatedData);
        showalert('소독약 정보가 성공적으로 수정되었습니다.');
        close수정모달();
        loadDisinfectionRecords();
    } catch (error) {
        handleError(error, '소독약 정보 수정 중 오류가 발생했습니다.');
    }
}

// 삭제 함수
async function 삭제() {
    if (!selectedRecordId) {
        showalert('삭제할 항목을 선택해주세요.');
        return;
    }

    if (confirm('정말로 이 항목을 삭제하시겠습니까?')) {
        try {
            await deleteDoc(doc(disinfectionCollection, selectedRecordId));
            showalert('소독약 정보가 성공적으로 삭제되었습니다.');
            close수정모달();
            loadDisinfectionRecords();
        } catch (error) {
            handleError(error, '소독약 정보 삭제 중 오류가 발생했습니다.');
        }
    }
}

// 이벤트 리스너 설정 함수
function setupEventListeners() {
    // 메인 버튼 이벤트 리스너
    $('#입고버튼')?.addEventListener('click', open입고모달);
    $('#교체버튼')?.addEventListener('click', open교체모달);

    // 모달 내부 버튼 이벤트 리스너
    $('#소독약입고버튼')?.addEventListener('click', 소독약입고);
    $('#소독약교체버튼')?.addEventListener('click', 소독약교체);
    $('#입고모달닫기버튼')?.addEventListener('click', close입고모달);
    $('#교체모달닫기버튼')?.addEventListener('click', close교체모달);

    // 재고 테이블 정렬 이벤트 리스너 추가
    $('#소독약재고테이블 thead')?.querySelectorAll('th').forEach((th, index) => {
        th.addEventListener('click', () => sortTable('소독약재고테이블', index));
    });

    // 세척 테이블 정렬 이벤트 리스너 추가
    $('#세척일지테이블 thead')?.querySelectorAll('th').forEach((th, index) => {
        th.addEventListener('click', () => sortTable('세척일지테이블', index));
    });

    // 제품명 드롭다운 변경 이벤트 리스너
    $('#제품명-dropdown')?.addEventListener('change', function() {
        const 제품명직접입력 = $('#제품명-직접입력');
        if (제품명직접입력) {
            제품명직접입력.style.display = this.value === '직접 입력' ? 'block' : 'none';
        }
    });

    // 수정 모달 관련 이벤트 리스너 추가
    $('#수정버튼')?.addEventListener('click', open수정모달);
    $('#수정완료버튼')?.addEventListener('click', 수정완료);
    $('#삭제버튼')?.addEventListener('click', 삭제);
    $('#수정모달닫기버튼')?.addEventListener('click', close수정모달);
}

// 초기화 함수
function initialize() {
    loadExistingProductNames();
    loadCleaningLogs();
    setupEventListeners();
    loadDisinfectionRecords(); // 마지막에 호출
}

// DOMContentLoaded 이벤트 리스너
document.addEventListener('DOMContentLoaded', initialize);

// 모듈로 필요한 함수만 노출
export {
    소독약입고,
    open입고모달,
    close입고모달,
    open교체모달,
    close교체모달,
    소독약교체,
    selectDisinfectionItem,
    setTodayAsDefault,
    clearForm,
    소독약수정,
    open수정모달,
    close수정모달,
    수정완료,
    삭제
};