import { db, collection, addDoc, getDocs, updateDoc, doc } from './firebase.js';  // Firebase 관련 모듈 가져오기

// Firestore 컬렉션 참조
const disinfectionCollection = collection(db, '내시경세척소독');
let selectedRecordId = null;

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

// 폼 전환 함수 (입고/교체 선택 시 폼 표시)
function 폼전환(value) {
    const 입고폼 = document.getElementById('입고폼');
    const 교체폼 = document.getElementById('교체폼');
    const 입고버튼 = document.getElementById('입고버튼');
    const 교체버튼 = document.getElementById('교체버튼');

    if (value === '입고') {
        loadProductNames(); // 제품명 드롭다운 로드
        입고폼.classList.remove('hidden');
        교체폼.classList.add('hidden');
        입고버튼.classList.add('active-btn'); // 입고 버튼 활성화
        교체버튼.classList.remove('active-btn'); // 교체 버튼 비활성화
    } else if (value === '교체') {
        loadDisinfectionOptions(); // 교체에 사용될 소독약 로드
        입고폼.classList.add('hidden');
        교체폼.classList.remove('hidden');
        입고버튼.classList.remove('active-btn'); // 입고 버튼 비활성화
        교체버튼.classList.add('active-btn'); // 교체 버튼 활성화
    } else {
        입고폼.classList.add('hidden');
        교체폼.classList.add('hidden');
        입고버튼.classList.remove('active-btn');
        교체버튼.classList.remove('active-btn');
    }
}

// 소독약 재고 로드 함수
async function loadDisinfectionRecords() {
    const querySnapshot = await getDocs(disinfectionCollection);
    const 재고테이블 = document.getElementById('소독약재고테이블');
    재고테이블.innerHTML = ''; // 기존 내용 지우기

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const row = document.createElement('tr');
        row.dataset.id = doc.id;
        row.innerHTML = `
            <td>${data.입고일자}</td>
            <td>${data.제품명}</td>
            <td>${data.유효기간}</td>
            <td>${data.사용여부}</td>
            <td>${data.사용일자 || '-'}</td>
        `;
        재고테이블.appendChild(row);
    });

    // 소독약 교체 폼의 소독약 선택 옵션 업데이트
    updateDisinfectionOptions(querySnapshot); // updateDisinfectionOptions 함수 호출
}

// 소독약 선택 드롭다운 옵션 업데이트 (교체할 소독약 선택)
function updateDisinfectionOptions(querySnapshot) {
    const 소독약선택 = document.getElementById('소독약선택');
    소독약선택.innerHTML = '<option value="">선택하세요</option>'; // 기본 선택

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.사용여부 === '미사용') {  // 미사용 항목만 표시
            const option = document.createElement('option');
            option.value = doc.id; // 소독약 ID
            option.textContent = `${data.제품명} (유효기간: ${data.유효기간})`;
            소독약선택.appendChild(option);
        }
    });
}

// 소독약 교체 시 사용할 소독약 불러오기 (폼 전환 시 사용)
async function loadDisinfectionOptions() {
    const 소독약선택 = document.getElementById('소독약선택');
    소독약선택.innerHTML = '<option value="">선택하세요</option>';

    try {
        const querySnapshot = await getDocs(disinfectionCollection);
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            if (data.사용여부 === '미사용') {  // 미사용 상태인 소독약만 불러오기
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${data.제품명} (유효기간: ${data.유효기간})`;
                소독약선택.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error loading disinfection options: ', error);
    }
}

// Firestore에서 제품명 로드 후 드롭다운에 추가하는 함수
async function loadProductNames() {
    const querySnapshot = await getDocs(disinfectionCollection);
    const productNames = new Set(); // 중복 제거를 위해 Set 사용

    querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log(data); // 데이터 로드 확인용 콘솔 출력
        if (data.제품명) {
            productNames.add(data.제품명); // 제품명 추가
        }
    });

    const productDropdown = document.getElementById('제품명');
    productDropdown.innerHTML = ''; // 기존 옵션 초기화

    productNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        productDropdown.appendChild(option);
    });

    // 직접입력 옵션 추가
    const directInputOption = document.createElement('option');
    directInputOption.value = '직접입력';
    directInputOption.textContent = '직접입력';
    productDropdown.appendChild(directInputOption);
}

// 소독약 입고 함수 (박스 당 4개 항목 생성)
async function 소독약입고() {
    const 입고일자 = document.getElementById('입고일자').value;
    const 제품명 = document.getElementById('제품명').value;
    const 유효기간 = document.getElementById('유효기간').value;
    const 입고수량 = parseInt(document.getElementById('입고수량').value, 10); // 박스 단위 입고수량

    if (!입고일자 || !제품명 || !유효기간 || isNaN(입고수량)) {
        showalert('모든 필드를 입력하세요.');
        return;
    }

    const 항목생성수 = 입고수량 * 4; // 한 박스당 4개의 항목 생성

    try {
        for (let i = 0; i < 항목생성수; i++) {
            const newData = {
                입고일자,
                제품명,
                유효기간,
                사용여부: '미사용',
                사용일자: null
            };

            await addDoc(disinfectionCollection, newData); // Firestore에 항목 저장
        }

        showalert(`${항목생성수}개의 소독약 항목이 입고되었습니다.`);
        loadDisinfectionRecords(); // 테이블 업데이트
        clearForm(); // 폼 초기화
    } catch (error) {
        console.error('Error adding document: ', error);
    }
}

// 소독약 교체 함수
async function 소독약교체() {
    const 교체일자 = document.getElementById('교체일자').value;
    const 소독약ID = document.getElementById('소독약선택').value;  // 선택된 소독약의 ID

    if (!소독약ID) {
        alert("사용할 소독약을 선택하세요.");
        return;
    }

    const docRef = doc(db, '내시경세척소독', 소독약ID);

    try {
        await updateDoc(docRef, {
            사용여부: '사용됨',
            사용일자: 교체일자
        });
        showalert('소독약이 교체되었습니다.');
        loadDisinfectionRecords();  // 테이블 업데이트
        clearForm();  // 폼 초기화
    } catch (error) {
        console.error('Error updating document: ', error);
    }
}

// 폼 초기화 함수
function clearForm() {
    document.getElementById('입고일자').value = '';
    document.getElementById('제품명').value = '';
    document.getElementById('유효기간').value = '';
    document.getElementById('입고수량').value = '';
    document.getElementById('교체일자').value = '';
    document.getElementById('소독약선택').value = '';
}

// 페이지 로드 시 데이터 로드
window.onload = async () => {
    await loadDisinfectionRecords(); // 소독약 재고 테이블 로드
    await loadProductNames(); // 페이지 로드 시 제품명 로드
};

// 전역으로 함수 노출
window.소독약입고 = 소독약입고;
window.소독약교체 = 소독약교체;
window.폼전환 = 폼전환;
window.loadDisinfectionOptions = loadDisinfectionOptions;