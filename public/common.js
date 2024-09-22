import { auth, db, onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, getDoc, doc } from './firebase.js';

const userNameElement = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, '사용자', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            userNameElement.textContent = userData.name;
        } else {
            userNameElement.textContent = '사용자';
        }
    } else {
        userNameElement.textContent = '';
    }
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (error) {
            console.error('로그아웃 중 오류 발생:', error);
        }
    });
}

// DOM elements
const loginBtn = document.getElementById('loginBtn');
const signUpBtn = document.getElementById('signUpBtn');

if (loginBtn) {
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
}

if (signUpBtn) {
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
}
