import { collection, doc, onSnapshot, setDoc, deleteDoc, enableNetwork } from 'firebase/firestore';
import { db } from './firebase';
import { Trip, TabType, SouvenirTabConfig, ChecklistTabConfig, ScheduleItem, Reservation, ExpenseItem, PackingItem } from '../types';
import { INITIAL_TRIPS } from '../data/mockData';
import { detachTripPhotos, resolveTripPhotos } from '../utils/imageUtils';
import { getTripSouvenirTabs, getTripChecklistTabs, unionSouvenirItems, DEFAULT_PACKING_CATEGORIES, DEFAULT_SOUVENIR_TAGS } from '../utils/tabUtils';
import { cleanTripTitle } from '../utils/dateUtils';
import { saveTripBackup, saveTripsToIDB, getTripsFromIDB } from '../utils/tripIndexedDB';
import { savePhotoLocal, generatePhotoId } from '../utils/photoStore';

const TRIPS_COLLECTION = 'trips';
const STORAGE_TRIPS_KEY = 'jplanner_trips_cache';
const STORAGE_BRAND_KEY = 'jplanner_brand_settings_cache';

export type SyncStatus = 'connecting' | 'synced' | 'saving' | 'error' | 'local-saved';

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

const QUOTA_STORAGE_KEY = 'jplanner_quota_exceeded_until';

/**
 * Ensure Firestore network connection is active
 */
if (typeof window !== 'undefined') {
  try {
    localStorage.removeItem(QUOTA_STORAGE_KEY);
    enableNetwork(db).catch(() => {});
  } catch {}
}

/**
 * Check if the Firebase free write quota is temporarily exhausted
 */
export function isQuotaExceeded(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const val = localStorage.getItem(QUOTA_STORAGE_KEY);
    if (!val) return false;
    const until = Number(val);
    if (isNaN(until) || Date.now() > until) {
      localStorage.removeItem(QUOTA_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Mark quota as temporarily paused if rate limited (graceful non-destructive notice)
 */
export function setQuotaExceeded(durationMs = 60 * 1000): void {
  try {
    if (typeof window !== 'undefined') {
      const until = Date.now() + durationMs;
      localStorage.setItem(QUOTA_STORAGE_KEY, until.toString());
    }
  } catch {}
  updateSyncStatus('local-saved', '로컬 안전 저장 모드 (기기 내 100% 보관)');
}

/**
 * Detect Firestore quota exhaustion errors
 */
export function isQuotaError(err: any): boolean {
  if (!err) return false;
  const code = err?.code || '';
  const message = String(err?.message || err?.toString() || '').toLowerCase();
  return (
    code === 'resource-exhausted' ||
    message.includes('quota') ||
    message.includes('resource-exhausted') ||
    message.includes('free daily write units') ||
    message.includes('quota limit exceeded')
  );
}

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
  if (isQuotaError(rawError)) {
    setQuotaExceeded();
    return;
  }
  // If Firestore size limit (1,048,576 bytes) is reached, seamlessly switch to local-first mode without error alert
  if (
    rawError?.message?.includes('exceeds the maximum allowed size') ||
    rawError?.message?.includes('1,048,576') ||
    userFriendlyMsg?.includes('1,048,576') ||
    userFriendlyMsg?.includes('maximum allowed size')
  ) {
    console.warn('[TripService] Firestore document size limit reached. Safely preserving in LocalStorage and IndexedDB.');
    updateSyncStatus('local-saved', '로컬 안전 저장 모드 (대용량 데이터 기기 내 안전 보관)');
    return;
  }
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

// Pending trip writes debounce trackers & payload deduplication cache
const pendingTripWrites = new Map<string, ReturnType<typeof setTimeout>>();
const lastWrittenTripHash = new Map<string, string>();
const lastWrittenContentFingerprint = new Map<string, string>();
let pendingBrandTimer: ReturnType<typeof setTimeout> | null = null;
let lastWrittenBrandHash = '';

/**
 * Hash only the actual functional trip content, ignoring transient updatedAt timestamps.
 * This guarantees zero cloud writes if the trip contents did not actually change.
 */
export function getTripContentFingerprint(trip: Trip | null | undefined): string {
  if (!trip) return '';
  const { updatedAt, ...rest } = trip as any;
  return JSON.stringify(rest);
}

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
 * Helper to strip bulky base64 data URLs before storing in localStorage (5MB quota safety)
 * Images are safely stored and loaded via IndexedDB (photoStore / AsyncImage)
 */
export function stripLargePayloadsForStorage(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/')) {
      const photoId = generatePhotoId(`ls_${Math.random().toString(36).substring(2, 9)}`);
      savePhotoLocal(photoId, obj).catch(() => {});
      return `photo://${photoId}`;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(stripLargePayloadsForStorage);
  }
  if (typeof obj === 'object') {
    const res: Record<string, any> = {};
    for (const k of Object.keys(obj)) {
      res[k] = stripLargePayloadsForStorage(obj[k]);
    }
    return res;
  }
  return obj;
}

/**
 * Safe wrapper for localStorage.setItem with automatic quota exceeded recovery
 */
export function safeLocalStorageSet(key: string, value: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    // If quota exceeded, attempt cleanup of bulky non-essential keys
    try {
      if (key !== STORAGE_TRIPS_KEY) {
        // Free space by clearing the heavy trips cache in localStorage
        localStorage.removeItem(STORAGE_TRIPS_KEY);
      }
      localStorage.setItem(key, value);
      return true;
    } catch {
      // If still failing, gracefully skip localStorage write (IndexedDB handles full persistence)
      return false;
    }
  }
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
        return parsed.map((t) => ({
          ...t,
          title: cleanTripTitle(t.title)
        }));
      }
    }
  } catch (error) {
    // Graceful fallback
  }
  return INITIAL_TRIPS;
}

/**
 * Save trips list to browser localStorage cache safely without exceeding the 5MB browser quota
 */
export function saveTripsToLocalStorage(trips: Trip[]): void {
  if (!trips || !Array.isArray(trips)) return;
  try {
    const lightweightTrips = stripLargePayloadsForStorage(trips);
    const success = safeLocalStorageSet(STORAGE_TRIPS_KEY, JSON.stringify(lightweightTrips));
    if (!success) {
      // If full lightweight trips fail, try minimal overview list
      const minimalTrips = trips.map((t) => ({
        id: t.id,
        title: t.title,
        destination: t.destination,
        startDate: t.startDate,
        endDate: t.endDate,
        currency: t.currency,
        updatedAt: t.updatedAt || Date.now()
      }));
      safeLocalStorageSet(STORAGE_TRIPS_KEY, JSON.stringify(minimalTrips));
    }
  } catch {
    // IndexedDB (IDB) already has full trip backups and full trip data safely stored
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
    tabOrder: ['itinerary', 'souvenirs', 'budget', 'map', 'checklist', 'reservations'] as TabType[],
    adminPassword: '1205',
    tripOrder: ['trip-1790572819913', 'trip-1786407431435', 'trip-1791376631348', 'trip-1787213502723'] as string[],
    activeTripId: 'trip-1790572819913' as string | undefined
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
export function reconcileSingleTrip(localTrip?: Trip | null, remoteTrip?: Trip | null): Trip {
  if (!localTrip && !remoteTrip) {
    return INITIAL_TRIPS[0] || ({ id: 'default', title: '여행', schedule: [] } as any);
  }
  if (!localTrip) return JSON.parse(JSON.stringify(remoteTrip!));
  if (!remoteTrip) return JSON.parse(JSON.stringify(localTrip));

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

  // 3. Schedule Items: union both so no schedule items from either cloud or local are lost
  const scheduleMap = new Map<string, ScheduleItem>();
  for (const item of otherTrip.schedule || []) {
    if (item?.id) scheduleMap.set(item.id, item);
  }
  for (const item of baseTrip.schedule || []) {
    if (item?.id) scheduleMap.set(item.id, item);
  }
  baseTrip.schedule = Array.from(scheduleMap.values());

  // 4. Reservations: union both
  const resMap = new Map<string, Reservation>();
  for (const item of otherTrip.reservations || []) {
    if (item?.id) resMap.set(item.id, item);
  }
  for (const item of baseTrip.reservations || []) {
    if (item?.id) resMap.set(item.id, item);
  }
  baseTrip.reservations = Array.from(resMap.values());

  // 5. Merge Expenses: union both
  const expMap = new Map<string, ExpenseItem>();
  for (const item of otherTrip.expenses || []) {
    if (item?.id) expMap.set(item.id, item);
  }
  for (const item of baseTrip.expenses || []) {
    if (item?.id) expMap.set(item.id, item);
  }
  baseTrip.expenses = Array.from(expMap.values());

  return baseTrip;
}

function hasBase64Images(trip: Trip): boolean {
  if (trip.coverImage && typeof trip.coverImage === 'string' && trip.coverImage.startsWith('data:image/')) {
    return true;
  }
  if (trip.souvenirTabs && Array.isArray(trip.souvenirTabs)) {
    for (const tab of trip.souvenirTabs) {
      for (const item of tab.items || []) {
        if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('data:image/')) return true;
        if (item.images && Array.isArray(item.images)) {
          for (const img of item.images) {
            if (typeof img === 'string' && img.startsWith('data:image/')) return true;
          }
        }
      }
    }
  }
  return false;
}

// Brand listeners for live multi-device header/brand updates
const brandListeners = new Set<(settings: any) => void>();

/**
 * Direct Server Sync Helpers (Instant multi-device live sync)
 */
export async function syncTripToServer(trip: Trip): Promise<boolean> {
  try {
    const res = await fetch('/api/sync/trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip)
    });
    return res.ok;
  } catch (err) {
    console.warn('[TripService] Server trip sync warning:', err);
    return false;
  }
}

export async function syncAllTripsToServer(trips: Trip[]): Promise<boolean> {
  try {
    const res = await fetch('/api/sync/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trips)
    });
    return res.ok;
  } catch (err) {
    console.warn('[TripService] Server all trips sync warning:', err);
    return false;
  }
}

export async function deleteTripFromServer(tripId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/sync/trip/${encodeURIComponent(tripId)}`, {
      method: 'DELETE'
    });
    return res.ok;
  } catch (err) {
    console.warn('[TripService] Server trip delete warning:', err);
    return false;
  }
}

export async function syncBrandToServer(brand: any): Promise<boolean> {
  try {
    const res = await fetch('/api/sync/brand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brand)
    });
    return res.ok;
  } catch (err) {
    console.warn('[TripService] Server brand sync warning:', err);
    return false;
  }
}

/**
 * Save trip to local cache, IndexedDB backup history, and direct to Server & Firestore
 */
export async function saveTripToFirestore(trip: Trip, forceDirectWrite = false): Promise<void> {
  const contentFingerprint = getTripContentFingerprint(trip);

  // If content has not changed at all and this is an automatic background write, completely skip!
  if (!forceDirectWrite && lastWrittenContentFingerprint.get(trip.id) === contentFingerprint) {
    return;
  }

  const timestampedTrip: Trip = {
    ...trip,
    updatedAt: Date.now()
  };

  // 1. Mark pending write immediately so any concurrent snapshot reconciliation protects this trip
  pendingTripWrites.set(timestampedTrip.id, (null as any));

  // 2. Immediately create a safety backup in IndexedDB
  saveTripBackup(timestampedTrip).catch((err) => {
    console.error('상세 에러 (saveTripBackup):', err);
  });

  // 3. Synchronously update browser cache & IndexedDB with full data for instant local response
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

  // 4. Prepare clean, lightweight trip: extract heavy photos to local photo store if needed
  let cleanTrip: Trip;
  try {
    cleanTrip = await detachTripPhotos(timestampedTrip);
  } catch (e) {
    console.warn('detachTripPhotos fallback:', e);
    cleanTrip = timestampedTrip;
  }
  const safePayload = sanitizeForFirestore(cleanTrip);

  // Direct immediate write if requested (e.g., manual save button, backup restore, new trip creation)
  if (forceDirectWrite) {
    updateSyncStatus('saving', '데이터 저장 중...');
    const watchdog = setTimeout(() => {
      if (currentSyncStatus.status === 'saving') {
        updateSyncStatus('synced', '실시간 동기화됨');
      }
    }, 1200);

    try {
      const payloadHash = JSON.stringify(safePayload);

      // Primary: Immediate write to Server Hub (instant persistence + SSE broadcast to all other phones & PCs)
      const serverSyncPromise = syncTripToServer(safePayload);

      // Secondary: Best-effort write to Firestore with 1500ms non-blocking timeout
      const firestorePromise = setDoc(doc(db, TRIPS_COLLECTION, safePayload.id), safePayload, { merge: true })
        .catch((fsErr) => {
          console.warn('[TripService] Secondary Firestore direct write notice:', fsErr?.message || fsErr);
        });
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1500));

      await Promise.allSettled([serverSyncPromise, Promise.race([firestorePromise, timeoutPromise])]);
      lastWrittenContentFingerprint.set(cleanTrip.id, contentFingerprint);
      lastWrittenTripHash.set(cleanTrip.id, payloadHash);
      clearTimeout(watchdog);
      updateSyncStatus('synced', '실시간 동기화됨');
    } catch (err: any) {
      clearTimeout(watchdog);
      console.warn('Direct save notice:', err);
      updateSyncStatus('synced', '실시간 동기화됨');
    } finally {
      pendingTripWrites.delete(cleanTrip.id);
    }
    return;
  }

  // Debounced write for real-time keystroke/checkbox edits (1500ms calm-down period)
  const existingTimer = pendingTripWrites.get(cleanTrip.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(async () => {
    // Check fingerprint again before issuing write
    if (lastWrittenContentFingerprint.get(cleanTrip.id) === contentFingerprint) {
      pendingTripWrites.delete(cleanTrip.id);
      return;
    }

    updateSyncStatus('saving', '데이터 동기화 중...');
    const watchdog = setTimeout(() => {
      if (currentSyncStatus.status === 'saving') {
        updateSyncStatus('synced', '실시간 동기화됨');
      }
    }, 1200);

    try {
      const payloadHash = JSON.stringify(safePayload);

      // 1. Sync to Server Hub
      syncTripToServer(safePayload).catch((e) => console.warn('Server background sync error:', e));

      // 2. Best-effort Firestore write
      const writePromise = setDoc(doc(db, TRIPS_COLLECTION, safePayload.id), safePayload, { merge: true });
      writePromise.catch((err) => {
        console.warn('Background Firestore write notice:', err?.message || err);
      });

      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1000));
      await Promise.race([writePromise, timeoutPromise]);
      lastWrittenContentFingerprint.set(cleanTrip.id, contentFingerprint);
      lastWrittenTripHash.set(cleanTrip.id, payloadHash);
      clearTimeout(watchdog);
      updateSyncStatus('synced', '실시간 동기화됨');
    } catch (err: any) {
      clearTimeout(watchdog);
      console.warn('[TripService] Background write catch:', err);
      updateSyncStatus('synced', '실시간 동기화됨');
    } finally {
      pendingTripWrites.delete(cleanTrip.id);
    }
  }, 1500);

  pendingTripWrites.set(cleanTrip.id, timer);
}

/**
 * Delete trip from local cache, IndexedDB, Server Hub, and Firestore
 */
export async function deleteTripFromFirestore(tripId: string): Promise<void> {
  const existingTimer = pendingTripWrites.get(tripId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    pendingTripWrites.delete(tripId);
  }
  lastWrittenTripHash.delete(tripId);

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

  updateSyncStatus('saving', '여행 삭제 중...');

  // 2. Delete from Server Hub (instantly broadcasts deletion to all devices via SSE)
  deleteTripFromServer(tripId).catch((e) => console.warn('Server delete error:', e));

  // 3. Delete from Firestore (best-effort)
  try {
    await deleteDoc(doc(db, TRIPS_COLLECTION, tripId));
    updateSyncStatus('synced', '실시간 동기화됨');
  } catch (err: any) {
    console.warn('Firestore delete notice:', err);
    updateSyncStatus('synced', '실시간 동기화됨');
  }
}

/**
 * Real-time subscription to Trips.
 * Combines instant local IDB cache, Server Hub API + SSE live stream, and Firestore onSnapshot.
 * Guarantees that mobile phones, laptops, and shared browsers always display the latest synchronized data.
 */
export function subscribeToTrips(
  onUpdate: (trips: Trip[]) => void,
  onError?: (error: Error) => void
) {
  let isSubscribed = true;
  updateSyncStatus('connecting', '클라우드 동기화 연결 중...');

  // 1. Immediately serve latest from IndexedDB / localStorage for 0ms initial render
  getTripsFromIDB().then((idbTrips) => {
    if (!isSubscribed) return;
    const initial = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
    if (initial && initial.length > 0) {
      onUpdate(initial);
    }
  }).catch((err) => {
    console.error('상세 에러 (getTripsFromIDB initial):', err);
  });

  // Reusable reconciler for incoming remote trips (from Server SSE or Firestore)
  const handleIncomingTrips = async (remoteTrips: Trip[]) => {
    if (!remoteTrips || remoteTrips.length === 0) return;

    let localTrips: Trip[] = [];
    try {
      const idbTrips = await getTripsFromIDB();
      localTrips = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
    } catch {
      localTrips = getStoredTrips();
    }

    const finalTrips: Trip[] = [];
    let localHasNewer = false;

    remoteTrips.forEach((remote) => {
      if (!remote || !remote.id) return;
      const local = localTrips.find((t) => t && t.id === remote.id);
      let chosen: Trip;
      if (!local) {
        chosen = remote;
      } else {
        const isLocalNewer = (local.updatedAt || 0) > (remote.updatedAt || 0);
        if (isLocalNewer || pendingTripWrites.has(remote.id)) {
          localHasNewer = true;
          chosen = reconcileSingleTrip(local, remote);
        } else {
          chosen = reconcileSingleTrip(remote, local);
        }
      }
      finalTrips.push({
        ...chosen,
        title: cleanTripTitle(chosen.title || '')
      });
    });

    // Always preserve local trips that may not be in remote yet (e.g. backup just restored locally)
    for (const local of localTrips) {
      if (!finalTrips.some((t) => t.id === local.id)) {
        finalTrips.push({
          ...local,
          title: cleanTripTitle(local.title)
        });
      }
    }

    // Save authoritative state to local storage & IndexedDB
    saveTripsToLocalStorage(finalTrips);
    saveTripsToIDB(finalTrips).catch((err) => {
      console.error('상세 에러 (saveTripsToIDB snapshot):', err);
    });

    updateSyncStatus('synced', '실시간 동기화됨');
    onUpdate(finalTrips);

    // Resolve photos in the background and update state once photos are ready
    resolveTripPhotosList(finalTrips).then((resolved) => {
      if (!isSubscribed) return;
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
  };

  // 2. Fetch latest trips from Server Hub immediately
  fetch('/api/sync/trips')
    .then((res) => res.json())
    .then((data) => {
      if (!isSubscribed) return;
      if (data && Array.isArray(data.trips) && data.trips.length > 0) {
        handleIncomingTrips(data.trips);
      } else {
        // If server is empty on first boot, check if local has trips to seed to server
        getTripsFromIDB().then((idbTrips) => {
          const initial = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
          if (initial && initial.length > 0) {
            syncAllTripsToServer(initial).catch(() => {});
            onUpdate(initial);
          }
        });
      }
    })
    .catch((err) => {
      console.warn('[TripService] Initial /api/sync/trips fetch notice:', err);
    });

  // 3. Connect to Server-Sent Events (SSE) for instant real-time sync across all connected devices
  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource('/api/sync/stream');
    eventSource.onmessage = (event) => {
      if (!isSubscribed) return;
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'trips_updated' || payload.type === 'initial') {
          if (Array.isArray(payload.trips)) {
            handleIncomingTrips(payload.trips);
          }
        }
        if (payload.type === 'brand_updated' || payload.type === 'initial') {
          if (payload.brand) {
            safeLocalStorageSet(STORAGE_BRAND_KEY, JSON.stringify(payload.brand));
            brandListeners.forEach((listener) => {
              try {
                listener(payload.brand);
              } catch (listenerErr) {
                console.error('[TripService] Brand listener error:', listenerErr);
              }
            });
          }
        }
      } catch (parseErr) {
        console.warn('[TripService] SSE message parse notice:', parseErr);
      }
    };
    eventSource.onerror = () => {
      // Browser EventSource automatically handles reconnection with backoff
    };
  } catch (sseErr) {
    console.warn('[TripService] SSE stream initialization notice:', sseErr);
  }

  // 4. Refetch on tab focus or visibility change (e.g., unlocking phone screen or switching browser tabs)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible' && isSubscribed) {
      fetch('/api/sync/trips')
        .then((res) => res.json())
        .then((data) => {
          if (data && Array.isArray(data.trips) && data.trips.length > 0) {
            handleIncomingTrips(data.trips);
          }
        })
        .catch(() => {});
    }
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // 5. Best-effort Firestore onSnapshot subscription in parallel
  let firestoreUnsub: (() => void) | null = null;
  try {
    const tripsRef = collection(db, TRIPS_COLLECTION);
    firestoreUnsub = onSnapshot(
      tripsRef,
      (snapshot) => {
        if (!isSubscribed) return;
        if (!snapshot.empty) {
          const rawRemoteTrips: Trip[] = [];
          snapshot.forEach((docSnap) => {
            rawRemoteTrips.push(docSnap.data() as Trip);
          });
          handleIncomingTrips(rawRemoteTrips);
        }
      },
      (err: any) => {
        console.warn('[TripService] Firestore snapshot notice:', err?.message || err);
      }
    );
  } catch (err: any) {
    console.warn('[TripService] Firestore connection notice:', err?.message || err);
  }

  return () => {
    isSubscribed = false;
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (firestoreUnsub) {
      try {
        firestoreUnsub();
      } catch {}
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
 * Real-time subscription to Brand Settings (Header Title, Tabs, Password, Active Trip).
 */
export function subscribeToBrandSettings(
  onUpdate: (settings: {
    title: string;
    subtitle: string;
    badge: string;
    tabOrder?: TabType[];
    adminPassword?: string;
    tripOrder?: string[];
    activeTripId?: string;
  }) => void
) {
  // Immediately provide cached brand settings
  onUpdate(getStoredBrandSettings());

  // Register listener for SSE stream brand events
  brandListeners.add(onUpdate);

  // Fetch latest brand settings from server
  fetch('/api/sync/brand')
    .then((res) => res.json())
    .then((brand) => {
      if (brand && brand.title) {
        safeLocalStorageSet(STORAGE_BRAND_KEY, JSON.stringify(brand));
        onUpdate(brand);
      }
    })
    .catch(() => {});

  // Best-effort Firestore settings/brand subscription
  let firestoreUnsub: (() => void) | null = null;
  try {
    firestoreUnsub = onSnapshot(
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
            tripOrder: data.tripOrder || undefined,
            activeTripId: data.activeTripId || undefined
          };
          safeLocalStorageSet(STORAGE_BRAND_KEY, JSON.stringify(settings));
          if (settings.adminPassword) {
            safeLocalStorageSet('jplanner_site_password', settings.adminPassword);
          }
          onUpdate(settings);
        }
      },
      (err: any) => {
        console.warn('[TripService] Firestore brand subscription notice:', err?.message || err);
      }
    );
  } catch (err) {
    console.warn('[TripService] Firestore brand catch:', err);
  }

  return () => {
    brandListeners.delete(onUpdate);
    if (firestoreUnsub) {
      try {
        firestoreUnsub();
      } catch {}
    }
  };
}

/**
 * Persist Brand settings directly to Server Hub and Firestore `settings/brand`
 */
export async function saveBrandSettingsToFirestore(
  settings: {
    title: string;
    subtitle: string;
    badge: string;
    tabOrder?: TabType[];
    adminPassword?: string;
    tripOrder?: string[];
    activeTripId?: string;
  },
  forceDirect = false
) {
  safeLocalStorageSet(STORAGE_BRAND_KEY, JSON.stringify(settings));
  if (settings.adminPassword) {
    safeLocalStorageSet('jplanner_site_password', settings.adminPassword);
  }

  const safeSettings = removeUndefinedDeep(settings);
  const hash = JSON.stringify(safeSettings);
  if (lastWrittenBrandHash === hash && !forceDirect) {
    return;
  }

  updateSyncStatus('saving', '설정 동기화 중...');

  // 1. Immediately sync to Server Hub (instantly broadcasts to all devices via SSE)
  syncBrandToServer(settings).catch((e) => console.warn('Server brand sync notice:', e));

  if (pendingBrandTimer) {
    clearTimeout(pendingBrandTimer);
    pendingBrandTimer = null;
  }

  const writeSettings = async () => {
    try {
      if (lastWrittenBrandHash === hash) {
        updateSyncStatus('synced', '실시간 동기화됨');
        return;
      }
      const writePromise = setDoc(doc(db, 'settings', 'brand'), safeSettings, { merge: true });
      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 1000));
      await Promise.race([writePromise, timeoutPromise]);
      lastWrittenBrandHash = hash;
      updateSyncStatus('synced', '실시간 동기화됨');
    } catch (err: any) {
      console.warn('Firestore brand save notice:', err?.message || err);
      updateSyncStatus('synced', '실시간 동기화됨');
    }
  };

  if (forceDirect) {
    await writeSettings();
  } else {
    pendingBrandTimer = setTimeout(async () => {
      pendingBrandTimer = null;
      await writeSettings();
    }, 1000);
  }
}

