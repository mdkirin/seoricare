// firebase.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs,
    getDoc,  // 이 줄을 추가
    deleteDoc, 
    doc, 
    updateDoc, 
    setDoc, 
    where, 
    arrayUnion, 
    increment,
    query  // 이 줄을 추가
} from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

// Firebase 구성
const firebaseConfig = {
    apiKey: "AIzaSyBTQsXAD6TCv-RLTM-2_LOH8Q91jIurvHo",
    authDomain: "seoricare.firebaseapp.com",
    projectId: "seoricare",
    storageBucket: "seoricare.appspot.com",
    messagingSenderId: "725312668828",
    appId: "1:725312668828:web:f4d6c038176ade87d09959"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 로그아웃 함수
function handleLogout() {
    signOut(auth).then(() => {
        window.location.href = 'login.html'; // 로그아웃 성공 시 로그인 페이지로 리디렉션
    }).catch((error) => {
        console.error('로그아웃 중 오류 발생:', error);
    });
}

// 인증 상태 리스너
onAuthStateChanged(auth, user => {
    if (user) {
        const userStatus = document.getElementById('userStatus');
        if (userStatus) {
            userStatus.innerText = `${user.email}님 환영합니다.`;
        }
    } else {
        window.location.href = 'login.html'; // 인증되지 않은 경우 로그인 페이지로 리디렉션
    }
});

// 함수 및 변수 내보내기
export { 
    db, 
    handleLogout, 
    collection, 
    addDoc, 
    getDocs,
    getDoc,  // 이 줄을 추가
    deleteDoc, 
    doc, 
    updateDoc, 
    setDoc, 
    where, 
    arrayUnion, 
    increment,
    query  // 이 줄을 추가
};
