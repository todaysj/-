// ============================================================================
// 1. Firebase Firestore Configuration & Initialization
// firebaseConfig is loaded from the root configuration file: firebase-applet-config.json
// ============================================================================
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, setLogLevel, disableNetwork } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Configure log level to silent
try {
  setLogLevel('silent');
} catch (error) {
  // Silent log level
}

// Clear any accidental offline lockout flags from localStorage
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem('jplanner_quota_exceeded_until');
  } catch {}
}

// Initialize or reuse Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore Database
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

export { firebaseConfig, app };

