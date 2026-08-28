// ============================================================================
// 1. Firebase Firestore Configuration & Initialization
// firebaseConfig is loaded from the root configuration file: firebase-applet-config.json
// ============================================================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Configure log level for debugging
try {
  setLogLevel('error');
} catch (error) {
  console.error('상세 에러 (Firebase LogLevel):', error);
}

// Initialize or reuse Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore Database
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export { firebaseConfig, app };
