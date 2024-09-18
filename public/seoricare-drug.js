import { db, collection, addDoc, getDocs } from './firebase.js';

// 마약류 추가 함수
export async function 마약류추가() {
    const 제품명 = document.getElementById('제품명').value;
    const 성분명 = document.getElementById('성분명').value;
    const 일련번호 = document.getElementById('일련번호').value;
    const 앰플용량 = parseFloat(document.getElementById('앰플용량').value);
    const 총앰플수량 = parseInt(document.getElementById('총앰플수량').value);
    const 잔여앰플수량 = parseInt(document.getElementById('잔여앰플수량').value);

    try {
        await addDoc(collection(db, '마약류_인벤토리'), {
            제품명,
            성분명,
            일련번호,
            앰플용량,
            총앰플수량,
            잔여앰플수량,
            생성일시: new Date()
        });
        alert('마약류 기록이 추가되었습니다.');
        마약류로드();
    } catch (e) {
        console.error("문서 추가 중 오류 발생: ", e);
    }
}

// 마약류 목록 로드 함수
export async function 마약류로드() {
    const 마약류테이블 = document.getElementById('마약류테이블');
    마약류테이블.innerHTML = ''; // 테이블 초기화

    const querySnapshot = await getDocs(collection(db, '마약류_인벤토리'));
    querySnapshot.forEach((doc) => {
        const data = doc.data();
        const row = `<tr>
            <td>${data.제품명}</td>
            <td>${data.성분명}</td>
            <td>${data.일련번호}</td>
            <td>${data.앰플용량}</td>
            <td>${data.총앰플수량}</td>
            <td>${data.잔여앰플수량}</td>
        </tr>`;
        마약류테이블.innerHTML += row;
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
            try {
                await addDoc(collection(db, '마약류_인벤토리'), {
                    제품명: item.제품명,
                    성분명: item.성분명,
                    일련번호: item.일련번호,
                    앰플용량: parseFloat(item.앰플용량),
                    총앰플수량: parseInt(item.총앰플수량),
                    잔여앰플수량: parseInt(item.잔여앰플수량),
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

// 페이지 로드 시 마약류 목록 로드
window.onload = function() {
    마약류로드();
}
