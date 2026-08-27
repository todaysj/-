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

// Clear any stale local quota limits or circuit breakers
try {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('jplanner_quota_exceeded_until');
  }
} catch {}

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
  } catch (err) {
    console.warn('Failed to load trips from browser cache:', err);
  }
  return INITIAL_TRIPS;
}

/**
 * Save trips list to browser localStorage cache
 */
export function saveTripsToLocalStorage(trips: Trip[]): void {
  try {
    localStorage.setItem(STORAGE_TRIPS_KEY, JSON.stringify(trips));
  } catch (err) {
    console.warn('Failed to save trips to browser cache:', err);
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
        } catch (e) {}
      }
      return res;
    }
  } catch (err) {
    console.warn('Failed to load brand settings from cache:', err);
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

  // 1. Immediately create a safety backup in IndexedDB
  saveTripBackup(timestampedTrip).catch(() => {});

  // 2. Synchronously update browser cache & IndexedDB with full data for instant local response
  try {
    const currentTrips = getStoredTrips();
    const exists = currentTrips.some((t) => t.id === timestampedTrip.id);
    const updatedTrips = exists
      ? currentTrips.map((t) => (t.id === timestampedTrip.id ? timestampedTrip : t))
      : [timestampedTrip, ...currentTrips];
    saveTripsToLocalStorage(updatedTrips);
    saveTripsToIDB(updatedTrips).catch(() => {});
  } catch (err) {
    console.warn('Local cache save warning:', err);
  }

  // 3. Prepare clean trip: upload photos to Firestore `/photos/{photoId}` and replace with `photo://${photoId}`
  let cleanTrip: Trip;
  try {
    const detached = await detachTripPhotos(timestampedTrip);
    cleanTrip = sanitizeForFirestore(detached);
  } catch (e) {
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
    } catch (err: any) {
      console.warn('Trip Firestore write retry:', err);
      try {
        const fallbackTrip = sanitizeForFirestore(safePayload);
        await setDoc(doc(db, TRIPS_COLLECTION, fallbackTrip.id), fallbackTrip, { merge: true });
      } catch (finalErr) {
        console.error('Failed to save trip to Firestore:', finalErr);
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

  // 1. Immediately update browser cache and IndexedDB
  try {
    const currentTrips = getStoredTrips();
    const updatedTrips = currentTrips.filter((t) => t.id !== tripId);
    saveTripsToLocalStorage(updatedTrips);
    saveTripsToIDB(updatedTrips).catch(() => {});
  } catch (err) {
    console.warn('Local cache delete warning:', err);
  }

  // 2. Delete from Firestore
  try {
    await deleteDoc(doc(db, TRIPS_COLLECTION, tripId));
  } catch (err: any) {
    console.error('Failed to delete trip from Firestore:', err);
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

  // Immediately serve latest from IndexedDB / localStorage while connecting to Firestore
  getTripsFromIDB().then((idbTrips) => {
    const initial = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
    onUpdate(initial);
  });

  try {
    const tripsRef = collection(db, TRIPS_COLLECTION);
    unsubscribe = onSnapshot(
      tripsRef,
      async (snapshot) => {
        if (snapshot.empty) {
          // If Firestore is completely empty on first launch, seed once with default trips
          const idbTrips = await getTripsFromIDB();
          const initial = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
          onUpdate(initial);
          if (initial && initial.length > 0) {
            for (const trip of initial) {
              const clean = sanitizeForFirestore(await detachTripPhotos(trip));
              setDoc(doc(db, TRIPS_COLLECTION, clean.id), clean, { merge: true }).catch(() => {});
            }
          }
        } else {
          const rawRemoteTrips: Trip[] = [];
          snapshot.forEach((docSnap) => {
            rawRemoteTrips.push(docSnap.data() as Trip);
          });

          // Sort trips cleanly
          const idbTrips = await getTripsFromIDB();
          const localTrips = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
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
          saveTripsToIDB(finalTrips).catch(() => {});

          // Immediately update state so all connected devices see the new schedule and souvenirs instantly
          onUpdate(finalTrips);

          // Resolve photos in the background and update state once photos are ready
          resolveTripPhotosList(finalTrips).then((resolved) => {
            saveTripsToIDB(resolved).catch(() => {});
            const hasChanges = JSON.stringify(resolved) !== JSON.stringify(finalTrips);
            if (hasChanges) {
              onUpdate(resolved);
            }
          });
        }
      },
      (err: any) => {
        console.error('Firestore trips subscription error:', err);
        getTripsFromIDB().then((idbTrips) => {
          const fallback = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
          onUpdate(fallback);
        });
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    console.error('Firestore trips connection error:', err);
    getTripsFromIDB().then((idbTrips) => {
      const fallback = idbTrips && idbTrips.length > 0 ? idbTrips : getStoredTrips();
      onUpdate(fallback);
    });
  }

  return () => {
    if (unsubscribe) {
      try {
        unsubscribe();
        unsubscribe = null;
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
        } catch {
          return trip;
        }
      })
    );
  } catch {
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
          } catch (e) {}
          onUpdate(settings);
        }
      },
      (err: any) => {
        console.error('Brand settings subscription error:', err);
        onUpdate(getStoredBrandSettings());
      }
    );
  } catch (err) {
    console.error('Brand settings connection error:', err);
    onUpdate(getStoredBrandSettings());
  }

  return () => {
    if (unsubscribe) {
      try {
        unsubscribe();
      } catch {}
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
  try {
    localStorage.setItem(STORAGE_BRAND_KEY, JSON.stringify(settings));
    if (settings.adminPassword) {
      localStorage.setItem('jplanner_site_password', settings.adminPassword);
    }
  } catch (err) {
    console.warn('Brand local cache warning:', err);
  }

  if (pendingBrandTimer) {
    clearTimeout(pendingBrandTimer);
  }

  pendingBrandTimer = setTimeout(async () => {
    pendingBrandTimer = null;
    try {
      const safeSettings = removeUndefinedDeep(settings);
      await setDoc(doc(db, 'settings', 'brand'), safeSettings, { merge: true });
    } catch (err: any) {
      console.error('Failed to save brand settings to Firestore:', err);
    }
  }, 300);
}
