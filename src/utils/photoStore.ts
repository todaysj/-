import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { isQuotaExceeded, isQuotaError, setQuotaExceeded } from '../lib/tripService';

const DB_NAME = 'JPlanner_Media_DB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';
const PHOTOS_COLLECTION = 'photos';

// In-memory fallback / instant cache
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
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return idbPromise;
}

/**
 * Compress an image dataUrl specifically for cloud document storage (<300KB)
 */
async function compressForCloudDoc(dataUrl: string): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return dataUrl;
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.onload = () => {
        try {
          const maxDim = 800;
          let w = img.naturalWidth || img.width || 800;
          let h = img.naturalHeight || img.height || 800;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(dataUrl);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          let res = canvas.toDataURL('image/webp', 0.75);
          if (!res.startsWith('data:image/webp') || res.length < 50) {
            res = canvas.toDataURL('image/jpeg', 0.75);
          }
          resolve(res);
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    } catch {
      resolve(dataUrl);
    }
  });
}

/**
 * Background sync to dedicated cloud photo storage (Firestore /photos/{photoId})
 * Never blocks local UI or trip save operations.
 */
function syncPhotoToCloudBackground(photoId: string, dataUrl: string) {
  if (isQuotaExceeded()) return;

  (async () => {
    try {
      let uploadPayload = dataUrl;
      // If photo is over 350KB, compress to a compact cloud document to guarantee it never exceeds 1MB limit
      if (dataUrl.length > 350000) {
        try {
          const compressed = await compressForCloudDoc(dataUrl);
          if (compressed && compressed.length < dataUrl.length) {
            uploadPayload = compressed;
          }
        } catch {
          // fallback to original payload
        }
      }

      // Hard safeguard: never write a document over 900KB to Firestore
      if (uploadPayload.length > 900000) {
        console.warn(`[PhotoStore] Photo ${photoId} exceeds 900KB safety limit. Kept 100% in local IndexedDB.`);
        return;
      }

      await setDoc(
        doc(db, PHOTOS_COLLECTION, photoId),
        {
          dataUrl: uploadPayload,
          updatedAt: Date.now()
        },
        { merge: true }
      );
    } catch (err: any) {
      if (isQuotaError(err)) {
        setQuotaExceeded();
      } else {
        console.warn('[PhotoStore] Cloud photo sync notice:', err?.message || err);
      }
    }
  })().catch(() => {});
}

/**
 * Save a photo dataUrl locally (IndexedDB + memory) and sync directly to dedicated Firestore `/photos/{photoId}`
 * Guarantees original high-definition file is 100% preserved in local IndexedDB.
 */
export async function savePhotoLocal(rawPhotoId: string, dataUrl: string): Promise<void> {
  if (!rawPhotoId || !dataUrl) return;
  const cleanId = rawPhotoId.startsWith('photo://') ? rawPhotoId.replace('photo://', '') : rawPhotoId;
  const uri = `photo://${cleanId}`;

  // Cache in memory under all key variations
  memoryCache.set(cleanId, dataUrl);
  memoryCache.set(uri, dataUrl);

  // 1. Immediately save full original HD photo to local IndexedDB (permanent browser storage)
  try {
    const idb = await getIDB();
    if (idb) {
      await new Promise<void>((resolve) => {
        const tx = idb.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put(dataUrl, cleanId);
        store.put(dataUrl, uri);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      });
    }
  } catch (err) {
    console.warn('[PhotoStore] IndexedDB save notice:', err);
  }

  // 2. Non-blocking background sync to separate cloud photo storage
  syncPhotoToCloudBackground(cleanId, dataUrl);
}

/**
 * Retrieve a photo dataUrl:
 * 1. Memory Cache (instant)
 * 2. Local IndexedDB (fast)
 * 3. Firestore `photos` collection (cross-device cloud sync)
 * 4. Comprehensive recovery from `trips_backups`, `trips_cache`, and cursor scan in `JPlanner_Media_DB`
 */
export async function getPhotoLocal(
  rawPhotoId: string,
  fallbackItemId?: string,
  fallbackItemTitle?: string
): Promise<string | null> {
  if (!rawPhotoId && !fallbackItemId && !fallbackItemTitle) return null;
  const photoId = rawPhotoId ? (rawPhotoId.startsWith('photo://') ? rawPhotoId.replace('photo://', '') : rawPhotoId) : '';
  const uri = photoId ? `photo://${photoId}` : '';

  // 1. Check memory cache
  if (photoId && memoryCache.has(photoId)) {
    return memoryCache.get(photoId) || null;
  }
  if (uri && memoryCache.has(uri)) {
    return memoryCache.get(uri) || null;
  }

  // 2. Check local IndexedDB (JPlanner_Media_DB)
  try {
    const idb = await getIDB();
    if (idb) {
      const localVal = await new Promise<string | null>((resolve) => {
        const tx = idb.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req1 = photoId ? store.get(photoId) : null;
        if (req1) {
          req1.onsuccess = () => {
            const val1 = req1.result as string | undefined;
            if (val1) return resolve(val1);
            if (uri) {
              const req2 = store.get(uri);
              req2.onsuccess = () => resolve((req2.result as string | undefined) || null);
              req2.onerror = () => resolve(null);
            } else {
              resolve(null);
            }
          };
          req1.onerror = () => resolve(null);
        } else if (uri) {
          const req2 = store.get(uri);
          req2.onsuccess = () => resolve((req2.result as string | undefined) || null);
          req2.onerror = () => resolve(null);
        } else {
          resolve(null);
        }
      });

      if (localVal) {
        if (photoId) memoryCache.set(photoId, localVal);
        if (uri) memoryCache.set(uri, localVal);
        return localVal;
      }

      // 2b. Cursor scan JPlanner_Media_DB if key contains fallbackItemId or photoId
      if (fallbackItemId || photoId) {
        const targetToken = fallbackItemId || photoId;
        const matched = await new Promise<string | null>((resolve) => {
          const tx = idb.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.openCursor();
          req.onsuccess = (e: any) => {
            const cursor = e.target.result as IDBCursorWithValue;
            if (cursor) {
              const k = String(cursor.key);
              if (k.includes(targetToken)) {
                return resolve(cursor.value as string);
              }
              cursor.continue();
            } else {
              resolve(null);
            }
          };
          req.onerror = () => resolve(null);
        });

        if (matched) {
          if (photoId) savePhotoLocal(photoId, matched).catch(() => {});
          return matched;
        }
      }
    }
  } catch {}

  // 3. Check Firestore `photos` collection (cross-device cloud sync)
  if (photoId) {
    try {
      const docSnap = await getDoc(doc(db, PHOTOS_COLLECTION, photoId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data && typeof data.dataUrl === 'string') {
          const cloudDataUrl = data.dataUrl;
          savePhotoLocal(photoId, cloudDataUrl).catch(() => {});
          return cloudDataUrl;
        }
      }
    } catch (err) {
      console.warn('Photo cloud fetch notice:', err);
    }
  }

  // 4. Search local backups in `JPlanner_Trips_DB` (both `trips_backups` and `trips_cache`)
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      const tripsIDB = await new Promise<IDBDatabase | null>((resolve) => {
        const req = window.indexedDB.open('JPlanner_Trips_DB', 1);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });

      if (tripsIDB) {
        const candidateTrips: any[] = [];

        // 4a. Read backups
        if (tripsIDB.objectStoreNames.contains('trips_backups')) {
          const backups = await new Promise<any[]>((resolve) => {
            const tx = tripsIDB.transaction('trips_backups', 'readonly');
            const store = tx.objectStore('trips_backups');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });
          for (const b of backups) {
            if (b?.trip) candidateTrips.push(b.trip);
          }
        }

        // 4b. Read cached trips
        if (tripsIDB.objectStoreNames.contains('trips_cache')) {
          const cached = await new Promise<any[]>((resolve) => {
            const tx = tripsIDB.transaction('trips_cache', 'readonly');
            const store = tx.objectStore('trips_cache');
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
          });
          for (const c of cached) {
            if (c) candidateTrips.push(c);
          }
        }

        // Search through candidate trips for matching photo base64
        for (const t of candidateTrips) {
          const checkItem = (item: any): string | null => {
            if (!item) return null;
            const matchesId = fallbackItemId && item.id === fallbackItemId;
            const matchesPhotoId = photoId && (photoId.includes(item.id) || (typeof item.imageUrl === 'string' && item.imageUrl.includes(photoId)));
            const matchesTitle = fallbackItemTitle && item.title && item.title.trim() === fallbackItemTitle.trim();

            if (matchesId || matchesPhotoId || matchesTitle) {
              if (item.images && Array.isArray(item.images)) {
                for (const img of item.images) {
                  if (typeof img === 'string' && img.startsWith('data:image/')) {
                    if (photoId) savePhotoLocal(photoId, img).catch(() => {});
                    return img;
                  }
                }
              }
              if (typeof item.imageUrl === 'string' && item.imageUrl.startsWith('data:image/')) {
                if (photoId) savePhotoLocal(photoId, item.imageUrl).catch(() => {});
                return item.imageUrl;
              }
            }
            return null;
          };

          if (t.souvenirTabs && Array.isArray(t.souvenirTabs)) {
            for (const tab of t.souvenirTabs) {
              for (const item of tab.items || []) {
                const found = checkItem(item);
                if (found) return found;
              }
            }
          }
          if (t.souvenirs && Array.isArray(t.souvenirs)) {
            for (const item of t.souvenirs) {
              const found = checkItem(item);
              if (found) return found;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Backup photo recovery notice:', err);
  }

  // 5. Search localStorage for any JSON backup dumps or cached trips
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes('trip') || k.includes('jplanner') || k.includes('backup'))) {
          const val = localStorage.getItem(k);
          if (val && (fallbackItemId || fallbackItemTitle) && val.includes(fallbackItemId || fallbackItemTitle || '')) {
            try {
              const parsed = JSON.parse(val);
              // Quick recursive search for data:image/ in the parsed item
              const searchInObj = (obj: any): string | null => {
                if (!obj || typeof obj !== 'object') return null;
                if ((obj.id === fallbackItemId || obj.title === fallbackItemTitle) && (obj.images || obj.imageUrl)) {
                  if (Array.isArray(obj.images)) {
                    for (const img of obj.images) {
                      if (typeof img === 'string' && img.startsWith('data:image/')) return img;
                    }
                  }
                  if (typeof obj.imageUrl === 'string' && obj.imageUrl.startsWith('data:image/')) return obj.imageUrl;
                }
                for (const subKey of Object.keys(obj)) {
                  const sub = searchInObj(obj[subKey]);
                  if (sub) return sub;
                }
                return null;
              };
              const found = searchInObj(parsed);
              if (found) {
                if (photoId) savePhotoLocal(photoId, found).catch(() => {});
                return found;
              }
            } catch {}
          }
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Convenience helper to get photo by either photoId, itemId, or itemTitle
 */
export async function getPhotoByItemOrFallback(
  rawPhotoId: string,
  itemId?: string,
  itemTitle?: string
): Promise<string | null> {
  return getPhotoLocal(rawPhotoId, itemId, itemTitle);
}

/**
 * Scans all souvenir items in a trip and automatically recovers any missing photos
 * from IndexedDB backups, cache, and dedicated photo storage.
 */
export async function recoverAllTripPhotos(trip: any): Promise<{ trip: any; recoveredCount: number }> {
  if (!trip) return { trip, recoveredCount: 0 };
  const cloned = JSON.parse(JSON.stringify(trip));
  let recoveredCount = 0;

  const processItem = async (item: any) => {
    if (!item) return;
    const hasCurrentImages =
      (item.images && item.images.length > 0 && item.images.some((img: string) => img && img.trim() !== '')) ||
      Boolean(item.imageUrl && item.imageUrl.trim() !== '');

    // Case 1: Item has photo:// URIs -> resolve them
    if (item.images && Array.isArray(item.images)) {
      const resolvedList: string[] = [];
      for (const img of item.images) {
        if (typeof img === 'string' && img.startsWith('photo://')) {
          const resolved = await getPhotoLocal(img, item.id, item.title);
          if (resolved) {
            resolvedList.push(resolved);
            recoveredCount++;
          } else {
            resolvedList.push(img);
          }
        } else if (img && img.trim() !== '') {
          resolvedList.push(img);
        }
      }
      if (resolvedList.length > 0) {
        item.images = resolvedList;
        item.imageUrl = resolvedList[0];
      }
    }

    if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('photo://')) {
      const resolved = await getPhotoLocal(item.imageUrl, item.id, item.title);
      if (resolved) {
        item.imageUrl = resolved;
        if (!item.images || item.images.length === 0) {
          item.images = [resolved];
        }
        recoveredCount++;
      }
    }

    // Case 2: Item is completely missing images -> search backups & cache
    const stillHasNoImages =
      (!item.images || item.images.length === 0 || item.images.every((img: string) => !img || img.trim() === '')) &&
      (!item.imageUrl || item.imageUrl.trim() === '');

    if (stillHasNoImages) {
      const recovered = await getPhotoLocal('', item.id, item.title);
      if (recovered) {
        item.imageUrl = recovered;
        item.images = [recovered];
        recoveredCount++;
      }
    }
  };

  if (cloned.souvenirTabs && Array.isArray(cloned.souvenirTabs)) {
    for (const tab of cloned.souvenirTabs) {
      for (const item of tab.items || []) {
        await processItem(item);
      }
    }
  }

  if (cloned.souvenirs && Array.isArray(cloned.souvenirs)) {
    for (const item of cloned.souvenirs) {
      await processItem(item);
    }
  }

  return { trip: cloned, recoveredCount };
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
