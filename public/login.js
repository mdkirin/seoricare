import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyBTQsXAD6TCv-RLTM-2_LOH8Q91jIurvHo",
    authDomain: "seoricare.firebaseapp.com",
    projectId: "seoricare",
    storageBucket: "seoricare.appspot.com",
    messagingSenderId: "725312668828",
    appId: "1:725312668828:web:f4d6c038176ade87d09959"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
const loginBtn = document.getElementById('loginBtn');
const signUpBtn = document.getElementById('signUpBtn');
const logoutBtn = document.getElementById('logoutBtn');

loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        Swal.fire('오류', '이메일과 비밀번호를 모두 입력하세요.', 'error');
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Firestore에서 사용자 이름 불러오기
        const userDoc = await getDoc(doc(db, '사용자', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            document.getElementById('userName').textContent = userData.name; // 사용자 이름 표시
        }

        Swal.fire('성공', '로그인 성공!', 'success').then(() => {
            window.location.href = 'scheduler.html'; // Redirect to the scheduler page after successful login
        });
    } catch (error) {
        Swal.fire('오류', '로그인에 실패했습니다. 이메일과 비밀번호를 확인하세요.', 'error');
    }
});

signUpBtn.addEventListener('click', async () => {
    const name = document.getElementById('name').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    if (!name || !email || !password) {
        showAlert('모든 필드를 입력하세요.');
        return;
    }

    try {
        // Firebase에 사용자 등록
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Firestore에 사용자 정보 저장
        await setDoc(doc(db, '사용자', user.uid), {
            name: name,
            email: email
        });

        showAlert('회원가입 성공!');
        document.getElementById('signupModal').classList.add('hidden'); // 모달 닫기
    } catch (error) {
        console.error('회원가입 중 오류 발생:', error);
        showAlert('회원가입 중 오류가 발생했습니다.');
    }
});

// 로그아웃 버튼 클릭 시
logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut(); // 로그아웃 처리
        window.location.href = 'index.html'; // 로그아웃 후 index.html로 리디렉션
    } catch (error) {
        console.error('로그아웃 중 오류 발생:', error);
        showAlert('로그아웃 중 오류가 발생했습니다.');
    }
});

// 알림 함수
function showAlert(message) {
    const alertElement = document.getElementById('custom-alert');
    const alertMessage = document.getElementById('alert-message');
    alertMessage.textContent = message;
    alertElement.classList.remove('opacity-0');
    alertElement.classList.add('opacity-100');
    setTimeout(() => {
        alertElement.classList.remove('opacity-100');
        alertElement.classList.add('opacity-0');
    }, 3000);
}
