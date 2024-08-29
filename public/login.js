// Import Firebase SDK and initialize Firebase
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyBhrWAlYTe_iiqsuDBXNV5WVGaw7f19XaI",
    authDomain: "srd-scheduler-1a4b6.firebaseapp.com",
    projectId: "srd-scheduler-1a4b6",
    storageBucket: "srd-scheduler-1a4b6.appspot.com",
    messagingSenderId: "36170465039",
    appId: "1:36170465039:web:8a67ce81c876d97176887a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM elements
const loginBtn = document.getElementById('loginBtn');
const signUpBtn = document.getElementById('signUpBtn');

loginBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        Swal.fire('오류', '이메일과 비밀번호를 모두 입력하세요.', 'error');
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        Swal.fire('성공', '로그인 성공!', 'success').then(() => {
            window.location.href = 'scheduler.html'; // Redirect to the scheduler page after successful login
        });
    } catch (error) {
        Swal.fire('오류', '로그인에 실패했습니다. 이메일과 비밀번호를 확인하세요.', 'error');
    }
});

signUpBtn.addEventListener('click', async () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    if (!email || !password) {
        Swal.fire('오류', '이메일과 비밀번호를 모두 입력하세요.', 'error');
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        Swal.fire('성공', '회원가입이 완료되었습니다. 로그인해주세요.', 'success');
    } catch (error) {
        Swal.fire('오류', '회원가입에 실패했습니다. 이미 존재하는 이메일이거나 비밀번호가 너무 짧습니다.', 'error');
    }
});
