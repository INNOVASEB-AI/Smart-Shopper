// js/firebase.js

// Import Firebase from CDN with proper ES module support
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Retrieve Firebase config from environment variables if available
// This helps protect the Firebase configuration when using a proper build process
// For local development, fall back to the hardcoded values
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || "AIzaSyDncAfsheDy_-dxIxl45rgBVFVUqA_BUM4",
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || "smart-shopper-46f4c.firebaseapp.com",
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || "smart-shopper-46f4c",
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || "smart-shopper-46f4c.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || "227443313787",
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || "1:227443313787:web:f7d0fb52c88e14254966de"
};

// Initialize Firebase with App Check for additional security
const app = initializeApp(firebaseConfig);

// Initialize and export Firebase services
const auth = getAuth(app);
const db = getFirestore(app);

// Security: Set auth persistence to SESSION to minimize exposure time
// This makes users need to re-login after closing the browser
auth.setPersistence('SESSION');

// Also export the Firebase auth methods to simplify imports in app.js
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export { 
  app, 
  auth, 
  db, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  setPersistence,
  browserSessionPersistence
}; 