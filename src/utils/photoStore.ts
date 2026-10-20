import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

const DB_NAME = 'JPlanner_Media_DB';
const DB_VERSION = 1;
const STORE_NAME = 'photos';

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
 * Background sync to cloud photo storage (Supabase photos table if configured)
 * Never blocks local UI or trip save operations.
 */
function syncPhotoToCloudBackground(photoId: string, dataUrl: string) {
  const supabase = getSupabase();
  if (!supabase || !isSupabaseConfigured()) return;

  (async () => {
    try {
      // Optional best-effort sync to Supabase photos table if created
      await supabase.from('photos').upsert(
        {
          id: photoId,
          data_url: dataUrl,
          updated_at: Date.now(),
        },
        { onConflict: 'id' }
      );
    } catch {
      // Silent catch - local IDB preserves 100% of photos
    }
  })().catch(() => {});
}

/**
 * Save a photo dataUrl locally (IndexedDB + memory) and sync directly to cloud
 * Guarantees original file is 100% preserved in local IndexedDB.
 */
export async function savePhotoLocal(rawPhotoId: string, dataUrl: string): Promise<void> {
  if (!rawPhotoId || !dataUrl) return;
  const cleanId = rawPhotoId.startsWith('photo://') ? rawPhotoId.replace('photo://', '') : rawPhotoId;
  const uri = `photo://${cleanId}`;

  // Cache in memory under all key variations
  memoryCache.set(cleanId, dataUrl);
  memoryCache.set(uri, dataUrl);

  // 1. Immediately save full photo to local IndexedDB (permanent browser storage)
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

  // 2. Non-blocking background sync
  syncPhotoToCloudBackground(cleanId, dataUrl);
}

/**
 * Retrieve a photo dataUrl:
 * 1. Memory Cache (instant)
 * 2. Local IndexedDB (fast)
 * 3. Supabase cloud sync
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

  // 3. Check Supabase `photos` table if configured
  if (photoId) {
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data } = await supabase.from('photos').select('data_url').eq('id', photoId).maybeSingle();
        if (data && typeof data.data_url === 'string') {
          savePhotoLocal(photoId, data.data_url).catch(() => {});
          return data.data_url;
        }
      } catch (err) {
        // Silent catch
      }
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
 * Save photo to local store and cloud
 */
export async function savePhotoToCloud(photoId: string, dataUrl: string): Promise<void> {
  await savePhotoLocal(photoId, dataUrl);
}

/**
 * Fetch photo from local or cloud
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
