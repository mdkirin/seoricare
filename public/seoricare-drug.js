import { db, collection, addDoc, getDocs, updateDoc, doc, deleteDoc } from './firebase.js';
let 현재수정중인문서 = null; // 현재 수정 중인 문서 ID를 저장
let 정렬상태 = { 필드: '', 오름차순: true }; // 정렬 상태 저장
let 앰플정보캐시 = {}; // 제품명에 대한 앰플정보 캐시

// 앰플 용량 추출 함수
function 제품명에서앰플용량추출(제품명) {
    // 용량 단위를 인식하도록 정규식 개선 (ml, ㎖ 등)
    const 용량매치 = 제품명.match(/(\d+(\.\d+)?)\s*[m㎖]l?\b/i);
    
    // 매칭된 값이 있을 경우에만 반환
    if (용량매치) {
        return parseFloat(용량매치[1]);
    }
    return null;
}

// 마약류_정보에 저장된 약물 정보 가져오기
async function 약물정보가져오기(제품명) {
    if (앰플정보캐시[제품명]) {
        return 앰플정보캐시[제품명]; // 캐시에 존재하면 바로 반환
    }
    
    const querySnapshot = await getDocs(collection(db, '마약류_정보'));
    let 약물정보 = null;
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.제품명 === 제품명) {
            약물정보 = data;
            앰플정보캐시[제품명] = data; // 캐시에 저장
        }
    });
    return 약물정보;
}

// 앰플수량을 입력받는 팝업 창 표시
async function 앰플수량입력팝업(제품명) {
    if (앰플정보캐시[제품명]) {
        return 앰플정보캐시[제품명]; // 캐시에 존재하면 바로 반환
    }

    // 앰플용량을 제품명에서 추출
    let 추출된앰플용량 = 제품명에서앰플용량추출(제품명);

    return new Promise((resolve) => {
        const 앰플수량 = prompt(`새로운 약물 ${제품명}에 대한 앰플수량을 입력해주세요:`);
        const 앰플용량 = 추출된앰플용량 !== null ? 추출된앰플용량 : prompt(`새로운 약물 ${제품명}에 대한 앰플용량(mL)을 입력해주세요:`);

        if (앰플수량 && 앰플용량) {
            const 약물정보 = { 앰플수량: parseInt(앰플수량), 앰플용량: parseFloat(앰플용량) };
            앰플정보캐시[제품명] = 약물정보; // 캐시에 저장
            resolve(약물정보);
        } else {
            resolve(null);
        }
    });
}

// 엑셀 파일 업로드 함수
export async function 엑셀업로드() {
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
        
        for (const item of jsonData) {
            const { 제품명, 일련번호, 재고량 } = item;
            let 약물정보 = await 약물정보가져오기(제품명);

            if (!약물정보) {
                약물정보 = await 앰플수량입력팝업(제품명);
                if (약물정보) {
                    await addDoc(collection(db, '마약류_정보'), {
                        제품명,
                        앰플수량: 약물정보.앰플수량,
                        앰플용량: 약물정보.앰플용량
                    });
                } else {
                    continue;
                }
            }

            try {
                await addDoc(collection(db, '마약류_저장소'), {
                    제품명,
                    성분명: '', // 성분명을 파싱하거나 추가해야 할 경우 여기에 작성
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

// 마약류 추가 함수 (직접 입력)
export async function 마약류추가() {
    const 제품명 = document.getElementById('제품명').value;
    const 성분명 = document.getElementById('성분명').value;
    const 일련번호 = document.getElementById('일련번호').value;
    const 재고량 = parseInt(document.getElementById('재고량').value);

    let 약물정보 = await 약물정보가져오기(제품명);
    
    if (!약물정보) {
        약물정보 = await 앰플수량입력팝업(제품명);
        if (약물정보) {
            await addDoc(collection(db, '마약류_정보'), {
                제품명,
                앰플수량: 약물정보.앰플수량,
                앰플용량: 약물정보.앰플용량
            });
        } else {
            return;
        }
    }

    try {
        await addDoc(collection(db, '마약류_저장소'), {
            제품명,
            성분명,
            일련번호,
            앰플용량: 약물정보.앰플용량,
            앰플수량: 약물정보.앰플수량,
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
    const 앰플용량 = parseFloat(document.getElementById('앰플용량').value); // 추가: 정확한 용량 업데이트
    const 앰플수량 = parseInt(document.getElementById('앰플수량').value); // 추가: 정확한 수량 업데이트
    const 재고량 = parseInt(document.getElementById('재고량').value);

    try {
        const docRef = doc(db, '마약류_저장소', 현재수정중인문서);
        await updateDoc(docRef, {
            제품명,
            성분명,
            일련번호,
            앰플용량, // 수정: 올바른 앰플 용량 업데이트
            앰플수량, // 수정: 올바른 앰플 수량 업데이트
            재고량
        });
        alert('마약류 기록이 수정되었습니다.');
        현재수정중인문서 = null; // 수정 완료 후 초기화
        document.getElementById('수정버튼').classList.add('hidden');
        document.getElementById('추가버튼').classList.remove('hidden');
        마약류로드();
    } catch (e) {
        console.error("문서 수정 중 오류 발생: ", e);
    }
}

// 마약류 목록 로드 함수
export async function 마약류로드() {
    const 마약류테이블 = document.getElementById('마약류테이블');
    마약류테이블.innerHTML = ''; // 테이블 초기화

    const querySnapshot = await getDocs(collection(db, '마약류_저장소'));
    const 데이터목록 = [];
    querySnapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        데이터목록.push(data);
    });

    // 정렬 적용
    데이터목록.sort((a, b) => {
        if (a[정렬상태.필드] < b[정렬상태.필드]) return 정렬상태.오름차순 ? -1 : 1;
        if (a[정렬상태.필드] > b[정렬상태.필드]) return 정렬상태.오름차순 ? 1 : -1;
        return 0;
    });

    데이터목록.forEach((data) => {
        const row = `<tr onclick="항목선택('${data.id}')" class="cursor-pointer hover:bg-gray-200">
            <td>${data.제품명}</td>
            <td>${data.성분명}</td>
            <td>${data.일련번호}</td>
            <td>${data.앰플용량}</td>
            <td>${data.앰플수량}</td>
            <td>${data.재고량}</td>
        </tr>`;
        마약류테이블.innerHTML += row;
    });
}

// 정렬 함수
window.정렬 = function(필드) {
    if (정렬상태.필드 === 필드) {
        정렬상태.오름차순 = !정렬상태.오름차순; // 같은 필드면 정렬 방향 변경
    } else {
        정렬상태.필드 = 필드;
        정렬상태.오름차순 = true; // 새 필드면 오름차순 정렬
    }
    마약류로드();
}

// 항목을 선택하고 수정 모드로 전환하는 함수
window.항목선택 = function(docId) {
    현재수정중인문서 = docId; // 현재 수정 중인 문서 ID 설정
    const docRef = doc(db, '마약류_저장소', docId);
    
    // 모든 행의 강조 표시를 제거
    document.querySelectorAll('#마약류테이블 tr').forEach(row => row.classList.remove('bg-blue-100'));

    getDocs(collection(db, '마약류_저장소')).then(querySnapshot => {
        querySnapshot.forEach((doc) => {
            if (doc.id === docId) {
                const data = doc.data();
                document.getElementById('제품명').value = data.제품명;
                document.getElementById('성분명').value = data.성분명;
                document.getElementById('일련번호').value = data.일련번호;
                document.getElementById('앰플용량').value = data.앰플용량;
                document.getElementById('앰플수량').value = data.앰플수량;
                document.getElementById('재고량').value = data.재고량;

                // 해당 행에 강조 표시
                document.querySelector(`tr[onclick="항목선택('${docId}')"]`).classList.add('bg-blue-100');

                // 수정 버튼을 표시하고 추가 버튼을 숨김
                document.getElementById('수정버튼').classList.remove('hidden');
                document.getElementById('추가버튼').classList.add('hidden');
            }
        });
    });
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
window.DB삭제 = DB삭제;