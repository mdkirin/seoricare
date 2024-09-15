import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js';

const firebaseConfig = {
    apiKey: "AIzaSyBTQsXAD6TCv-RLTM-2_LOH8Q91jIurvHo",
    authDomain: "seoricare.firebaseapp.com",
    projectId: "seoricare",
    storageBucket: "seoricare.appspot.com",
    messagingSenderId: "725312668828",
    appId: "1:725312668828:web:f4d6c038176ade87d09959"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
