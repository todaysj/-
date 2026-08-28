import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Trip, TabType, SouvenirTabConfig, ChecklistTabConfig, ScheduleItem, Reservation, ExpenseItem, PackingItem } from '../types';
import { INITIAL_TRIPS } from '../data/mockData';
import { detachTripPhotos, resolveTripPhotos } from '../utils/imageUtils';
import { getTripSouvenirTabs, getTripChecklistTabs, unionSouvenirItems, DEFAULT_PACKING_CATEGORIES, DEFAULT_SOUVENIR_TAGS } from '../utils/tabUtils';
import { saveTripBackup, saveTripsToIDB, getTripsFromIDB } from '../utils/tripIndexedDB';

const TRIPS_COLLECTION = 'trips';
const STORAGE_TRIPS_KEY = 'jplanner_trips_cache';
const STORAGE_BRAND_KEY = 'jplanner_brand_settings_cache';

export type SyncStatus = 'connecting' | 'synced' | 'saving' | 'error';

export interface SyncStatusInfo {
  status: SyncStatus;
  message?: string;
  timestamp: number;
}

// Global sync listeners
const syncStatusListeners = new Set<(info: SyncStatusInfo) => void>();
const firestoreErrorListeners = new Set<(errorMsg: string, rawError?: any) => void>();

let currentSyncStatus: SyncStatusInfo = {
  status: 'connecting',
  message: 'DB 연결 중...',
  timestamp: Date.now()
};

export function subscribeToSyncStatus(listener: (info: SyncStatusInfo) => void) {
  syncStatusListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    syncStatusListeners.delete(listener);
  };
}

export function subscribeToFirestoreErrors(listener: (errorMsg: string, rawError?: any) => void) {
  firestoreErrorListeners.add(listener);
  return () => {
    firestoreErrorListeners.delete(listener);
  };
}

export function updateSyncStatus(status: SyncStatus, message?: string) {
  currentSyncStatus = {
    status,
    message,
    timestamp: Date.now()
  };
  syncStatusListeners.forEach((listener) => {
    try {
      listener(currentSyncStatus);
    } catch (err) {
      console.error('상세 에러 (SyncStatus Listener):', err);
    }
  });
}

export function notifyFirestoreError(userFriendlyMsg: string, rawError?: any) {
  console.error('상세 에러 (Firestore):', userFriendlyMsg, rawError);
  updateSyncStatus('error', userFriendlyMsg);
  firestoreErrorListeners.forEach((listener) => {
    try {
      listener(userFriendlyMsg, rawError);
    } catch (err) {
      console.error('상세 에러 (FirestoreError Listener):', err);
    }
  });
}

// Clear any stale local quota limits
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('jplanner_quota_exceeded_until');
  }
} catch (error) {
  console.error('상세 에러 (localStorage clear):', error);
}

// Pending trip writes debounce trackers
const pendingTripWrites = new Map<string, ReturnType<typeof setTimeout>>();
let pendingBrandTimer: ReturnType<typeof setTimeout> | null = null;

export function removeUndefinedDeep<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => removeUndefinedDeep(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const key of Object.keys(obj as Record<string, any>)) {
      const val = (obj as Record<string, any>)[key];
      if (val !== undefined) {
        res[key] = removeUndefinedDeep(val);
      }
    }
    return res as T;
  }
  return obj;
}

export function sanitizeForFirestore<T>(data: T): T {
  const cloned = removeUndefinedDeep(JSON.parse(JSON.stringify(data)));
  if (cloned && typeof cloned === 'object') {
    const trip = cloned as Record<string, any>;
    if (trip.souvenirTabs && Array.isArray(trip.souvenirTabs) && trip.souvenirTabs.length > 0) {
      delete trip.souvenirs;
    }
    if (trip.checklistTabs && Array.isArray(trip.checklistTabs) && trip.checklistTabs.length > 0) {
      delete trip.packingList;
    }
  }
  return removeUndefinedDeep(cloned);
}

/**
 * Load cached trips from browser localStorage (or fallback to INITIAL_TRIPS)
 */
export function getStoredTrips(): Trip[] {
  try {
    const cached = localStorage.getItem(STORAGE_TRIPS_KEY);
    if (cached !== null) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.error('상세 에러 (getStoredTrips):', error);
  }
  return INITIAL_TRIPS;
}

/**
 * Save trips list to browser localStorage cache
 */
export function saveTripsToLocalStorage(trips: Trip[]): void {
  try {
    localStorage.setItem(STORAGE_TRIPS_KEY, JSON.stringify(trips));
  } catch (error) {
    console.error('상세 에러 (saveTripsToLocalStorage):', error);
  }
}

/**
 * Load cached brand settings from browser localStorage
 */
export function getStoredBrandSettings() {
  const defaults = {
    title: 'J플래너',
    subtitle: '스마트 여행 일정 & 예약 보관함',
    badge: 'MBTI J전용',
    tabOrder: ['itinerary', 'map', 'reservations', 'budget', 'checklist', 'souvenirs'] as TabType[],
    adminPassword: '1205',
    tripOrder: [] as string[]
  };

  try {
    const cached = localStorage.getItem(STORAGE_BRAND_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const res = { ...defaults, ...parsed };
      if (res.adminPassword) {
        try {
          localStorage.setItem('jplanner_site_password', res.adminPassword);
        } catch (pwErr) {
          console.error('상세 에러 (site_password cache):', pwErr);
        }
      }
      return res;
    }
  } catch (error) {
    console.error('상세 에러 (getStoredBrandSettings):', error);
  }
  return defaults;
}

/**
 * Intelligently reconciles a local trip with a remote trip from Firestore.
 * GUARANTEE: Never drops any souvenir item, packing item, schedule item, reservation, or expense!
 */
export function reconcileSingleTrip(localTrip: Trip | undefined, remoteTrip: Trip): Trip {
  if (!localTrip) return remoteTrip;

  const isLocalPreferred =
    (localTrip.updatedAt || 0) >= (remoteTrip.updatedAt || 0) || pendingTripWrites.has(remoteTrip.id);

  const baseTrip: Trip = isLocalPreferred
    ? JSON.parse(JSON.stringify(localTrip))
    : JSON.parse(JSON.stringify(remoteTrip));

  const otherTrip: Trip = isLocalPreferred ? remoteTrip : localTrip;

  // 1. Merge Souvenir Tabs & Items with 0% data loss
  const baseSouvenirTabs = getTripSouvenirTabs(baseTrip);
  const otherSouvenirTabs = getTripSouvenirTabs(otherTrip);

  const mergedSouvenirTabs: SouvenirTabConfig[] = [];
  const processedTabIds = new Set<string>();

  for (const baseTab of baseSouvenirTabs) {
    processedTabIds.add(baseTab.id);
    const matchingOther = otherSouvenirTabs.find((t) => t.id === baseTab.id);
    const combinedItems = matchingOther
      ? unionSouvenirItems(baseTab.items || [], matchingOther.items || [])
      : baseTab.items || [];
    mergedSouvenirTabs.push({
      ...baseTab,
      items: combinedItems,
      tags: baseTab.tags && baseTab.tags.length > 0 ? baseTab.tags : matchingOther?.tags || DEFAULT_SOUVENIR_TAGS,
      tagColors: {
        ...(matchingOther?.tagColors || {}),
        ...(baseTab.tagColors || {})
      }
    });
  }

  for (const otherTab of otherSouvenirTabs) {
    if (!processedTabIds.has(otherTab.id)) {
      mergedSouvenirTabs.push(otherTab);
    }
  }

  baseTrip.souvenirTabs = mergedSouvenirTabs;
  baseTrip.souvenirs = mergedSouvenirTabs[0]?.items || [];

  // 2. Merge Checklist Tabs & Items
  const baseChecklistTabs = getTripChecklistTabs(baseTrip);
  const otherChecklistTabs = getTripChecklistTabs(otherTrip);
  const mergedChecklistTabs: ChecklistTabConfig[] = [];
  const processedClTabIds = new Set<string>();

  for (const baseTab of baseChecklistTabs) {
    processedClTabIds.add(baseTab.id);
    const matchingOther = otherChecklistTabs.find((t) => t.id === baseTab.id);
    const itemMap = new Map<string, PackingItem>();
    for (const item of baseTab.items || []) {
      if (item?.id) itemMap.set(item.id, item);
    }
    if (matchingOther) {
      for (const item of matchingOther.items || []) {
        if (item?.id && !itemMap.has(item.id)) {
          itemMap.set(item.id, item);
        }
      }
    }
    mergedChecklistTabs.push({
      ...baseTab,
      items: Array.from(itemMap.values()),
      categories: baseTab.categories || matchingOther?.categories || DEFAULT_PACKING_CATEGORIES
    });
  }
  for (const otherTab of otherChecklistTabs) {
    if (!processedClTabIds.has(otherTab.id)) {
      mergedChecklistTabs.push(otherTab);
    }
  }
  baseTrip.checklistTabs = mergedChecklistTabs;
  baseTrip.packingList = mergedChecklistTabs[0]?.items || [];

  // 3. Merge Schedule Items
  const scheduleMap = new Map<string, ScheduleItem>();
  for (const item of baseTrip.schedule || []) {
    if (item?.id) scheduleMap.set(item.id, item);
  }
  for (const item of otherTrip.schedule || []) {
    if (item?.id && !scheduleMap.has(item.id)) {
      scheduleMap.set(item.id, item);
    }
  }
  baseTrip.schedule = Array.from(scheduleMap.values());

  // 4. Merge Reservations
  const resMap = new Map<string, Reservation>();
  for (const item of baseTrip.reservations || []) {
    if (item?.id) resMap.set(item.id, item);
  }
  for (const item of otherTrip.reservations || []) {
    if (item?.id && !resMap.has(item.id)) {
      resMap.set(item.id, item);
    }
  }
  baseTrip.reservations = Array.from(resMap.values());

  // 5. Merge Expenses
  const expMap = new Map<string, ExpenseItem>();
  for (const item of baseTrip.expenses || []) {
    if (item?.id) expMap.set(item.id, item);
  }
  for (const item of otherTrip.expenses || []) {
    if (item?.id && !expMap.has(item.id)) {
      expMap.set(item.id, item);
    }
  }
  baseTrip.expenses = Array.from(expMap.values());

  return baseTrip;
}

/**
 * Save trip to local cache, IndexedDB backup history, and direct to Firestore
 */
export async function saveTripToFirestore(trip: Trip): Promise<void> {
  const timestampedTrip: Trip = {
    ...trip,
    updatedAt: Date.now()
  };

  updateSyncStatus('saving', '데이터 저장 중...');

  // 1. Immediately create a safety backup in IndexedDB
  saveTripBackup(timestampedTrip).catch((err) => {
    console.error('상세 에러 (saveTripBackup):', err);
  });

  // 2. Synchronously update browser cache & IndexedDB with full data for instant local response
  try {
    const currentTrips = getStoredTrips();
    const exists = currentTrips.some((t) => t.id === timestampedTrip.id);
    const updatedTrips = exists
      ? currentTrips.map((t) => (t.id === timestampedTrip.id ? timestampedTrip : t))
      : [timestampedTrip, ...currentTrips];
    saveTripsToLocalStorage(updatedTrips);
    saveTripsToIDB(updatedTrips).catch((err) => {
      console.error('상세 에러 (saveTripsToIDB):', err);
    });
  } catch (err) {
    console.error('상세 에러 (saveTripToFirestore local cache):', err);
  }

  // 3. Prepare clean trip: upload photos to Firestore `/photos/{photoId}` and replace with `photo://${photoId}`
  let cleanTrip: Trip;
  try {
    const detached = await detachTripPhotos(timestampedTrip);
    cleanTrip = sanitizeForFirestore(detached);
  } catch (e) {
    console.error('상세 에러 (detachTripPhotos):', e);
    cleanTrip = sanitizeForFirestore(timestampedTrip);
  }

  // 4. Quick debounce and write directly to Firestore `/trips/{cleanTrip.id}`
  const existingTimer = pendingTripWrites.get(cleanTrip.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    pendingTripWrites.delete(cleanTrip.id);
    const safePayload = sanitizeForFirestore(cleanTrip);
    try {
      await setDoc(doc(db, TRIPS_COLLECTION, safePayload.id), safePayload, { merge: true });
      updateSyncStatus('synced', '실시간 동기화됨');
    } catch (err: any) {
      console.error('상세 에러 (Firestore setDoc retry):', err);
      try {
        const fallbackTrip = sanitizeForFirestore(safePayload);
        await setDoc(doc(db, TRIPS_COLLECTION, fallbackTrip.id), fallbackTrip, { merge: true });
        updateSyncStatus('synced', '실시간 동기화됨');
      } catch (finalErr: any) {
        console.error('상세 에러 (Firestore setDoc final):', finalErr);
        const errMsg = finalErr?.code === 'permission-denied'
          ? 'Firebase 데이터 저장 권한이 거부되었습니다 (Permission Denied).'
          : '클라우드 데이터 저장에 실패했습니다. 네트워크를 확인해주세요.';
        notifyFirestoreError(errMsg, finalErr);
      }
    }
  }, 40);

  pendingTripWrites.set(cleanTrip.id, timer);
}

/**
 * Delete trip from local cache, IndexedDB, and Firestore
 */
export async function deleteTripFromFirestore(tripId: string): Promise<void> {
  const existingTimer = pendingTripWrites.get(tripId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    pendingTripWrites.delete(tripId);
  }

  updateSyncStatus('saving', '여행 삭제 중...');

  // 1. Immediately update browser cache and IndexedDB
  try {
    const currentTrips = getStoredTrips();
    const updatedTrips = currentTrips.filter((t) => t.id !== tripId);
    saveTripsToLocalStorage(updatedTrips);
    saveTripsToIDB(updatedTrips).catch((err) => {
      console.error('상세 에러 (deleteTrip IDB):', err);
    });
  } catch (err) {
    console.error('상세 에러 (deleteTrip local cache):', err);
  }

  // 2. Delete from Firestore
  try {
    await deleteDoc(doc(db, TRIPS_COLLECTION, tripId));
    updateSyncStatus('synced', '실시간 동기화됨');
  } catch (err: any) {
    console.error('상세 에러 (deleteDoc from Firestore):', err);
    const errMsg = err?.code === 'permission-denied'
      ? 'Firebase 삭제 권한이 거부되었습니다 (Permission Denied).'
      : '클라우드 여행 삭제 중 오류가 발생했습니다.';
    notifyFirestoreError(errMsg, err);
  }
}

/**
 * Real-time subscription to Firestore `trips` collection.
 * Ensures all connected devices (mobiles, PCs, Netlify) share the exact same live state.
 */
export function subscribeToTrips(
  onUpdate: (trips: Trip[]) => void,
  onError?: (error: Error) => void
) {
  let unsubscribe: (() => void) | null = null;
  updateSyncStatus('connecting', '클라우드 DB 동기화 연결 중...');

  // Immediately serve latest from IndexedDB / localStorage while connecting to Firestore
  getTripsFromIDB().then((idbTrips) => {
    const initial = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
    onUpdate(initial);
  }).catch((err) => {
    console.error('상세 에러 (getTripsFromIDB initial):', err);
  });

  try {
    const tripsRef = collection(db, TRIPS_COLLECTION);
    unsubscribe = onSnapshot(
      tripsRef,
      async (snapshot) => {
        updateSyncStatus('synced', '실시간 동기화됨');
        if (snapshot.empty) {
          // If Firestore is completely empty on first launch, seed once with default trips
          try {
            const idbTrips = await getTripsFromIDB();
            const initial = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
            onUpdate(initial);
            if (initial && initial.length > 0) {
              for (const trip of initial) {
                const clean = sanitizeForFirestore(await detachTripPhotos(trip));
                setDoc(doc(db, TRIPS_COLLECTION, clean.id), clean, { merge: true }).catch((err) => {
                  console.error('상세 에러 (seed initial trip):', err);
                });
              }
            }
          } catch (seedErr) {
            console.error('상세 에러 (seed default trips):', seedErr);
          }
        } else {
          const rawRemoteTrips: Trip[] = [];
          snapshot.forEach((docSnap) => {
            rawRemoteTrips.push(docSnap.data() as Trip);
          });

          let localTrips: Trip[] = [];
          try {
            const idbTrips = await getTripsFromIDB();
            localTrips = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
          } catch (idbErr) {
            console.error('상세 에러 (getTripsFromIDB in snapshot):', idbErr);
            localTrips = getStoredTrips();
          }

          const finalTrips: Trip[] = [];

          rawRemoteTrips.forEach((remote) => {
            const local = localTrips.find((t) => t.id === remote.id);
            if (local && pendingTripWrites.has(remote.id)) {
              finalTrips.push(reconcileSingleTrip(local, remote));
            } else {
              finalTrips.push(remote);
            }
          });

          // Only keep local trips that are currently pending a write to Firestore
          for (const local of localTrips) {
            if (pendingTripWrites.has(local.id) && !finalTrips.some((t) => t.id === local.id)) {
              finalTrips.push(local);
            }
          }

          // Save authoritative state to local storage & IndexedDB
          saveTripsToLocalStorage(finalTrips);
          saveTripsToIDB(finalTrips).catch((err) => {
            console.error('상세 에러 (saveTripsToIDB snapshot):', err);
          });

          // Immediately update state so all connected devices see the new schedule and souvenirs instantly
          onUpdate(finalTrips);

          // Resolve photos in the background and update state once photos are ready
          resolveTripPhotosList(finalTrips).then((resolved) => {
            saveTripsToIDB(resolved).catch((err) => {
              console.error('상세 에러 (saveTripsToIDB resolved photos):', err);
            });
            const hasChanges = JSON.stringify(resolved) !== JSON.stringify(finalTrips);
            if (hasChanges) {
              onUpdate(resolved);
            }
          }).catch((photoErr) => {
            console.error('상세 에러 (resolveTripPhotosList):', photoErr);
          });
        }
      },
      (err: any) => {
        console.error('상세 에러 (Firestore trips subscription onSnapshot error):', err);
        const errMsg = err?.code === 'permission-denied'
          ? 'Firebase Firestore 접근 권한이 거부되었습니다 (Permission Denied).'
          : '클라우드 실시간 동기화 오류가 발생했습니다.';
        notifyFirestoreError(errMsg, err);

        getTripsFromIDB().then((idbTrips) => {
          const fallback = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
          onUpdate(fallback);
        }).catch((fallbackErr) => {
          console.error('상세 에러 (getTripsFromIDB fallback on error):', fallbackErr);
        });

        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.error('상세 에러 (Firestore trips connection catch):', err);
    notifyFirestoreError('클라우드 DB 연결에 실패했습니다.', err);
    getTripsFromIDB().then((idbTrips) => {
      const fallback = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
      onUpdate(fallback);
    }).catch((fallbackErr) => {
      console.error('상세 에러 (getTripsFromIDB catch fallback):', fallbackErr);
    });
  }

  return () => {
    if (unsubscribe) {
      try {
        unsubscribe();
        unsubscribe = null;
      } catch (unsubErr) {
        console.error('상세 에러 (unsubscribe trips):', unsubErr);
      }
    }
  };
}

async function resolveTripPhotosList(tripsList: Trip[]): Promise<Trip[]> {
  try {
    return await Promise.all(
      tripsList.map(async (trip) => {
        try {
          return await resolveTripPhotos(trip);
        } catch (err) {
          console.error('상세 에러 (resolveTripPhotos item):', err);
          return trip;
        }
      })
    );
  } catch (err) {
    console.error('상세 에러 (resolveTripPhotosList Promise.all):', err);
    return tripsList;
  }
}

/**
 * Real-time subscription to Firestore `settings/brand` document.
 */
export function subscribeToBrandSettings(
  onUpdate: (settings: {
    title: string;
    subtitle: string;
    badge: string;
    tabOrder?: TabType[];
    adminPassword?: string;
    tripOrder?: string[];
  }) => void
) {
  // Immediately provide cached brand settings
  onUpdate(getStoredBrandSettings());

  let unsubscribe: (() => void) | null = null;
  try {
    unsubscribe = onSnapshot(
      doc(db, 'settings', 'brand'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const settings = {
            title: data.title || 'J플래너',
            subtitle: data.subtitle || '스마트 여행 일정 & 예약 보관함',
            badge: data.badge || 'MBTI J전용',
            tabOrder: data.tabOrder || ['itinerary', 'map', 'reservations', 'budget', 'checklist', 'souvenirs'],
            adminPassword: data.adminPassword || '1205',
            tripOrder: data.tripOrder || undefined
          };
          try {
            localStorage.setItem(STORAGE_BRAND_KEY, JSON.stringify(settings));
            if (settings.adminPassword) {
              localStorage.setItem('jplanner_site_password', settings.adminPassword);
            }
          } catch (storageErr) {
            console.error('상세 에러 (localStorage brand setItem):', storageErr);
          }
          onUpdate(settings);
        }
      },
      (err: any) => {
        console.error('상세 에러 (Brand settings subscription error):', err);
        const errMsg = err?.code === 'permission-denied'
          ? 'Firebase 브랜드 설정 권한이 거부되었습니다.'
          : '브랜드 설정 실시간 동기화 오류';
        notifyFirestoreError(errMsg, err);
        onUpdate(getStoredBrandSettings());
      }
    );
  } catch (err) {
    console.error('상세 에러 (Brand settings connection catch):', err);
    notifyFirestoreError('브랜드 설정 DB 연결 실패', err);
    onUpdate(getStoredBrandSettings());
  }

  return () => {
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch (unsubErr) {
        console.error('상세 에러 (unsubscribe brand):', unsubErr);
      }
    }
  };
}

/**
 * Persist Brand settings directly to Firestore `settings/brand`
 */
export async function saveBrandSettingsToFirestore(settings: {
  title: string;
  subtitle: string;
  badge: string;
  tabOrder?: TabType[];
  adminPassword?: string;
  tripOrder?: string[];
}) {
  updateSyncStatus('saving', '설정 저장 중...');
  try {
    localStorage.setItem(STORAGE_BRAND_KEY, JSON.stringify(settings));
    if (settings.adminPassword) {
      localStorage.setItem('jplanner_site_password', settings.adminPassword);
    }
  } catch (err) {
    console.error('상세 에러 (Brand local cache setItem):', err);
  }

  if (pendingBrandTimer) {
    clearTimeout(pendingBrandTimer);
  }

  pendingBrandTimer = setTimeout(async () => {
    pendingBrandTimer = null;
    try {
      const safeSettings = removeUndefinedDeep(settings);
      await setDoc(doc(db, 'settings', 'brand'), safeSettings, { merge: true });
      updateSyncStatus('synced', '실시간 동기화됨');
    } catch (err: any) {
      console.error('상세 에러 (saveBrandSettingsToFirestore setDoc):', err);
      const errMsg = err?.code === 'permission-denied'
        ? 'Firebase 브랜드 설정 저장 권한이 거부되었습니다.'
        : '브랜드 설정을 클라우드에 저장하지 못했습니다.';
      notifyFirestoreError(errMsg, err);
    }
  }, 300);
}
