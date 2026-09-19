import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

// ▼▼ Firebase web app config — Kimbia TZ (project: newproject-fa93d) ▼▼
const firebaseConfig = {
  apiKey: 'AIzaSyCKVvDuVLdqMKMunYpk6tE9Qmo3At_PTE0',
  authDomain: 'newproject-fa93d.firebaseapp.com',
  projectId: 'newproject-fa93d',
  storageBucket: 'newproject-fa93d.firebasestorage.app',
  messagingSenderId: '67104270872',
  appId: '1:67104270872:web:0eb9b50b493ac2ba14b16d',
  measurementId: 'G-EDLQGJ0CR4',
};
// ▲▲▲

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'africa-south1'); // must match deployed functions
export const storage = getStorage(app);
