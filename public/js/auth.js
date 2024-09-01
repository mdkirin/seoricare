import { auth } from './firebase-config.js';
import { signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

// Logout function
function handleLogout() {
    signOut(auth).then(() => {
        window.location.href = 'login.html'; // Redirect to login on successful logout
    }).catch((error) => {
        console.error('Error during logout:', error);
    });
}

// Check authentication state
onAuthStateChanged(auth, user => {
    if (user) {
        document.getElementById('userStatus').innerText = `${user.email}님 환영합니다.`;
    } else {
        window.location.href = 'login.html'; // Redirect to login if not authenticated
    }
});

document.getElementById('logoutBtn').addEventListener('click', handleLogout);
