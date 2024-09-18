import { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc } from './firebase.js';

let 약물정보캐시 = {}; // 약물 정보를 캐싱하여 사용
let 업로드중약물정보캐시 = {}; // 엑셀 업로드 중에 약물 정보를 캐싱하여 반복 입력 방지
let 현재수정중인문서 = null; // 현재 수정 중인 문서 ID를 저장

let 선택된행 = null; // 현재 선택된 행의 ID를 저장
let 데이터목록 = []; // 마약류 데이터를 저장
let 현재정렬키 = ''; // 현재 정렬 기준 키
let 오름차순정렬 = true; // 정렬 순서 (true: 오름차순, false: 내림차순)

// 마약류_정보에 저장된 약물 정보 캐시로 가져오기
async function 약물정보가져오기() {
    const querySnapshot = await getDocs(collection(db, '마약류_정보'));
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        약물정보캐시[data.제품명] = data; // 제품명을 키로 캐싱
    });
}

// 모달 창을 띄워 앰플용량과 앰플수량을 입력받는 함수
function 앰플정보입력모달(제품명) {
    return new Promise((resolve) => {
        // 모달 요소 생성
        const modalOverlay = document.createElement('div');
        modalOverlay.classList.add('fixed', 'inset-0', 'flex', 'items-center', 'justify-center', 'bg-black', 'bg-opacity-50');
        modalOverlay.innerHTML = `
            <div class="bg-white p-6 rounded shadow-md">
                <h2 class="text-lg font-bold mb-4">앰플 정보 입력</h2>
                <p>제품명: <strong>${제품명}</strong></p>
                <div class="mt-4">
                    <label class="block">앰플 용량 (mL)</label>
                    <input id="modal앰플용량" type="number" step="0.01" class="w-full px-3 py-2 border rounded" placeholder="용량 입력">
                </div>
                <div class="mt-4">
                    <label class="block">앰플 수량</label>
                    <input id="modal앰플수량" type="number" class="w-full px-3 py-2 border rounded" placeholder="수량 입력">
                </div>
                <div class="mt-6 flex justify-end">
                    <button id="modal취소버튼" class="bg-gray-500 text-white px-4 py-2 rounded mr-2">취소</button>
                    <button id="modal확인버튼" class="bg-blue-500 text-white px-4 py-2 rounded">확인</button>
                </div>
            </div>
        `;

        document.body.appendChild(modalOverlay);

        // 이벤트 리스너 설정
        document.getElementById('modal취소버튼').onclick = () => {
            document.body.removeChild(modalOverlay);
            resolve(null); // 취소 시 null 반환
        };

        document.getElementById('modal확인버튼').onclick = () => {
            const 앰플용량 = parseFloat(document.getElementById('modal앰플용량').value);
            const 앰플수량 = parseInt(document.getElementById('modal앰플수량').value);
            if (!앰플용량 || !앰플수량) {
                alert('앰플 용량과 수량을 모두 입력해주세요.');
                return;
            }
            document.body.removeChild(modalOverlay);
            resolve({ 앰플용량, 앰플수량 });
        };
    });
}

// 엑셀 파일 업로드 함수
export async function 엑셀업로드() {
    await 약물정보가져오기(); // 약물 정보 캐시 가져오기
    const fileInput = document.getElementById('엑셀파일');
    const file = fileInput.files[0];

    if (!file) {
        alert('엑셀 파일을 선택하세요.');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // 사용자 입력이 필요한 항목들과 아닌 항목들을 분리
        const 사용자입력필요없음 = [];
        const 사용자입력필요 = [];

        for (const item of jsonData) {
            const { 제품명 } = item;
            let 약물정보 = 약물정보캐시[제품명];

            // 업로드 중 약물 정보 캐시에서 확인
            if (업로드중약물정보캐시[제품명]) {
                약물정보 = 업로드중약물정보캐시[제품명];
            }

            if (!약물정보) {
                // 약물정보가 없으므로 사용자 입력이 필요함
                사용자입력필요.push(item);
            } else {
                // 약물정보가 있으므로 사용자 입력 없이 처리 가능
                사용자입력필요없음.push({ item, 약물정보 });
            }
        }

        // 사용자 입력이 필요 없는 항목들 병렬 처리
        const promises = 사용자입력필요없음.map(async ({ item, 약물정보 }) => {
            const { 제품명, 일련번호, 재고량 } = item;
            let 성분명 = '';

            // 제품명에서 성분명 결정
            if (제품명.includes('미다졸람')) 성분명 = '미다졸람';
            else if (제품명.includes('프로포폴')) 성분명 = '프로포폴';
            else if (제품명.includes('페티딘')) 성분명 = '페티딘';
            else if (제품명.includes('디아제팜')) 성분명 = '디아제팜';

            try {
                // 마약류_저장소에 약물 정보 저장
                await addDoc(collection(db, '마약류_저장소'), {
                    제품명,
                    성분명,
                    일련번호,
                    앰플용량: 약물정보.앰플용량,
                    앰플수량: 약물정보.앰플수량,
                    재고량: parseInt(재고량),
                    생성일시: new Date()
                });
            } catch (e) {
                console.error("문서 추가 중 오류 발생: ", e);
            }
        });

        await Promise.all(promises); // 병렬 작업 완료 대기

        // 사용자 입력이 필요한 항목들 순차적으로 처리
        for (const item of 사용자입력필요) {
            const { 제품명, 일련번호, 재고량 } = item;
            let 성분명 = '';

            // 제품명에서 성분명 결정
            if (제품명.includes('미다졸람')) 성분명 = '미다졸람';
            else if (제품명.includes('프로포폴')) 성분명 = '프로포폴';
            else if (제품명.includes('페티딘')) 성분명 = '페티딘';
            else if (제품명.includes('디아제팜')) 성분명 = '디아제팜';

            // 사용자에게 입력 받기
            const 입력값 = await 앰플정보입력모달(제품명);
            if (입력값 === null) {
                // 사용자가 취소 버튼을 눌렀을 때 작업 중단
                break;
            }
            const 약물정보 = {
                앰플용량: 입력값.앰플용량,
                앰플수량: 입력값.앰플수량
            };

            // 새로운 약물 정보를 마약류_정보 컬렉션에 저장
            await addDoc(collection(db, '마약류_정보'), {
                제품명,
                앰플용량: 약물정보.앰플용량,
                앰플수량: 약물정보.앰플수량
            });

            // 캐시에 저장하여 반복 입력 방지
            약물정보캐시[제품명] = 약물정보;
            업로드중약물정보캐시[제품명] = 약물정보;

            try {
                // 마약류_저장소에 약물 정보 저장
                await addDoc(collection(db, '마약류_저장소'), {
                    제품명,
                    성분명,
                    일련번호,
                    앰플용량: 약물정보.앰플용량,
                    앰플수량: 약물정보.앰플수량,
                    재고량: parseInt(재고량),
                    생성일시: new Date()
                });
            } catch (e) {
                console.error("문서 추가 중 오류 발생: ", e);
            }
        }

        alert('엑셀 데이터가 업로드되었습니다.');
        마약류로드();
    };

    reader.readAsArrayBuffer(file);
}

// 나머지 함수들은 이전과 동일합니다...

// 나머지 함수들은 이전과 동일합니다...
// 마약류 추가 함수
export async function 마약류추가() {
    const 제품명 = document.getElementById('제품명').value;
    const 성분명 = document.getElementById('성분명').value;
    const 일련번호 = document.getElementById('일련번호').value;
    const 앰플용량 = parseFloat(document.getElementById('앰플용량').value);
    const 앰플수량 = parseInt(document.getElementById('앰플수량').value);
    const 재고량 = parseInt(document.getElementById('재고량').value);

    try {
        await addDoc(collection(db, '마약류_저장소'), {
            제품명,
            성분명,
            일련번호,
            앰플용량,
            앰플수량,
            재고량,
            생성일시: new Date()
        });
        alert('마약류 기록이 추가되었습니다.');
        마약류로드();
    } catch (e) {
        console.error("문서 추가 중 오류 발생: ", e);
    }
}

// 마약류 수정 함수
export async function 마약류수정() {
    if (!현재수정중인문서) {
        alert('수정할 항목을 선택하세요.');
        return;
    }

    const 제품명 = document.getElementById('제품명').value;
    const 성분명 = document.getElementById('성분명').value;
    const 일련번호 = document.getElementById('일련번호').value;
    const 앰플용량 = parseFloat(document.getElementById('앰플용량').value);
    const 앰플수량 = parseInt(document.getElementById('앰플수량').value);
    const 재고량 = parseInt(document.getElementById('재고량').value);

    try {
        const docRef = doc(db, '마약류_저장소', 현재수정중인문서);
        await updateDoc(docRef, {
            제품명,
            성분명,
            일련번호,
            앰플용량,
            앰플수량,
            재고량
        });
        alert('마약류 기록이 수정되었습니다.');
        선택된행 = null;
        document.getElementById('수정버튼').classList.add('hidden');
        document.getElementById('삭제버튼').classList.add('hidden');
        document.getElementById('추가버튼').classList.remove('hidden');
        폼초기화();
    } catch (e) {
        console.error("문서 수정 중 오류 발생: ", e);
    }
}

export async function 마약류삭제() {
    if (!현재수정중인문서) {
        alert('삭제할 항목을 선택하세요.');
        return;
    }

    const 확인 = confirm('정말로 이 항목을 삭제하시겠습니까?');
    if (!확인) return;

    try {
        await deleteDoc(doc(db, '마약류_저장소', 현재수정중인문서));
        alert('마약류 기록이 삭제되었습니다.');
        현재수정중인문서 = null; // 삭제 완료 후 초기화
        선택된행 = null;
        document.getElementById('수정버튼').classList.add('hidden');
        document.getElementById('삭제버튼').classList.add('hidden');
        document.getElementById('추가버튼').classList.remove('hidden');
        폼초기화();
        마약류로드();
    } catch (e) {
        console.error("문서 삭제 중 오류 발생: ", e);
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// 마약류 목록 로드 함수
export async function 마약류로드() {
    const querySnapshot = await getDocs(collection(db, '마약류_저장소'));
    데이터목록 = [];
    querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        데이터목록.push(data);
    });

    // 데이터 표시 갱신
    표시갱신();
}

// 데이터 표시 갱신 함수
function 표시갱신() {
    const 마약류테이블 = document.getElementById('마약류테이블');
    마약류테이블.innerHTML = '';

    // 현재 정렬 상태에 따라 데이터 목록 정렬
    if (현재정렬키) {
        데이터목록.sort((a, b) => {
            if (a[현재정렬키] < b[현재정렬키]) return 오름차순정렬 ? -1 : 1;
            if (a[현재정렬키] > b[현재정렬키]) return 오름차순정렬 ? 1 : -1;
            return 0;
        });
    }

    데이터목록.forEach((data) => {
        const row = document.createElement('tr');
        row.classList.add('cursor-pointer', 'hover:bg-gray-200');

        // 선택된 행이면 배경색 변경
        if (선택된행 === data.id) {
            row.classList.add('bg-blue-100');
        }

        row.onclick = () => 항목선택(data.id);

        row.innerHTML = `
            <td>${data.제품명}</td>
            <td>${data.성분명}</td>
            <td>${data.일련번호}</td>
            <td>${data.앰플용량}</td>
            <td>${data.앰플수량}</td>
            <td>${data.재고량}</td>
        `;
        마약류테이블.appendChild(row);
    });
}

window.항목선택 = function(docId) {
    현재수정중인문서 = docId; // 현재 수정 중인 문서 ID 설정
    선택된행 = docId; // 선택된 행 ID 저장

    const data = 데이터목록.find(item => item.id === docId);
    if (data) {
        // 폼에 데이터 채우기
        document.getElementById('제품명').value = data.제품명;
        document.getElementById('성분명').value = data.성분명;
        document.getElementById('일련번호').value = data.일련번호;
        document.getElementById('앰플용량').value = data.앰플용량;
        document.getElementById('앰플수량').value = data.앰플수량;
        document.getElementById('재고량').value = data.재고량;

        // 수정 및 삭제 버튼을 표시하고 추가 버튼을 숨김
        document.getElementById('수정버튼').classList.remove('hidden');
        document.getElementById('삭제버튼').classList.remove('hidden');
        document.getElementById('추가버튼').classList.add('hidden');

        // 테이블 표시 갱신 (선택된 행 시각적 표시를 위해)
        표시갱신();
    }
}

// 정렬 함수
window.정렬 = function(정렬키) {
    if (현재정렬키 === 정렬키) {
        // 같은 열을 다시 클릭하면 정렬 순서 변경
        오름차순정렬 = !오름차순정렬;
    } else {
        // 다른 열을 클릭하면 해당 열로 정렬하고 오름차순으로 설정
        현재정렬키 = 정렬키;
        오름차순정렬 = true;
    }
    표시갱신();
}

function 폼초기화() {
    document.getElementById('제품명').value = '';
    document.getElementById('성분명').value = '';
    document.getElementById('일련번호').value = '';
    document.getElementById('앰플용량').value = '';
    document.getElementById('앰플수량').value = '';
    document.getElementById('재고량').value = '';

    현재수정중인문서 = null;
    선택된행 = null;
    document.getElementById('수정버튼').classList.add('hidden');
    document.getElementById('삭제버튼').classList.add('hidden');
    document.getElementById('추가버튼').classList.remove('hidden');
    표시갱신();
}

// DB 삭제 함수
export async function DB삭제() {
    const 확인 = confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
    if (!확인) return;

    try {
        // 마약류_정보 컬렉션의 모든 문서 삭제
        const 정보QuerySnapshot = await getDocs(collection(db, '마약류_정보'));
        정보QuerySnapshot.forEach(async (doc) => {
            await deleteDoc(doc.ref);
        });

        // 마약류_저장소 컬렉션의 모든 문서 삭제
        const 저장소QuerySnapshot = await getDocs(collection(db, '마약류_저장소'));
        저장소QuerySnapshot.forEach(async (doc) => {
            await deleteDoc(doc.ref);
        });

        alert('모든 데이터가 삭제되었습니다.');
        마약류로드(); // 데이터 삭제 후 테이블 갱신
    } catch (e) {
        console.error('데이터 삭제 중 오류 발생: ', e);
        alert('데이터 삭제 중 오류가 발생했습니다.');
    }
}

// 페이지 로드 시 마약류 목록 로드
window.onload = function() {
    마약류로드();
}

// 전역에 노출시켜 HTML에서 직접 호출할 수 있게 하기
window.엑셀업로드 = 엑셀업로드;
window.마약류추가 = 마약류추가;
window.마약류수정 = 마약류수정;
window.마약류삭제 = 마약류삭제;
window.DB삭제 = DB삭제;
window.마약류로드 = 마약류로드;
window.정렬 = 정렬;