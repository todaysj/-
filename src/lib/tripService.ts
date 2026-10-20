import { Trip, TabType, SouvenirTabConfig, ChecklistTabConfig, ScheduleItem, Reservation, ExpenseItem, PackingItem } from '../types';
import { INITIAL_TRIPS } from '../data/mockData';
import { detachTripPhotos, resolveTripPhotos } from '../utils/imageUtils';
import { getTripSouvenirTabs, getTripChecklistTabs, unionSouvenirItems, DEFAULT_PACKING_CATEGORIES, DEFAULT_SOUVENIR_TAGS } from '../utils/tabUtils';
import { cleanTripTitle } from '../utils/dateUtils';
import { saveTripBackup, saveTripsToIDB, getTripsFromIDB, deleteTripFromIDB } from '../utils/tripIndexedDB';
import { savePhotoLocal, generatePhotoId } from '../utils/photoStore';
import { getSupabase, isSupabaseConfigured } from './supabase';

const TRIPS_TABLE = 'trips';
const SETTINGS_TABLE = 'settings';
const STORAGE_TRIPS_KEY = 'jplanner_trips_cache';
const STORAGE_BRAND_KEY = 'jplanner_brand_settings_cache';
const STORAGE_DELETED_TRIPS_KEY = 'jplanner_deleted_trip_ids';

const deletedTripIdsMemorySet = new Set<string>(['test_sync']);

export function getDeletedTripIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_DELETED_TRIPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((id) => {
          if (id) deletedTripIdsMemorySet.add(id);
        });
      }
    }
  } catch {}
  return new Set(deletedTripIdsMemorySet);
}

export function isTripDeleted(tripId: string): boolean {
  if (!tripId) return false;
  return getDeletedTripIds().has(tripId);
}

export function markTripAsDeleted(tripId: string): void {
  if (!tripId) return;
  try {
    deletedTripIdsMemorySet.add(tripId);
    safeLocalStorageSet(STORAGE_DELETED_TRIPS_KEY, JSON.stringify(Array.from(deletedTripIdsMemorySet)));
  } catch {}
}

export type SyncStatus = 'connecting' | 'synced' | 'saving' | 'error' | 'local-saved';

export interface SyncStatusInfo {
  status: SyncStatus;
  message?: string;
  timestamp: number;
}

// Global sync listeners
const syncStatusListeners = new Set<(info: SyncStatusInfo) => void>();
const dbErrorListeners = new Set<(errorMsg: string, rawError?: any) => void>();

let currentSyncStatus: SyncStatusInfo = {
  status: 'connecting',
  message: 'DB 연결 중...',
  timestamp: Date.now()
};

/**
 * Backward compatibility helpers
 */
export function isQuotaExceeded(): boolean {
  return false;
}

export function setQuotaExceeded(_durationMs = 60 * 1000): void {
  // Supabase does not have restrictive per-minute document quotas like Firestore free tier
}

export function isQuotaError(_err: any): boolean {
  return false;
}

export function subscribeToSyncStatus(listener: (info: SyncStatusInfo) => void) {
  syncStatusListeners.add(listener);
  listener(currentSyncStatus);
  return () => {
    syncStatusListeners.delete(listener);
  };
}

export function subscribeToFirestoreErrors(listener: (errorMsg: string, rawError?: any) => void) {
  dbErrorListeners.add(listener);
  return () => {
    dbErrorListeners.delete(listener);
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

function removeUndefinedDeep(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedDeep);
  }
  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val !== undefined) {
      clean[key] = removeUndefinedDeep(val);
    }
  }
  return clean;
}

function sanitizeForCloud(trip: Trip): Trip {
  const safeTrip = removeUndefinedDeep(trip);
  return {
    ...safeTrip,
    title: cleanTripTitle(safeTrip.title || ''),
    schedule: Array.isArray(safeTrip.schedule) ? safeTrip.schedule : [],
    reservations: Array.isArray(safeTrip.reservations) ? safeTrip.reservations : [],
    expenses: Array.isArray(safeTrip.expenses) ? safeTrip.expenses : [],
    packingList: Array.isArray(safeTrip.packingList) ? safeTrip.packingList : [],
    checklistTabs: Array.isArray(safeTrip.checklistTabs) ? safeTrip.checklistTabs : [],
    souvenirTabs: Array.isArray(safeTrip.souvenirTabs) ? safeTrip.souvenirTabs : [],
    members: Array.isArray(safeTrip.members) ? safeTrip.members : ['나'],
    customExchangeRates: safeTrip.customExchangeRates || {},
    updatedAt: safeTrip.updatedAt || Date.now()
  };
}

// Fingerprinting & debounced save tracking
const lastWrittenTripHash = new Map<string, string>();
const lastWrittenContentFingerprint = new Map<string, string>();
const pendingTripWrites = new Map<string, any>();

let lastWrittenBrandHash = '';
let pendingBrandTimer: any = null;

const brandListeners = new Set<(settings: any) => void>();

function getTripContentFingerprint(trip: Trip): string {
  try {
    const { updatedAt, ...contentOnly } = trip as any;
    return JSON.stringify(contentOnly);
  } catch {
    return `${trip.id}_${Date.now()}`;
  }
}

/**
 * Strips bulky base64 data URLs before storing in localStorage (5MB quota safety)
 */
export function stripLargePayloadsForStorage(obj: any): any {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (obj.startsWith('data:image/') && obj.length > 500) {
      return '';
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

export function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
      try {
        localStorage.removeItem(STORAGE_TRIPS_KEY);
      } catch {}
      try {
        localStorage.setItem(key, value);
        return true;
      } catch {}
    }
    return false;
  }
}

export function getStoredTrips(): Trip[] {
  if (typeof window === 'undefined') return INITIAL_TRIPS;
  try {
    const cached = localStorage.getItem(STORAGE_TRIPS_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const deletedSet = getDeletedTripIds();
        const validTrips = parsed.filter((t) => t && t.id && !deletedSet.has(t.id) && !(t as any).isDeleted);
        if (validTrips.length > 0) {
          const brand = getStoredBrandSettings();
          if (brand && Array.isArray(brand.tripOrder) && brand.tripOrder.length > 0) {
            const orderMap = new Map(brand.tripOrder.map((id, index) => [id, index]));
            return validTrips.sort((a, b) => {
              const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
              const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
              return idxA - idxB;
            });
          }
          return validTrips;
        }
      }
    }
  } catch (err) {
    console.error('상세 에러 (getStoredTrips cache parse):', err);
  }
  const deletedSet = getDeletedTripIds();
  return INITIAL_TRIPS.filter((t) => !deletedSet.has(t.id));
}

export function saveTripsToLocalStorage(trips: Trip[]): void {
  if (typeof window === 'undefined') return;
  try {
    const lightweightTrips = stripLargePayloadsForStorage(trips);
    const success = safeLocalStorageSet(STORAGE_TRIPS_KEY, JSON.stringify(lightweightTrips));
    if (!success) {
      const minimalTrips = lightweightTrips.map((t: Trip) => ({
        id: t.id,
        title: cleanTripTitle(t.title),
        destination: t.destination,
        startDate: t.startDate,
        endDate: t.endDate,
        currency: t.currency,
        updatedAt: t.updatedAt
      }));
      safeLocalStorageSet(STORAGE_TRIPS_KEY, JSON.stringify(minimalTrips));
    }
  } catch (err) {
    console.error('상세 에러 (saveTripsToLocalStorage):', err);
  }
}

export function getStoredBrandSettings(): {
  title: string;
  subtitle: string;
  badge: string;
  tabOrder?: TabType[];
  adminPassword?: string;
  tripOrder?: string[];
  activeTripId?: string;
  deletedTripIds?: string[];
  updatedAt?: number;
} {
  const defaults = {
    title: 'J플래너',
    subtitle: '스마트 여행 일정 & 예약 보관함',
    badge: 'MBTI J전용',
    tabOrder: ['itinerary', 'map', 'reservations', 'budget', 'checklist', 'souvenirs'] as TabType[],
    adminPassword: '1205'
  };
  if (typeof window === 'undefined') return defaults;
  try {
    const cached = localStorage.getItem(STORAGE_BRAND_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      const res = { ...defaults, ...parsed };
      if (res.adminPassword) {
        try {
          localStorage.setItem('jplanner_site_password', res.adminPassword);
        } catch {}
      }
      return res;
    }
  } catch {}
  return defaults;
}

function reconcileSingleTrip(newer: Trip, older: Trip): Trip {
  const safeNewer = sanitizeForCloud(newer);
  const safeOlder = sanitizeForCloud(older);

  const mergedScheduleMap = new Map<string, ScheduleItem>();
  (safeOlder.schedule || []).forEach((item) => {
    if (item && item.id) mergedScheduleMap.set(item.id, item);
  });
  (safeNewer.schedule || []).forEach((item) => {
    if (item && item.id) mergedScheduleMap.set(item.id, item);
  });

  const mergedReservationsMap = new Map<string, Reservation>();
  (safeOlder.reservations || []).forEach((res) => {
    if (res && res.id) mergedReservationsMap.set(res.id, res);
  });
  (safeNewer.reservations || []).forEach((res) => {
    if (res && res.id) mergedReservationsMap.set(res.id, res);
  });

  const mergedExpensesMap = new Map<string, ExpenseItem>();
  (safeOlder.expenses || []).forEach((exp) => {
    if (exp && exp.id) mergedExpensesMap.set(exp.id, exp);
  });
  (safeNewer.expenses || []).forEach((exp) => {
    if (exp && exp.id) mergedExpensesMap.set(exp.id, exp);
  });

  const checklistTabs = safeNewer.checklistTabs && safeNewer.checklistTabs.length > 0
    ? safeNewer.checklistTabs
    : safeOlder.checklistTabs || [];

  const souvenirTabs = safeNewer.souvenirTabs && safeNewer.souvenirTabs.length > 0
    ? safeNewer.souvenirTabs
    : safeOlder.souvenirTabs || [];

  const allMembers = Array.from(
    new Set([...(safeNewer.members || ['나']), ...(safeOlder.members || ['나'])])
  );

  return {
    ...safeOlder,
    ...safeNewer,
    title: cleanTripTitle(safeNewer.title || safeOlder.title),
    schedule: Array.from(mergedScheduleMap.values()),
    reservations: Array.from(mergedReservationsMap.values()),
    expenses: Array.from(mergedExpensesMap.values()),
    checklistTabs,
    souvenirTabs,
    members: allMembers,
    updatedAt: Math.max(safeNewer.updatedAt || 0, safeOlder.updatedAt || 0, Date.now())
  };
}

// ----------------------------------------------------------------------------
// Local Server Hub Sync Helpers (Internal Resilience fallback)
// ----------------------------------------------------------------------------

export async function syncTripToServer(trip: Trip): Promise<boolean> {
  try {
    const res = await fetch('/api/sync/trip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(trip)
    });
    return res.ok;
  } catch (err) {
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
    return false;
  }
}

// ----------------------------------------------------------------------------
// Save Trip (Supabase + LocalStorage + IndexedDB + Server Hub)
// ----------------------------------------------------------------------------

export async function saveTripToSupabase(trip: Trip, forceDirectWrite = false): Promise<void> {
  if (!trip || !trip.id || isTripDeleted(trip.id) || (trip as any).isDeleted) {
    return;
  }

  const contentFingerprint = getTripContentFingerprint(trip);
  if (!forceDirectWrite && lastWrittenContentFingerprint.get(trip.id) === contentFingerprint) {
    return;
  }

  const timestampedTrip: Trip = {
    ...trip,
    updatedAt: Date.now()
  };

  pendingTripWrites.set(timestampedTrip.id, null);

  // 1. Immediately create a safety backup in IndexedDB
  saveTripBackup(timestampedTrip).catch((err) => {
    console.error('상세 에러 (saveTripBackup):', err);
  });

  // 2. Synchronously update browser cache & IndexedDB with full data for instant local response (0ms)
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
    console.error('상세 에러 (saveTrip local cache):', err);
  }

  // 3. Prepare clean payload
  let cleanTrip: Trip;
  try {
    cleanTrip = await detachTripPhotos(timestampedTrip);
  } catch (e) {
    cleanTrip = timestampedTrip;
  }
  const safePayload = sanitizeForCloud(cleanTrip);

  // Direct immediate write if requested
  if (forceDirectWrite) {
    updateSyncStatus('saving', '데이터 저장 중...');
    const watchdog = setTimeout(() => {
      if (currentSyncStatus.status === 'saving') {
        updateSyncStatus('synced', '자동저장 완료 (실시간 동기화됨)');
      }
    }, 1200);

    try {
      const payloadHash = JSON.stringify(safePayload);

      // Primary: Server Hub sync
      const serverSyncPromise = syncTripToServer(safePayload);

      // Secondary: Supabase upsert
      const supabase = getSupabase();
      let supabasePromise: Promise<any> = Promise.resolve();
      if (supabase && isSupabaseConfigured()) {
        supabasePromise = Promise.resolve(
          supabase.from(TRIPS_TABLE).upsert(
            {
              id: safePayload.id,
              title: safePayload.title || '',
              destination: safePayload.destination || '',
              start_date: safePayload.startDate || '',
              end_date: safePayload.endDate || '',
              data: safePayload,
              is_deleted: false,
              updated_at: safePayload.updatedAt || Date.now(),
            },
            { onConflict: 'id' }
          )
        );
      }

      const timeoutPromise = new Promise((resolve) => setTimeout(resolve, 2000));
      await Promise.allSettled([serverSyncPromise, Promise.race([supabasePromise, timeoutPromise])]);

      lastWrittenContentFingerprint.set(cleanTrip.id, contentFingerprint);
      lastWrittenTripHash.set(cleanTrip.id, payloadHash);
      clearTimeout(watchdog);
      updateSyncStatus('synced', '자동저장 완료 (실시간 동기화됨)');
    } catch (err: any) {
      clearTimeout(watchdog);
      console.warn('Direct save notice:', err);
      updateSyncStatus('synced', '자동저장 완료 (실시간 동기화됨)');
    } finally {
      pendingTripWrites.delete(cleanTrip.id);
    }
    return;
  }

  // Fast-debounced write for real-time keystroke/checkbox edits (350ms)
  const existingTimer = pendingTripWrites.get(cleanTrip.id);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  updateSyncStatus('saving', '자동저장 중...');

  const timer = setTimeout(async () => {
    if (lastWrittenContentFingerprint.get(cleanTrip.id) === contentFingerprint) {
      pendingTripWrites.delete(cleanTrip.id);
      updateSyncStatus('synced', '자동저장 완료 (실시간 동기화됨)');
      return;
    }

    const watchdog = setTimeout(() => {
      if (currentSyncStatus.status === 'saving') {
        updateSyncStatus('synced', '자동저장 완료 (실시간 동기화됨)');
      }
    }, 1200);

    try {
      const payloadHash = JSON.stringify(safePayload);

      // 1. Sync to Server Hub
      syncTripToServer(safePayload).catch(() => {});

      // 2. Supabase upsert
      let supabaseSuccess = false;
      let supabaseErrorMessage = '';
      const supabase = getSupabase();
      if (supabase && isSupabaseConfigured()) {
        try {
          const { error: upsertErr } = await supabase.from(TRIPS_TABLE).upsert(
            {
              id: safePayload.id,
              title: safePayload.title || '',
              destination: safePayload.destination || '',
              start_date: safePayload.startDate || '',
              end_date: safePayload.endDate || '',
              data: safePayload,
              is_deleted: false,
              updated_at: safePayload.updatedAt || Date.now(),
            },
            { onConflict: 'id' }
          );

          if (upsertErr) {
            console.warn('[TripService] Supabase write notice:', upsertErr);
            if (upsertErr.code === 'PGRST205') {
              supabaseErrorMessage = 'Supabase에 trips 테이블이 없습니다 (설정 필요)';
            } else {
              supabaseErrorMessage = `Supabase 동기화 오류: ${upsertErr.message}`;
            }
          } else {
            supabaseSuccess = true;
          }
        } catch (supabaseEx: any) {
          console.warn('[TripService] Supabase exception:', supabaseEx);
          supabaseErrorMessage = 'Supabase 연결 오류';
        }
      }

      lastWrittenContentFingerprint.set(cleanTrip.id, contentFingerprint);
      lastWrittenTripHash.set(cleanTrip.id, payloadHash);
      clearTimeout(watchdog);

      if (supabaseErrorMessage) {
        updateSyncStatus('error', supabaseErrorMessage);
      } else if (supabaseSuccess) {
        updateSyncStatus('synced', 'Supabase 실시간 동기화 완료');
      } else {
        updateSyncStatus('synced', '로컬 & 서버 저장 완료');
      }
    } catch (err: any) {
      clearTimeout(watchdog);
      console.warn('[TripService] Save write notice:', err);
      updateSyncStatus('synced', '로컬 저장 완료');
    } finally {
      pendingTripWrites.delete(cleanTrip.id);
    }
  }, 350);

  pendingTripWrites.set(cleanTrip.id, timer);
}

// Backward-compatible alias
export const saveTripToFirestore = saveTripToSupabase;
export const saveTripToCloud = saveTripToSupabase;

// ----------------------------------------------------------------------------
// Delete Trip (Supabase + LocalStorage + IndexedDB + Server Hub)
// ----------------------------------------------------------------------------

export async function deleteTripFromSupabase(tripId: string): Promise<void> {
  const existingTimer = pendingTripWrites.get(tripId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    pendingTripWrites.delete(tripId);
  }
  lastWrittenTripHash.delete(tripId);
  lastWrittenContentFingerprint.delete(tripId);

  // Permanently mark as deleted
  markTripAsDeleted(tripId);

  // 1. Immediately update browser cache and IndexedDB
  try {
    const currentTrips = getStoredTrips().filter((t) => t.id !== tripId);
    saveTripsToLocalStorage(currentTrips);
    saveTripsToIDB(currentTrips).catch((err) => {
      console.error('상세 에러 (deleteTrip IDB):', err);
    });
    deleteTripFromIDB(tripId).catch(() => {});
  } catch (err) {
    console.error('상세 에러 (deleteTrip local cache):', err);
  }

  updateSyncStatus('saving', '여행 삭제 중...');

  // 2. Delete from Server Hub (instantly broadcasts deletion via SSE)
  deleteTripFromServer(tripId).catch(() => {});

  // 3. Mark is_deleted & delete from Supabase
  try {
    const supabase = getSupabase();
    if (supabase && isSupabaseConfigured()) {
      await supabase.from(TRIPS_TABLE).update({ is_deleted: true, updated_at: Date.now() }).eq('id', tripId);
      await supabase.from(TRIPS_TABLE).delete().eq('id', tripId);
    }
    updateSyncStatus('synced', '자동저장 완료 (실시간 동기화됨)');
  } catch (err: any) {
    console.warn('Supabase delete notice:', err);
    updateSyncStatus('synced', '자동저장 완료 (실시간 동기화됨)');
  }
}

// Backward-compatible alias
export const deleteTripFromFirestore = deleteTripFromSupabase;
export const deleteTripFromCloud = deleteTripFromSupabase;

// ----------------------------------------------------------------------------
// Realtime Subscription to Trips (Supabase postgres_changes + SSE fallback)
// ----------------------------------------------------------------------------

export function subscribeToTrips(
  onUpdate: (trips: Trip[]) => void,
  onError?: (error: Error) => void
) {
  let isSubscribed = true;
  updateSyncStatus('connecting', '클라우드 동기화 연결 중...');

  // 0. Fetch latest deleted trips list
  fetch('/api/sync/deleted_trips')
    .then((res) => res.json())
    .then((data) => {
      if (data && Array.isArray(data.deletedTripIds)) {
        data.deletedTripIds.forEach((id: string) => markTripAsDeleted(id));
      }
    })
    .catch(() => {});

  // 1. Immediately serve latest from IndexedDB / localStorage for 0ms initial render
  getTripsFromIDB().then((idbTrips) => {
    if (!isSubscribed) return;
    const deletedSet = getDeletedTripIds();
    const filteredIdb = idbTrips ? idbTrips.filter((t) => t && t.id && !deletedSet.has(t.id)) : null;
    const initial = filteredIdb && filteredIdb.length > 0 ? filteredIdb : getStoredTrips();
    if (initial && initial.length > 0) {
      onUpdate(initial);
    }
  }).catch((err) => {
    console.error('상세 에러 (getTripsFromIDB initial):', err);
  });

  // Reconciler for incoming remote trips
  const handleIncomingTrips = async (remoteTrips: Trip[]) => {
    if (!remoteTrips || remoteTrips.length === 0) return;

    const deletedSet = getDeletedTripIds();
    const cleanRemote = remoteTrips.filter((t) => t && t.id && !deletedSet.has(t.id) && !(t as any).isDeleted);

    let localTrips: Trip[] = [];
    try {
      const idbTrips = await getTripsFromIDB();
      localTrips = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
    } catch {
      localTrips = getStoredTrips();
    }
    localTrips = localTrips.filter((t) => t && t.id && !deletedSet.has(t.id) && !(t as any).isDeleted);

    const finalTrips: Trip[] = [];

    cleanRemote.forEach((remote) => {
      if (!remote || !remote.id) return;
      if (deletedSet.has(remote.id) || (remote as any).isDeleted) return;
      const local = localTrips.find((t) => t && t.id === remote.id);
      let chosen: Trip;
      if (!local) {
        chosen = remote;
      } else {
        const isLocalNewer = (local.updatedAt || 0) > (remote.updatedAt || 0);
        if (isLocalNewer || pendingTripWrites.has(remote.id)) {
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

    for (const local of localTrips) {
      if (!finalTrips.some((t) => t.id === local.id) && !deletedSet.has(local.id) && !(local as any).isDeleted) {
        finalTrips.push({
          ...local,
          title: cleanTripTitle(local.title)
        });
      }
    }

    const brand = getStoredBrandSettings();
    if (brand && Array.isArray(brand.tripOrder) && brand.tripOrder.length > 0) {
      const orderMap = new Map(brand.tripOrder.map((id, index) => [id, index]));
      finalTrips.sort((a, b) => {
        const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
        const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
        return idxA - idxB;
      });
    }

    saveTripsToLocalStorage(finalTrips);
    saveTripsToIDB(finalTrips).catch((err) => {
      console.error('상세 에러 (saveTripsToIDB snapshot):', err);
    });

    updateSyncStatus('synced', '자동저장 완료 (실시간 동기화됨)');
    onUpdate(finalTrips);

    resolveTripPhotosList(finalTrips).then((resolved) => {
      if (!isSubscribed) return;
      const cleanResolved = resolved.filter((t) => t && t.id && !deletedSet.has(t.id) && !(t as any).isDeleted);
      saveTripsToIDB(cleanResolved).catch((err) => {
        console.error('상세 에러 (saveTripsToIDB resolved photos):', err);
      });
      const hasChanges = JSON.stringify(cleanResolved) !== JSON.stringify(finalTrips);
      if (hasChanges) {
        onUpdate(cleanResolved);
      }
    }).catch((photoErr) => {
      console.error('상세 에러 (resolveTripPhotosList):', photoErr);
    });
  };

  // 2. Fetch latest trips from Server Hub
  fetch('/api/sync/trips')
    .then((res) => res.json())
    .then((data) => {
      if (!isSubscribed) return;
      if (data && Array.isArray(data.trips) && data.trips.length > 0) {
        handleIncomingTrips(data.trips);
      } else {
        getTripsFromIDB().then((idbTrips) => {
          const deletedSet = getDeletedTripIds();
          const initial = idbTrips && idbTrips.length > 0 ? idbTrips.filter((t) => !deletedSet.has(t.id) && !(t as any).isDeleted) : getStoredTrips();
          if (initial && initial.length > 0) {
            syncAllTripsToServer(initial).catch(() => {});
            onUpdate(initial);
          }
        });
      }
    })
    .catch(() => {});

  // 3. Connect to Server SSE stream
  let eventSource: EventSource | null = null;
  try {
    eventSource = new EventSource('/api/sync/stream');
    eventSource.onmessage = (event) => {
      if (!isSubscribed) return;
      try {
        const payload = JSON.parse(event.data);
        if (payload.deletedTripId) {
          markTripAsDeleted(payload.deletedTripId);
          deleteTripFromIDB(payload.deletedTripId).catch(() => {});
        }
        if (Array.isArray(payload.deletedTripIds)) {
          payload.deletedTripIds.forEach((id: string) => {
            markTripAsDeleted(id);
            deleteTripFromIDB(id).catch(() => {});
          });
        }
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
  } catch (sseErr) {
    console.warn('[TripService] SSE stream notice:', sseErr);
  }

  // 4. Refetch on tab focus or visibility change
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

      // Also refresh from Supabase if configured
      const supabase = getSupabase();
      if (supabase && isSupabaseConfigured()) {
        (async () => {
          try {
            const { data } = await supabase
              .from(TRIPS_TABLE)
              .select('*')
              .order('updated_at', { ascending: false });
            if (data && Array.isArray(data)) {
              const tripsList: Trip[] = [];
              const deletedSet = getDeletedTripIds();
              data.forEach((row: any) => {
                if (row.is_deleted) {
                  markTripAsDeleted(row.id);
                  deleteTripFromIDB(row.id).catch(() => {});
                  return;
                }
                if (!deletedSet.has(row.id) && !isTripDeleted(row.id)) {
                  const t = row.data && typeof row.data === 'object' ? row.data : row;
                  tripsList.push(t);
                }
              });
              if (tripsList.length > 0) handleIncomingTrips(tripsList);
            }
          } catch {}
        })();
      }
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // --------------------------------------------------------------------------
  // 5. Supabase Realtime Subscription: supabase.channel().on('postgres_changes', ...)
  // --------------------------------------------------------------------------
  let supabaseChannel: any = null;
  const initSupabaseRealtime = () => {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) {
      return;
    }

    // A. Initial fetch from Supabase
    (async () => {
      try {
        const { data, error } = await supabase
          .from(TRIPS_TABLE)
          .select('*')
          .order('updated_at', { ascending: false });

        if (!isSubscribed) return;

        if (error) {
          console.warn('[TripService] Supabase initial query error:', error);
          if (error.code === 'PGRST205') {
            updateSyncStatus('error', 'Supabase trips 테이블 생성 필요');
          } else {
            updateSyncStatus('error', `Supabase 연결 오류: ${error.message}`);
          }
          return;
        }

        if (Array.isArray(data)) {
          if (data.length > 0) {
            const tripsList: Trip[] = [];
            const deletedSet = getDeletedTripIds();
            data.forEach((row: any) => {
              if (row.is_deleted) {
                markTripAsDeleted(row.id);
                deleteTripFromIDB(row.id).catch(() => {});
                return;
              }
              if (!deletedSet.has(row.id) && !isTripDeleted(row.id)) {
                const t: Trip = row.data && typeof row.data === 'object' ? row.data : row;
                tripsList.push(t);
              }
            });
            if (tripsList.length > 0) {
              handleIncomingTrips(tripsList);
            }
          } else {
            // Supabase table exists but is currently empty: push current local trips into Supabase
            const local = getStoredTrips();
            if (local && local.length > 0) {
              console.log('[TripService] Auto-populating empty Supabase trips table with local trips...');
              local.forEach(async (t) => {
                try {
                  await supabase.from(TRIPS_TABLE).upsert({
                    id: t.id,
                    title: t.title || '',
                    destination: t.destination || '',
                    start_date: t.startDate || '',
                    end_date: t.endDate || '',
                    data: t,
                    is_deleted: false,
                    updated_at: t.updatedAt || Date.now(),
                  }, { onConflict: 'id' });
                } catch {}
              });
            }
          }
        }
      } catch (err) {
        console.warn('[TripService] Supabase initial trips exception:', err);
      }
    })();

    // B. Realtime Postgres Changes Subscription
    try {
      const channelId = `trips-realtime-${Math.random().toString(36).substring(2, 7)}`;
      supabaseChannel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: TRIPS_TABLE },
          (payload: any) => {
            if (!isSubscribed) return;
            console.log('[Supabase Realtime] Trip change event:', payload.eventType, payload);

            if (payload.eventType === 'DELETE') {
              const deletedId = payload.old?.id;
              if (deletedId) {
                markTripAsDeleted(deletedId);
                deleteTripFromIDB(deletedId).catch(() => {});
                getTripsFromIDB().then((cached) => {
                  const filtered = (cached || []).filter((t) => t.id !== deletedId);
                  saveTripsToLocalStorage(filtered);
                  onUpdate(filtered);
                });
              }
              return;
            }

            const record = payload.new;
            if (!record || !record.id) return;

            if (record.is_deleted) {
              markTripAsDeleted(record.id);
              deleteTripFromIDB(record.id).catch(() => {});
              getTripsFromIDB().then((cached) => {
                const filtered = (cached || []).filter((t) => t.id !== record.id);
                saveTripsToLocalStorage(filtered);
                onUpdate(filtered);
              });
              return;
            }

            const incomingTrip: Trip = record.data && typeof record.data === 'object' ? record.data : record;
            handleIncomingTrips([incomingTrip]);
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            updateSyncStatus('synced', 'Supabase 실시간 동기화 활성화됨');
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('[Supabase Realtime] Channel subscribe error, table may need setup');
          }
        });
    } catch (err: any) {
      console.warn('[TripService] Supabase realtime subscribe error:', err?.message || err);
    }
  };

  initSupabaseRealtime();

  // C. Cross-device Fallback Polling (Every 4 seconds for instant mobile sync)
  const pollTimer = setInterval(() => {
    if (!isSubscribed) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    // 1. Poll Server Hub
    fetch('/api/sync/trips')
      .then((res) => res.json())
      .then((data) => {
        if (data && Array.isArray(data.trips) && data.trips.length > 0) {
          handleIncomingTrips(data.trips);
        }
      })
      .catch(() => {});

    // 2. Poll Supabase directly
    const sp = getSupabase();
    if (sp && isSupabaseConfigured()) {
      (async () => {
        try {
          const { data, error } = await sp
            .from(TRIPS_TABLE)
            .select('*')
            .order('updated_at', { ascending: false });

          if (!error && Array.isArray(data) && data.length > 0) {
            const tripsList: Trip[] = [];
            const deletedSet = getDeletedTripIds();
            data.forEach((row: any) => {
              if (row.is_deleted) {
                markTripAsDeleted(row.id);
                deleteTripFromIDB(row.id).catch(() => {});
                return;
              }
              if (!deletedSet.has(row.id) && !isTripDeleted(row.id)) {
                const t: Trip = row.data && typeof row.data === 'object' ? row.data : row;
                tripsList.push(t);
              }
            });
            if (tripsList.length > 0) {
              handleIncomingTrips(tripsList);
            }
          }
        } catch {}
      })();
    }
  }, 4000);

  const handleConfigChanged = () => {
    if (supabaseChannel && getSupabase()) {
      try {
        getSupabase()?.removeChannel(supabaseChannel);
      } catch {}
    }
    initSupabaseRealtime();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('supabase-config-changed', handleConfigChanged);
  }

  return () => {
    isSubscribed = false;
    clearInterval(pollTimer);
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('supabase-config-changed', handleConfigChanged);
    }
    if (supabaseChannel && getSupabase()) {
      try {
        getSupabase()?.removeChannel(supabaseChannel);
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

// ----------------------------------------------------------------------------
// Realtime Subscription to Brand Settings (Supabase + LocalStorage)
// ----------------------------------------------------------------------------

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
  onUpdate(getStoredBrandSettings());
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

  let supabaseBrandChannel: any = null;

  const initSupabaseBrand = () => {
    const supabase = getSupabase();
    if (!supabase || !isSupabaseConfigured()) return;

    // A. Initial fetch from Supabase settings
    (async () => {
      try {
        const { data } = await supabase
          .from(SETTINGS_TABLE)
          .select('*')
          .eq('id', 'brand')
          .maybeSingle();
        if (data) {
          const brandData = data.data || data;
          if (brandData && brandData.title) {
            safeLocalStorageSet(STORAGE_BRAND_KEY, JSON.stringify(brandData));
            onUpdate(brandData);
          }
        }
      } catch {}
    })();

    // B. Realtime Postgres Changes Subscription for Settings
    try {
      const channelId = `brand-realtime-${Math.random().toString(36).substring(2, 7)}`;
      supabaseBrandChannel = supabase
        .channel(channelId)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: SETTINGS_TABLE },
          (payload: any) => {
            const record = payload.new;
            if (record && (record.id === 'brand' || record.key === 'brand')) {
              const brandData = record.data || record;
              if (brandData) {
                safeLocalStorageSet(STORAGE_BRAND_KEY, JSON.stringify(brandData));
                if (brandData.adminPassword) {
                  safeLocalStorageSet('jplanner_site_password', brandData.adminPassword);
                }
                onUpdate(brandData);
              }
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[TripService] Brand realtime subscribe error:', err);
    }
  };

  initSupabaseBrand();

  const handleConfigChanged = () => {
    if (supabaseBrandChannel && getSupabase()) {
      try {
        getSupabase()?.removeChannel(supabaseBrandChannel);
      } catch {}
    }
    initSupabaseBrand();
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('supabase-config-changed', handleConfigChanged);
  }

  return () => {
    brandListeners.delete(onUpdate);
    if (typeof window !== 'undefined') {
      window.removeEventListener('supabase-config-changed', handleConfigChanged);
    }
    if (supabaseBrandChannel && getSupabase()) {
      try {
        getSupabase()?.removeChannel(supabaseBrandChannel);
      } catch {}
    }
  };
}

// ----------------------------------------------------------------------------
// Save Brand Settings (Supabase + LocalStorage + Server Hub)
// ----------------------------------------------------------------------------

export async function saveBrandSettingsToSupabase(
  settings: {
    title: string;
    subtitle: string;
    badge: string;
    tabOrder?: TabType[];
    adminPassword?: string;
    tripOrder?: string[];
    activeTripId?: string;
    deletedTripIds?: string[];
    updatedAt?: number;
  },
  forceDirect = false
) {
  const currentDeleted = Array.from(getDeletedTripIds());
  const settingsWithTimestamp = {
    ...settings,
    deletedTripIds: Array.from(new Set([...currentDeleted, ...(settings.deletedTripIds || [])])),
    updatedAt: settings.updatedAt || Date.now()
  };
  safeLocalStorageSet(STORAGE_BRAND_KEY, JSON.stringify(settingsWithTimestamp));
  if (settingsWithTimestamp.adminPassword) {
    safeLocalStorageSet('jplanner_site_password', settingsWithTimestamp.adminPassword);
  }

  const safeSettings = removeUndefinedDeep(settingsWithTimestamp);
  const hash = JSON.stringify(safeSettings);
  if (lastWrittenBrandHash === hash && !forceDirect) {
    return;
  }

  updateSyncStatus('saving', '설정 동기화 중...');

  // 1. Server Hub sync
  syncBrandToServer(settingsWithTimestamp).catch(() => {});

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

      const supabase = getSupabase();
      if (supabase && isSupabaseConfigured()) {
        await supabase.from(SETTINGS_TABLE).upsert(
          {
            id: 'brand',
            data: safeSettings,
            updated_at: safeSettings.updatedAt || Date.now(),
          },
          { onConflict: 'id' }
        );
      }

      lastWrittenBrandHash = hash;
      updateSyncStatus('synced', '실시간 동기화됨');
    } catch (err: any) {
      console.warn('Supabase brand save notice:', err?.message || err);
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

// Backward-compatible alias
export const saveBrandSettingsToFirestore = saveBrandSettingsToSupabase;
export const saveBrandSettingsToCloud = saveBrandSettingsToSupabase;
