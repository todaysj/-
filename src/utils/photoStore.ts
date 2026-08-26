import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DB_NAME = 'JPlanner_Media_DB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';
const PHOTOS_COLLECTION = 'photos';

// In-memory fallback / quick cache
const memoryCache = new Map<string, string>();

let idbPromise: Promise<IDBDatabase | null> | null = null;

function getIDB(): Promise<IDBDatabase | null> {
  if (idbPromise) return idbPromise;
  if (typeof window === 'undefined' || !window.indexedDB) {
    idbPromise = Promise.resolve(null);
    return idbPromise;
  }

  idbPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return idbPromise;
}

/**
 * Save a photo dataUrl locally (IndexedDB + memory) and sync to Firestore
 */
export async function savePhotoLocal(photoId: string, dataUrl: string): Promise<void> {
  if (!photoId || !dataUrl) return;
  memoryCache.set(photoId, dataUrl);

  // 1. Save to IndexedDB
  try {
    const idb = await getIDB();
    if (idb) {
      await new Promise<void>((resolve) => {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(dataUrl, photoId);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  } catch {
    // Non-critical local save fallback
  }

  // 2. Asynchronously sync to Firestore collection so it is accessible on Netlify / mobile
  try {
    if (dataUrl.startsWith('data:image/') && dataUrl.length < 800000) {
      setDoc(doc(db, PHOTOS_COLLECTION, photoId), {
        dataUrl,
        updatedAt: Date.now()
      }, { merge: true }).catch(() => {});
    }
  } catch {}
}

/**
 * Retrieve a photo dataUrl:
 * 1. Memory Cache
 * 2. Local IndexedDB
 * 3. Firestore `photos` collection (for Netlify, other devices, or new browsers)
 */
export async function getPhotoLocal(photoId: string): Promise<string | null> {
  if (!photoId) return null;

  // 1. Check memory cache
  if (memoryCache.has(photoId)) {
    return memoryCache.get(photoId) || null;
  }

  // 2. Check local IndexedDB
  try {
    const idb = await getIDB();
    if (idb) {
      const localVal = await new Promise<string | null>((resolve) => {
        const tx = idb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(photoId);
        req.onsuccess = () => {
          const val = req.result as string | undefined;
          if (val) {
            resolve(val);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      });

      if (localVal) {
        memoryCache.set(photoId, localVal);
        return localVal;
      }
    }
  } catch {}

  // 3. Check Firestore `photos` collection if missing locally (e.g. on Netlify deploy)
  try {
    const docSnap = await getDoc(doc(db, PHOTOS_COLLECTION, photoId));
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data && typeof data.dataUrl === 'string') {
        const cloudDataUrl = data.dataUrl;
        memoryCache.set(photoId, cloudDataUrl);
        // Cache to local IndexedDB for future fast offline access
        try {
          const idb = await getIDB();
          if (idb) {
            const tx = idb.transaction(STORE_NAME, 'readwrite');
            tx.objectStore(STORE_NAME).put(cloudDataUrl, photoId);
          }
        } catch {}
        return cloudDataUrl;
      }
    }
  } catch {}

  return null;
}

/**
 * Save photo to both local store and Firestore
 */
export async function savePhotoToCloud(photoId: string, dataUrl: string): Promise<void> {
  await savePhotoLocal(photoId, dataUrl);
}

/**
 * Fetch photo from local or Firestore
 */
export async function getPhotoFromCloud(photoId: string): Promise<string | null> {
  return getPhotoLocal(photoId);
}

/**
 * Generate a deterministic or unique Photo ID
 */
export function generatePhotoId(seed?: string): string {
  if (seed) {
    return `photo_${seed.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  }
  return `photo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Helper to get all photos stored in local IndexedDB
 */
export async function getAllLocalPhotos(): Promise<{ photoId: string; dataUrl: string }[]> {
  try {
    const idb = await getIDB();
    if (!idb) return [];
    return new Promise((resolve) => {
      const tx = idb.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.openCursor();
      const results: { photoId: string; dataUrl: string }[] = [];
      req.onsuccess = (e: any) => {
        const cursor = e.target.result as IDBCursorWithValue;
        if (cursor) {
          results.push({ photoId: cursor.key as string, dataUrl: cursor.value as string });
          cursor.continue();
        } else {
          resolve(results);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}
