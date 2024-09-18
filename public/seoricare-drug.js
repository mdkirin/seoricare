import { db, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, setDoc, where } from './firebase.js';

let 약물정보캐시 = {}; // 약물 정보를 캐싱하여 사용
let 업로드중약물정보캐시 = {}; // 엑셀 업로드 중에 약물 정보를 캐싱하여 반복 입력 방지
let 현재수정중인문서 = null; // 현재 수정 중인 문서 ID를 저장

let 선택된행 = null; // 현재 선택된 행의 ID를 저장
let 데이터목록 = []; // 마약류 데이터를 저장
let 현재정렬키 = ''; // 현재 정렬 기준 키
let 오름차순정렬 = true; // 정렬 순서 (true: 오름차순, false: 내림차순)

let 사용중인일련번호목록 = {}; // 사용 중인 일련번호 목록 (성분명별)

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

        const 엑셀일련번호목록 = []; // 엑셀 파일의 일련번호 목록
        const 불일치항목목록 = []; // 재고량 불일치 항목 목록

        // 엑셀 데이터 순회
        for (const item of jsonData) {
            const { 제품명, 일련번호, 재고량 } = item;
            엑셀일련번호목록.push(일련번호);
            let 약물정보 = 약물정보캐시[제품명];

            // 약물 정보 처리
            if (!약물정보) {
                // 사용자 입력 필요
                const 입력값 = await 앰플정보입력모달(제품명);
                if (입력값 === null) {
                    // 사용자가 취소 버튼을 눌렀을 때 작업 중단
                    break;
                }
                약물정보 = {
                    앰플용량: 입력값.앰플용량,
                    앰플수량: 입력값.앰플수량
                };
                // 약물 정보 저장
                await addDoc(collection(db, '마약류_정보'), {
                    제품명,
                    앰플용량: 약물정보.앰플용량,
                    앰플수량: 약물정보.앰플수량
                });
                약물정보캐시[제품명] = 약물정보;
            }

            // DB에서 동일한 일련번호의 문서 검색
            const querySnapshot = await getDocs(collection(db, '마약류_저장소'), where('일련번호', '==', 일련번호));
            if (!querySnapshot.empty) {
                // 동일한 일련번호가 존재함
                const docData = querySnapshot.docs[0].data();
                const db재고량 = docData.재고량;

                if (db재고량 !== parseInt(재고량)) {
                    // 재고량 불일치
                    불일치항목목록.push({
                        id: querySnapshot.docs[0].id,
                        제품명,
                        일련번호,
                        성분명: docData.성분명,
                        db재고량,
                        엑셀재고량: parseInt(재고량)
                    });
                }
                // 재고량이 일치하면 아무 작업도 하지 않음
            } else {
                // 동일한 일련번호가 존재하지 않음 -> 새로운 문서로 추가

                // 제품명에서 성분명 결정
                let 성분명 = '';
                if (제품명.includes('미다졸람')) 성분명 = '미다졸람';
                else if (제품명.includes('프로포폴')) 성분명 = '프로포폴';
                else if (제품명.includes('페티딘')) 성분명 = '페티딘';
                else if (제품명.includes('디아제팜')) 성분명 = '디아제팜';
                else 성분명 = ''; // 또는 필요에 따라 처리

                try {
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
        }
        
        // DB에서 재고량이 0이 아닌 모든 일련번호 가져오기
        const dbQuerySnapshot = await getDocs(collection(db, '마약류_저장소'));
        const db일련번호목록 = [];
        const db일련번호재고맵 = {}; // 일련번호별 재고량 및 정보 저장

        dbQuerySnapshot.forEach(doc => {
            const data = doc.data();
            const 일련번호 = data.일련번호;
            const 재고량 = data.재고량;

            if (재고량 > 0) { // 재고량이 0이 아닌 항목만 처리
                db일련번호목록.push(일련번호);
                db일련번호재고맵[일련번호] = {
                    id: doc.id,
                    제품명: data.제품명,
                    성분명: data.성분명,
                    일련번호: data.일련번호,
                    재고량: data.재고량
                };
            }
        });

        // DB에만 존재하는 일련번호 식별
        const db에만존재하는일련번호 = db일련번호목록.filter(일련번호 => !엑셀일련번호목록.includes(일련번호));

        // DB에만 존재하는 항목 처리
        if (db에만존재하는일련번호.length > 0) {
            await 처리해야할누락항목(db에만존재하는일련번호, db일련번호재고맵);
        }

        // 불일치 항목이 있는 경우 처리
        if (불일치항목목록.length > 0) {
            // 사용자에게 불일치 항목 목록을 보여주고 처리 방법을 선택하도록 함
            처리해야할불일치항목(불일치항목목록);
        } else {
            alert('엑셀 데이터가 업로드되었습니다.');
            마약류로드();
        }
    };

    reader.readAsArrayBuffer(file);
}

// 재고량 불일치 항목 처리 함수
function 처리해야할불일치항목(불일치목록) {
    // 모달 창 또는 별도의 UI를 생성하여 불일치 항목을 표시하고 처리 방법을 선택하도록 함

    // 간단한 예시로 alert를 사용하여 표시
    let 메시지 = '재고량이 불일치하는 항목이 있습니다:\n\n';
    불일치목록.forEach(item => {
        메시지 += `제품명: ${item.제품명}, 일련번호: ${item.일련번호}\nDB 재고량: ${item.db재고량}, 엑셀 재고량: ${item.엑셀재고량}\n\n`;
    });
    메시지 += '재고량을 엑셀 데이터로 업데이트하시겠습니까?';

    const 확인 = confirm(메시지);
    if (확인) {
        // 재고량 업데이트
        불일치목록.forEach(async item => {
            try {
                const docRef = doc(db, '마약류_저장소', item.id);
                await updateDoc(docRef, {
                    재고량: item.엑셀재고량
                });
                // 불일치 내역을 로그에 저장
                await addDoc(collection(db, '재고량불일치로그'), {
                    제품명: item.제품명,
                    일련번호: item.일련번호,
                    성분명: item.성분명,
                    기존재고량: item.db재고량,
                    새로운재고량: item.엑셀재고량,
                    처리일시: new Date()
                });
            } catch (e) {
                console.error('재고량 업데이트 중 오류 발생: ', e);
            }
        });
        alert('재고량이 업데이트되었습니다.');
        마약류로드();
    } else {
        // 사용자가 업데이트를 원하지 않음 -> 불일치 내역만 로그에 저장
        불일치목록.forEach(async item => {
            await addDoc(collection(db, '재고량불일치로그'), {
                제품명: item.제품명,
                일련번호: item.일련번호,
                성분명: item.성분명,
                기존재고량: item.db재고량,
                새로운재고량: item.엑셀재고량,
                처리일시: new Date(),
                업데이트여부: '사용자 거부'
            });
        });
        alert('재고량이 업데이트되지 않았습니다. 불일치 내역이 로그에 저장되었습니다.');
    }
}

// 누락된 항목 처리 함수
async function 처리해야할누락항목(누락일련번호목록, db일련번호재고맵) {
    // 누락된 항목 목록 생성
    const 누락항목목록 = 누락일련번호목록.map(일련번호 => db일련번호재고맵[일련번호]);

    // 사용자에게 누락된 항목 목록을 알리고 처리 방법 선택
    let 메시지 = '엑셀 파일에 포함되지 않았지만 DB에 재고가 남아있는 항목이 있습니다:\n\n';
    누락항목목록.forEach(item => {
        메시지 += `제품명: ${item.제품명}, 일련번호: ${item.일련번호}, 재고량: ${item.재고량}\n`;
    });
    메시지 += '\n이 항목들의 재고량을 0으로 설정하고 상태를 "재고 소진"으로 변경하시겠습니까?';

    const 확인 = confirm(메시지);
    if (확인) {
        // 재고량을 0으로 업데이트하고 상태를 '재고 소진'으로 변경
        for (const item of 누락항목목록) {
            try {
                const docRef = doc(db, '마약류_저장소', item.id);
                await updateDoc(docRef, {
                    재고량: 0,
                    상태: '재고 소진',
                    업데이트일시: new Date()
                });
                // 로그에 저장
                await addDoc(collection(db, '누락항목로그'), {
                    제품명: item.제품명,
                    일련번호: item.일련번호,
                    성분명: item.성분명,
                    이전재고량: item.재고량,
                    처리일시: new Date(),
                    처리내용: '재고량 0으로 업데이트 및 상태 변경'
                });
            } catch (e) {
                console.error('누락 항목 처리 중 오류 발생: ', e);
            }
        }
        alert('누락된 항목의 재고량이 0으로 업데이트되었습니다.');
    } else {
        // 사용자가 업데이트를 원하지 않음 -> 로그에만 기록
        for (const item of 누락항목목록) {
            await addDoc(collection(db, '누락항목로그'), {
                제품명: item.제품명,
                일련번호: item.일련번호,
                성분명: item.성분명,
                이전재고량: item.재고량,
                처리일시: new Date(),
                처리내용: '사용자 거부로 변경 없음'
            });
        }
        alert('누락된 항목이 처리되지 않았습니다. 로그에 저장되었습니다.');
    }
}


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
        폼초기화(); // 폼 초기화 추가
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
        폼초기화();
        마약류로드();
    } catch (e) {
        console.error("문서 수정 중 오류 발생: ", e);
    }
}

// 마약류 삭제 함수
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
        폼초기화();
        마약류로드();
    } catch (e) {
        console.error("문서 삭제 중 오류 발생: ", e);
        alert('삭제 중 오류가 발생했습니다.');
    }
}

// 사용중인 일련번호 추가 함수
export async function 사용중인일련번호추가() {
    if (!현재수정중인문서) {
        alert('사용할 항목을 선택하세요.');
        return;
    }

    const 확인 = confirm('선택한 항목을 사용 중으로 표시하시겠습니까? 동일 성분명의 기존 사용 중인 일련번호가 있다면 교체됩니다.');
    if (!확인) return;

    try {
        const data = 데이터목록.find(item => item.id === 현재수정중인문서);
        if (data) {
            const 성분명 = data.성분명;

            // 동일한 성분명의 사용 중인 일련번호 문서 업데이트
            await setDoc(doc(db, '마약류_사용중일련번호', 성분명), {
                제품명: data.제품명,
                일련번호: data.일련번호,
                성분명: 성분명,
                추가일시: new Date()
            });

            alert(`성분명 '${성분명}'의 사용 중인 일련번호가 업데이트되었습니다.`);
            await 사용중인일련번호로드(); // 사용 중인 일련번호 목록 갱신
        }
    } catch (e) {
        console.error('사용 중인 일련번호 추가 중 오류 발생: ', e);
        alert('사용 중으로 표시하는 중 오류가 발생했습니다.');
    }
}

async function 사용중인일련번호로드() {
    const querySnapshot = await getDocs(collection(db, '마약류_사용중일련번호'));
    사용중인일련번호목록 = {};
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        사용중인일련번호목록[data.성분명] = data.일련번호;
    });

    표시갱신(); // 테이블 갱신하여 시각적으로 표시
}

// 마약류 목록 로드 함수
export async function 마약류로드() {
    const querySnapshot = await getDocs(collection(db, '마약류_저장소'));
    데이터목록 = [];
    querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        데이터목록.push(data);
    });

    await 사용중인일련번호로드(); // 사용 중인 일련번호 로드
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
        row.classList.add('cursor-pointer', 'hover:bg-gray-200', 'text-center');

        // 선택된 행이면 배경색 변경
        if (선택된행 === data.id) {
            row.classList.add('bg-blue-100');
        }

        // 사용 중인 일련번호이면 스타일 적용
        const 사용중 = 사용중인일련번호목록[data.성분명] === data.일련번호;

        if (사용중) {
            row.classList.add('bg-red-100'); // 예를 들어, 배경색을 연한 빨간색으로 표시
        }

        row.onclick = () => 항목선택(data.id);

        row.innerHTML = `
            <td class="text-center">${data.제품명}</td>
            <td class="text-center">${data.성분명}</td>
            <td class="text-center">${일련번호표시(data.일련번호)}</td>
            <td class="text-center">${data.앰플용량}</td>
            <td class="text-center">${data.앰플수량}</td>
            <td class="text-center">${data.재고량}</td>
        `;
        마약류테이블.appendChild(row);
    });

    // 성분명별 재고량 합계 표시 함수 호출
    성분명별재고량합계표시();
}

// 일련번호 표시 함수 (마지막 5자리 볼드체로 표시)
function 일련번호표시(일련번호) {
    const 번호 = 일련번호.toString();
    const 길이 = 번호.length;

    if (길이 <= 5) {
        // 전체를 볼드체로 표시
        return `<strong>${번호}</strong>`;
    } else {
        const 앞부분 = 번호.substring(0, 길이 - 5);
        const 뒷부분 = 번호.substring(길이 - 5);
        return `${앞부분}<strong>${뒷부분}</strong>`;
    }
}

// 항목을 선택하고 수정 모드로 전환하는 함수
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

        // 수정, 삭제, 사용중 버튼 표시
        document.getElementById('수정버튼').classList.remove('hidden');
        document.getElementById('삭제버튼').classList.remove('hidden');
        document.getElementById('사용중버튼').classList.remove('hidden');
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
    document.getElementById('사용중버튼').classList.add('hidden');
    document.getElementById('추가버튼').classList.remove('hidden');
    표시갱신();
}

function 성분명별재고량합계표시() {
    const 합계목록 = {};

    // 성분명별로 재고량 합산
    데이터목록.forEach((data) => {
        const 성분명 = data.성분명;
        const 재고량 = parseInt(data.재고량) || 0;

        if (합계목록[성분명]) {
            합계목록[성분명] += 재고량;
        } else {
            합계목록[성분명] = 재고량;
        }
    });

    // 합계 표시 영역 선택 또는 생성
    // 합계 표시 영역 선택 또는 생성
    let 합계표시영역 = document.getElementById('합계표시영역');

    // 합계 내용 생성
    let 합계HTML = '<h3 class="text-lg font-bold mb-2">성분명별 재고량 합계</h3><div class="flex flex-wrap">';
    for (const 성분명 in 합계목록) {
        합계HTML += `<div class="mr-4">${성분명}: ${합계목록[성분명]}개</div>`;
    }
    합계HTML += '</div>';

    합계표시영역.innerHTML = 합계HTML;
}

// DB 삭제 함수
export async function DB삭제() {
    const 확인 = confirm('정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.');
    if (!확인) return;

    try {
        // 마약류_정보 컬렉션의 모든 문서 삭제
        const 정보QuerySnapshot = await getDocs(collection(db, '마약류_정보'));
        for (const docItem of 정보QuerySnapshot.docs) {
            await deleteDoc(docItem.ref);
        }

        // 마약류_저장소 컬렉션의 모든 문서 삭제
        const 저장소QuerySnapshot = await getDocs(collection(db, '마약류_저장소'));
        for (const docItem of 저장소QuerySnapshot.docs) {
            await deleteDoc(docItem.ref);
        }

        // 마약류_사용중일련번호 컬렉션의 모든 문서 삭제
        const 사용중QuerySnapshot = await getDocs(collection(db, '마약류_사용중일련번호'));
        for (const docItem of 사용중QuerySnapshot.docs) {
            await deleteDoc(docItem.ref);
        }

        alert('모든 데이터가 삭제되었습니다.');
        폼초기화();
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
window.사용중인일련번호추가 = 사용중인일련번호추가;