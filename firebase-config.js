// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Your Firebase configuration for telepair
const firebaseConfig = {
  apiKey: "AIzaSyADV-lH0AWOXE-szuL0VY-sR9Y46xvxX1o",
  authDomain: "telepair-7584e.firebaseapp.com",
  projectId: "telepair-7584e",
  storageBucket: "telepair-7584e.firebasestorage.app",
  messagingSenderId: "54474214115",
  appId: "1:54474214115:web:75dadc1731cf91b50e13d6"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
