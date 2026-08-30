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

// Intercept window error and unhandledrejection for resource-exhausted Firestore logs
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const str = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    if (
      str.includes('resource-exhausted') ||
      str.includes('Quota limit exceeded') ||
      str.includes('Free daily write units') ||
      str.includes('Using maximum backoff delay')
    ) {
      // Suppress noisy Firestore quota backoff logs
      try {
        localStorage.setItem('jplanner_quota_exceeded_until', (Date.now() + 24 * 60 * 60 * 1000).toString());
      } catch {}
      return;
    }
    originalConsoleError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reasonStr = String(event.reason?.message || event.reason || '');
    if (
      reasonStr.includes('resource-exhausted') ||
      reasonStr.includes('Quota limit exceeded') ||
      reasonStr.includes('Free daily write units')
    ) {
      event.preventDefault();
      try {
        localStorage.setItem('jplanner_quota_exceeded_until', (Date.now() + 24 * 60 * 60 * 1000).toString());
      } catch {}
    }
  });
}

// Initialize or reuse Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore Database
export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// If quota is marked as exceeded in localStorage, disable network right away
if (typeof window !== 'undefined') {
  try {
    const quotaUntil = localStorage.getItem('jplanner_quota_exceeded_until');
    if (quotaUntil && Number(quotaUntil) > Date.now()) {
      disableNetwork(db).catch(() => {});
    }
  } catch {}
}

export { firebaseConfig, app };

