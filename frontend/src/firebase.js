import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './firebaseConfig';

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Export Firestore database reference
export const db = getFirestore(app);
