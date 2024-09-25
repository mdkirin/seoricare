// Firebase 초기화 및 필요한 모듈 가져오기
import {
    db,
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    runTransaction
} from './firebase.js';

// 데이터 목록 및 상태 변수들
let 데이터목록 = [];
let 현재수정중인문서 = null;

// 정렬 상태를 저장할 변수
let 정렬상태 = {
    필드: '',
    방향: 'asc' // 'asc' 또는 'desc'
};

// 성분명 목록 정의
const 성분명목록 = ['미다졸람', '프로포폴', '페티딘', '디아제팜'];

// 제품명에서 성분명 추출 함수 수정
function 제품명에서성분명추출(제품명) {
    for (const 성분 of 성분명목록) {
        if (제품명.includes(성분)) {
            return 성분;
        }
    }
    // 성분명을 찾을 수 없는 경우 처리
    console.warn(`제품명에서 성분명을 찾을 수 없습니다: ${제품명}`);
    return null;
}

// 알림 표시 함수
function showalert(message) {
    const alertBox = document.getElementById('custom-alert');
    const alertMessage = document.getElementById('alert-message');
    alertMessage.textContent = message;
    alertBox.style.opacity = '1';
    alertBox.style.display = 'block';

    // 일정 시간 후에 알림을 숨깁니다.
    setTimeout(() => {
        alertBox.style.opacity = '0';
        // transition 효과가 끝난 후 완전히 숨김 처리
        setTimeout(() => {
            alertBox.style.display = 'none';
        }, 500); // CSS의 transition-duration과 일치
    }, 3000); // 3초 동안 표시
}

// 폼 초기화 함수
function 폼초기화() {
    document.getElementById('제품명').value = '';
    document.getElementById('일련번호').value = '';
    document.getElementById('앰플용량').value = '';
    document.getElementById('앰플수량').value = '';
    현재수정중인문서 = null;
}

// 마약류 추가 함수 수정
export async function 마약류추가() {
    const 제품명 = document.getElementById('제품명').value.trim();
    const 일련번호 = document.getElementById('일련번호').value.trim();
    const 앰플용량 = parseFloat(document.getElementById('앰플용량').value.trim());
    const 앰플수량 = parseInt(document.getElementById('앰플수량').value.trim(), 10);
    const 재고량 = 앰플수량; // 초기 재고량은 앰플 수량과 동일

    // 성분명 추출
    const 성분명 = 제품명에서성분명추출(제품명);

    if (!제품명 || !성분명 || !일련번호 || isNaN(앰플용량) || isNaN(앰플수량)) {
        showalert('모든 필드를 올바르게 입력해주세요.');
        return;
    }

    try {
        const 재고DocRef = doc(db, '마약류_재고', 성분명);

        await runTransaction(db, async (transaction) => {
            const 재고Doc = await transaction.get(재고DocRef);

            let 재고Data = {};
            if (재고Doc.exists()) {
                재고Data = 재고Doc.data();
            }

            // 제품명별 데이터
            let 제품Data = 재고Data[제품명];
            if (!제품Data) {
                제품Data = {
                    앰플용량: 앰플용량,
                    앰플수량: 앰플수량,
                    일련번호목록: {}
                };
            }

            // 일련번호 추가
            제품Data.일련번호목록[일련번호] = {
                재고량: 재고량,
                상태: '미사용' // 기본 상태를 '미사용'으로 설정
            };

            // 재고Data 업데이트
            재고Data[제품명] = 제품Data;

            // Firestore에 저장
            transaction.set(재고DocRef, 재고Data);
        });

        showalert('마약류가 추가되었습니다.');
        폼초기화();
        마약류로드();
    } catch (e) {
        console.error('마약류 추가 중 오류 발생:', e);
        showalert('마약류 추가 중 오류가 발생했습니다.');
    }
}

// 마약류 로드 함수
async function 마약류로드() {
    try {
        const querySnapshot = await getDocs(collection(db, '마약류_재고'));
        데이터목록 = [];
        querySnapshot.forEach((doc) => {
            const 성분명 = doc.id;
            const data = doc.data();

            // 제품명별로 데이터 처리
            Object.keys(data).forEach(제품명 => {
                const 제품Data = data[제품명];
                const 앰플용량 = 제품Data.앰플용량;
                const 앰플수량 = 제품Data.앰플수량;

                // 일련번호목록 처리
                Object.keys(제품Data.일련번호목록).forEach(일련번호 => {
                    const 일련번호정보 = 제품Data.일련번호목록[일련번호];
                    데이터목록.push({
                        id: `${성분명}_${제품명}_${일련번호}`,
                        성분명,
                        제품명,
                        일련번호,
                        앰플용량,
                        앰플수량,
                        재고량: 일련번호정보.재고량,
                        상태: 일련번호정보.상태
                    });
                });
            });
        });

        표시갱신();
    } catch (e) {
        console.error('마약류 로드 중 오류 발생:', e);
        showalert('데이터를 불러오는 중 오류가 발생했습니다.');
    }
}

// 표시갱신 함수 수정
function 표시갱신() {
    const 마약류테이블 = document.getElementById('마약류테이블');
    마약류테이블.innerHTML = '';

    데이터목록.forEach((item) => {
        const 행 = document.createElement('tr');
        행.innerHTML = `
            <td class="py-2 border">${item.제품명}</td>
            <td class="py-2 border">${item.성분명}</td>
            <td class="py-2 border">${item.일련번호}</td>
            <td class="py-2 border">${item.앰플용량}</td>
            <td class="py-2 border">${item.앰플수량}</td>
            <td class="py-2 border">${item.재고량}</td>
            <td class="py-2 border">${item.상태}</td>
        `;
        마약류테이블.appendChild(행);

        // 행 클릭 이벤트 처리
        행.addEventListener('click', () => {
            현재수정중인문서 = item;
            document.getElementById('제품명').value = item.제품명;
            document.getElementById('성분명').value = item.성분명;
            document.getElementById('일련번호').value = item.일련번호;
            document.getElementById('앰플수량').value = item.앰플수량;
            document.getElementById('재고량').value = item.재고량;
            // 버튼 표시 조정
            document.getElementById('수정버튼').classList.remove('hidden');
            document.getElementById('삭제버튼').classList.remove('hidden');
            document.getElementById('추가버튼').classList.add('hidden');
            document.getElementById('사용중버튼').classList.remove('hidden');
        });
    });
}

// 마약류 수정 함수
export async function 마약류수정() {
    if (!현재수정중인문서) {
        showalert('수정할 항목을 선택하세요.');
        return;
    }

    const 제품명 = document.getElementById('제품명').value.trim();
    const 성분명 = 제품명에서성분명추출(제품명);
    // 수정할 필드들을 가져옵니다.

    try {
        const 재고DocRef = doc(db, '마약류_재고', 현재수정중인문서);

        // 필요한 필드들을 업데이트합니다.
        await updateDoc(재고DocRef, {
            제품명: 성분명,
            // 기타 업데이트할 필드들
        });

        showalert('마약류가 수정되었습니다.');
        폼초기화();
        마약류로드();
    } catch (e) {
        console.error('마약류 수정 중 오류 발생:', e);
        showalert('마약류 수정 중 오류가 발생했습니다.');
    }
}

// 마약류 삭제 함수
export async function 마약류삭제() {
    if (!현재수정중인문서) {
        showalert('삭제할 항목을 선택하세요.');
        return;
    }

    const 확인 = confirm('정말로 이 항목을 삭제하시겠습니까?');
    if (!확인) return;

    try {
        await deleteDoc(doc(db, '마약류_재고', 현재수정중인문서));
        showalert('마약류 기록이 삭제되었습니다.');
        폼초기화();
        마약류로드();
    } catch (e) {
        console.error("문서 삭제 중 오류 발생: ", e);
        showalert('삭제 중 오류가 발생했습니다.');
    }
}

// 마약류 사용 내역 기록 함수
export async function 마약류사용내역기록(약물명, 일련번호, 사용량, 사용자, 환자ID, 관련검사ID) {
    try {
        await addDoc(collection(db, '마약류_사용내역'), {
            사용일시: new Date(),
            제품명: 약물명,
            일련번호: 일련번호,
            사용량: 사용량,
            사용자: 사용자,
            환자ID: 환자ID,
            관련검사ID: 관련검사ID
        });
    } catch (e) {
        console.error('마약류 사용 내역 기록 중 오류 발생:', e);
    }
}

// 마약류 재고 차감 및 사용 내역 기록 함수
export async function 마약류재고차감및사용기록(약물명, 사용량, 사용자, 환자ID, 관련검사ID) {
    const 재고DocRef = doc(db, '마약류_재고', 약물명);
    try {
        await runTransaction(db, async (transaction) => {
            const 재고Doc = await transaction.get(재고DocRef);
            if (!재고Doc.exists()) {
                throw new Error(`${약물명}의 재고 정보가 없습니다.`);
            }

            const 재고Data = 재고Doc.data();
            let 총재고량 = 재고Data.총재고량;
            let 일련번호목록 = 재고Data.일련번호목록;
            let 남은사용량 = 사용량;

            if (총재고량 < 사용량) {
                throw new Error(`${약물명}의 재고가 부족합니다.`);
            }

            for (let i = 0; i < 일련번호목록.length && 남은사용량 > 0; i++) {
                const 일련 = 일련번호목록[i];
                if (일련.재고량 > 0) {
                    const 차감량 = Math.min(일련.재고량, 남은사용량);
                    일련번호목록[i].재고량 -= 차감량;
                    남은사용량 -= 차감량;

                    // 사용 내역 기록
                    await 마약류사용내역기록(약물명, 일련.일련번호, 차감량, 사용자, 환자ID, 관련검사ID);

                    // 재고량이 0이 되면 상태를 '사용완료'로 변경
                    if (일련번호목록[i].재고량 === 0) {
                        일련번호목록[i].상태 = '사용완료';
                    }
                }
            }

            총재고량 -= 사용량;

            transaction.update(재고DocRef, {
                총재고량: 총재고량,
                일련번호목록: 일련번호목록
            });
        });
    } catch (e) {
        console.error('재고 차감 중 오류 발생:', e);
        throw e;
    }
}

// 정렬 함수
function 정렬(필드명) {
    // 현재 정렬 필드와 방향을 확인
    if (정렬상태.필드 === 필드명) {
        // 같은 필드에서 클릭 시 방향을 반전
        정렬상태.방향 = 정렬상태.방향 === 'asc' ? 'desc' : 'asc';
    } else {
        // 새로운 필드에서 클릭 시 기본 방향으로 설정
        정렬상태.필드 = 필드명;
        정렬상태.방향 = 'asc';
    }

    // 데이터 목록을 정렬
    데이터목록.sort((a, b) => {
        const aValue = a[정렬상태.필드];
        const bValue = b[정렬상태.필드];

        if (정렬상태.방향 === 'asc') {
            return aValue > bValue ? 1 : -1;
        } else {
            return aValue < bValue ? 1 : -1;
        }
    });

    // 정렬된 데이터로 테이블 업데이트
    표시갱신();
}

// 페이지 로드 시 마약류 로드
window.addEventListener('load', () => {
    마약류로드();

    // 파일 선택 버튼 이벤트 리스너 추가
    document.getElementById('파일선택버튼').addEventListener('click', () => {
        document.getElementById('엑셀파일').click();
    });

    // 파일 선택 시 선택된 파일명 표시
    document.getElementById('엑셀파일').addEventListener('change', (event) => {
        const 파일명 = event.target.files[0]?.name || '선택된 파일 없음';
        document.getElementById('선택된파일명').innerText = 파일명;
    });

    // 엑셀 업로드 버튼 클릭 시 엑셀업로드 함수 호출
    document.getElementById('엑셀업로드버튼').addEventListener('click', 엑셀업로드);
});

// XLSX 라이브러리 사용을 위해 전역 변수 설정
const XLSX = window.XLSX || {};

// 앰플정보 저장 객체
const 앰플정보저장소 = {};

// 새로운 제품명일 경우 앰플용량과 앰플수량 입력 함수
async function 새로운제품정보입력(제품명) {
    return new Promise((resolve) => {
        // 사용자에게 입력을 요청하는 모달이나 prompt를 표시
        const 앰플용량 = parseFloat(prompt(`${제품명}의 앰플 용량(mL)을 입력해주세요:`));
        const 앰플수량 = parseInt(prompt(`${제품명}의 앰플 수량을 입력해주세요:`), 10);

        if (isNaN(앰플용량) || isNaN(앰플수량)) {
            showalert('올바른 숫자를 입력해주세요.');
            resolve(null);
        } else {
            앰플정보저장소[제품명] = {
                앰플용량: 앰플용량,
                앰플수량: 앰플수량
            };
            resolve(앰플정보저장소[제품명]);
        }
    });
}

export async function 엑셀업로드() {
    const 파일Input = document.getElementById('엑셀파일');
    const 파일 = 파일Input.files[0];

    if (!파일) {
        showalert('엑셀 파일을 선택해주세요.');
        return;
    }

    try {
        // 파일 읽기
        const data = await 파일.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });

        // 첫 번째 시트 읽기
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];

        // 시트의 데이터를 JSON 형태로 변환
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        // 각 행의 데이터를 처리하여 Firestore에 저장
        for (const row of jsonData) {
            const 제품명 = row['제품명']?.trim();
            const 일련번호 = row['일련번호']?.trim();
            const 재고량 = parseInt(row['재고량'], 10) || 0;

            if (!제품명 || !일련번호 || 재고량 <= 0) {
                console.warn(`필드가 부족하여 이 행을 건너뜁니다: ${JSON.stringify(row)}`);
                continue;
            }

            // 성분명 추출
            const 성분명 = 제품명에서성분명추출(제품명);

            // 앰플용량과 앰플수량 가져오기
            let 앰플정보 = 앰플정보저장소[제품명];
            if (!앰플정보) {
                // 새로운 제품명이므로 사용자에게 입력 요청
                앰플정보 = await 새로운제품정보입력(제품명);
                if (!앰플정보) {
                    // 입력이 올바르지 않으면 이 행을 건너뜁니다.
                    continue;
                }
            }

            const { 앰플용량, 앰플수량 } = 앰플정보;

            // 마약류 추가 함수 호출
            await 엑셀데이터로마약류추가(제품명, 성분명, 일련번호, 앰플용량, 앰플수량, 재고량);
        }

        showalert('엑셀 업로드 및 데이터 저장이 완료되었습니다.');
        // 업로드 후 재고 목록 갱신
        마약류로드();
    } catch (e) {
        console.error('엑셀 업로드 중 오류 발생:', e);
        showalert('엑셀 업로드 중 오류가 발생했습니다.');
    }
}

async function 엑셀데이터로마약류추가(제품명, 성분명, 일련번호, 앰플용량, 앰플수량, 재고량) {
    try {
        const 재고DocRef = doc(db, '마약류_재고', 성분명);

        await runTransaction(db, async (transaction) => {
            const 재고Doc = await transaction.get(재고DocRef);

            let 재고Data = {};
            if (재고Doc.exists()) {
                재고Data = 재고Doc.data();
            }

            // 제품명별 데이터
            let 제품Data = 재고Data[제품명];
            if (!제품Data) {
                제품Data = {
                    앰플용량: 앰플용량,
                    앰플수량: 앰플수량,
                    일련번호목록: {}
                };
            }

            // 일련번호 추가
            제품Data.일련번호목록[일련번호] = {
                재고량: 재고량,
                상태: '미사용' // 기본 상태를 '미사용'으로 설정
            };

            // 재고Data 업데이트
            재고Data[제품명] = 제품Data;

            // Firestore에 저장
            transaction.set(재고DocRef, 재고Data);
        });
    } catch (e) {
        console.error(`일련번호 ${일련번호} 추가 중 오류 발생:`, e);
    }
}

// 사용중인 일련번호 추가 함수
function 사용중인일련번호추가() {
    if (!현재수정중인문서) {
        showalert('수정할 항목을 선택하세요.');
        return;
    }

    const { 성분명, 제품명, 일련번호 } = 현재수정중인문서;

    const 재고DocRef = doc(db, '마약류_재고', 성분명);

    runTransaction(db, async (transaction) => {
        const 재고Doc = await transaction.get(재고DocRef);

        if (!재고Doc.exists()) {
            showalert('데이터를 찾을 수 없습니다.');
            return;
        }

        const 재고Data = 재고Doc.data();
        const 제품Data = 재고Data[제품명];
        if (!제품Data) {
            showalert('제품 데이터를 찾을 수 없습니다.');
            return;
        }

        const 일련번호목록 = 제품Data.일련번호목록;
        const 일련번호정보 = 일련번호목록[일련번호];
        if (!일련번호정보) {
            showalert('일련번호 정보를 찾을 수 없습니다.');
            return;
        }

        // 상태 변경
        일련번호정보.상태 = '사용중';

        // Firestore에 업데이트
        transaction.set(재고DocRef, 재고Data);
    })
    .then(() => {
        showalert('상태가 \'사용중\'으로 변경되었습니다.');
        폼초기화();
        마약류로드();
    })
    .catch((e) => {
        console.error('상태 변경 중 오류 발생:', e);
        showalert('상태 변경 중 오류가 발생했습니다.');
    });
}

// drug.js의 마지막 부분에 추가
window.addEventListener('load', () => {
    마약류로드();

    // 추가 버튼 클릭 이벤트 리스너
    document.getElementById('추가버튼').addEventListener('click', 마약류추가);

    // 수정 버튼 클릭 이벤트 리스너
    document.getElementById('수정버튼').addEventListener('click', 마약류수정);

    // 삭제 버튼 클릭 이벤트 리스너
    document.getElementById('삭제버튼').addEventListener('click', 마약류삭제);

    // 사용중 버튼 클릭 이벤트 리스너
    document.getElementById('사용중버튼').addEventListener('click', 사용중인일련번호추가);

    // 테이블 헤더 클릭 이벤트 리스너 (정렬 기능)
    document.querySelectorAll('th').forEach((header) => {
        header.addEventListener('click', () => {
            const 필드명 = header.textContent.trim();
            정렬(필드명);
        });
    });

});
