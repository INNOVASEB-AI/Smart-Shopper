// js/firebase.js

// Import Firebase from CDN with proper ES module support
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDncAfsheDy_-dxIxl45rgBVFVUqA_BUM4",
  authDomain: "smart-shopper-46f4c.firebaseapp.com",
  projectId: "smart-shopper-46f4c",
  storageBucket: "smart-shopper-46f4c.firebasestorage.app",
  messagingSenderId: "227443313787",
  appId: "1:227443313787:web:f7d0fb52c88e14254966de"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Also export the Firebase auth methods to simplify imports in app.js
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export { 
  app, 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
}; 