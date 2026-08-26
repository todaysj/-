import { Trip, SouvenirItem, PackingItem, ScheduleItem, ExpenseItem, Reservation, SouvenirTabConfig } from '../types';
import { getTripSouvenirTabs } from './tabUtils';

const IDB_NAME = 'JPlanner_Trips_DB';
const IDB_VERSION = 1;
const STORE_TRIPS = 'trips_cache';
const STORE_BACKUPS = 'trips_backups';

export interface TripBackup {
  id: string; // `${tripId}_${timestamp}`
  tripId: string;
  timestamp: number;
  dateStr: string;
  souvenirCount: number;
  checklistCount: number;
  scheduleCount: number;
  trip: Trip;
}

let idbPromise: Promise<IDBDatabase | null> | null = null;

function getTripsDB(): Promise<IDBDatabase | null> {
  if (idbPromise) return idbPromise;
  if (typeof window === 'undefined' || !window.indexedDB) {
    idbPromise = Promise.resolve(null);
    return idbPromise;
  }

  idbPromise = new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_TRIPS)) {
          db.createObjectStore(STORE_TRIPS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_BACKUPS)) {
          const backupStore = db.createObjectStore(STORE_BACKUPS, { keyPath: 'id' });
          backupStore.createIndex('tripId', 'tripId', { unique: false });
          backupStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        console.warn('[JPlanner] IndexedDB for trips unavailable, fallback to memory/localStorage.');
        resolve(null);
      };
    } catch {
      resolve(null);
    }
  });

  return idbPromise;
}

/**
 * Count total souvenirs in a trip across all tabs
 */
export function countTotalSouvenirs(trip: Trip): number {
  const seenIds = new Set<string>();
  if (trip.souvenirTabs && Array.isArray(trip.souvenirTabs)) {
    for (const tab of trip.souvenirTabs) {
      if (tab.items && Array.isArray(tab.items)) {
        for (const item of tab.items) {
          if (item?.id) seenIds.add(item.id);
        }
      }
    }
  }
  if (trip.souvenirs && Array.isArray(trip.souvenirs)) {
    for (const item of trip.souvenirs) {
      if (item?.id) seenIds.add(item.id);
    }
  }
  return seenIds.size;
}

/**
 * Count total checklist items in a trip
 */
export function countTotalChecklist(trip: Trip): number {
  const seenIds = new Set<string>();
  if (trip.checklistTabs && Array.isArray(trip.checklistTabs)) {
    for (const tab of trip.checklistTabs) {
      if (tab.items && Array.isArray(tab.items)) {
        for (const item of tab.items) {
          if (item?.id) seenIds.add(item.id);
        }
      }
    }
  }
  if (trip.packingList && Array.isArray(trip.packingList)) {
    for (const item of trip.packingList) {
      if (item?.id) seenIds.add(item.id);
    }
  }
  return seenIds.size;
}

/**
 * Save current trips list to IndexedDB
 */
export async function saveTripsToIDB(trips: Trip[]): Promise<void> {
  try {
    const db = await getTripsDB();
    if (!db) return;

    return new Promise((resolve) => {
      const tx = db.transaction([STORE_TRIPS], 'readwrite');
      const store = tx.objectStore(STORE_TRIPS);
      for (const trip of trips) {
        store.put(trip);
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[JPlanner] Error saving trips to IndexedDB:', err);
  }
}

/**
 * Get all trips from IndexedDB
 */
export async function getTripsFromIDB(): Promise<Trip[] | null> {
  try {
    const db = await getTripsDB();
    if (!db) return null;

    return new Promise((resolve) => {
      const tx = db.transaction([STORE_TRIPS], 'readonly');
      const store = tx.objectStore(STORE_TRIPS);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = req.result as Trip[] | undefined;
        if (Array.isArray(result) && result.length > 0) {
          resolve(result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Record a historical backup snapshot for a trip
 */
export async function saveTripBackup(trip: Trip): Promise<void> {
  try {
    const db = await getTripsDB();
    if (!db) return;

    const now = Date.now();
    const backup: TripBackup = {
      id: `${trip.id}_${now}`,
      tripId: trip.id,
      timestamp: now,
      dateStr: new Date(now).toLocaleString('ko-KR', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }),
      souvenirCount: countTotalSouvenirs(trip),
      checklistCount: countTotalChecklist(trip),
      scheduleCount: trip.schedule?.length || 0,
      trip: JSON.parse(JSON.stringify(trip))
    };

    return new Promise((resolve) => {
      const tx = db.transaction([STORE_BACKUPS], 'readwrite');
      const store = tx.objectStore(STORE_BACKUPS);
      store.put(backup);

      // Keep up to 3 recent backups per trip
      const index = store.index('tripId');
      const req = index.getAll(trip.id);
      req.onsuccess = () => {
        const all = (req.result as TripBackup[]) || [];
        if (all.length > 3) {
          all.sort((a, b) => a.timestamp - b.timestamp);
          const toDelete = all.slice(0, all.length - 3);
          for (const item of toDelete) {
            store.delete(item.id);
          }
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch (err) {
    console.warn('[JPlanner] Backup save warning:', err);
  }
}

/**
 * Get all historical backups for a trip, sorted latest first
 */
export async function getTripBackups(tripId: string): Promise<TripBackup[]> {
  try {
    const db = await getTripsDB();
    if (!db) return [];

    return new Promise((resolve) => {
      const tx = db.transaction([STORE_BACKUPS], 'readwrite');
      const store = tx.objectStore(STORE_BACKUPS);
      const index = store.index('tripId');
      const req = index.getAll(tripId);
      req.onsuccess = () => {
        const list = (req.result as TripBackup[]) || [];
        list.sort((a, b) => b.timestamp - a.timestamp);
        if (list.length > 3) {
          const toDelete = list.slice(3);
          for (const item of toDelete) {
            store.delete(item.id);
          }
        }
        resolve(list.slice(0, 3));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/**
 * Extracts souvenir items from a specific trip and tab
 */
export function getSouvenirItemsForTab(targetTrip: Trip, tabId: string, tabTitle?: string): SouvenirItem[] {
  if (targetTrip.souvenirTabs && Array.isArray(targetTrip.souvenirTabs) && targetTrip.souvenirTabs.length > 0) {
    const matchedById = targetTrip.souvenirTabs.find((t) => t.id === tabId);
    if (matchedById && Array.isArray(matchedById.items)) {
      return matchedById.items;
    }
    if (tabTitle) {
      const matchedByTitle = targetTrip.souvenirTabs.find((t) => t.title === tabTitle);
      if (matchedByTitle && Array.isArray(matchedByTitle.items)) {
        return matchedByTitle.items;
      }
    }
    if (targetTrip.souvenirTabs.length === 1 && (tabId === 'default-souvenirs' || tabId === targetTrip.souvenirTabs[0].id)) {
      return targetTrip.souvenirTabs[0].items || [];
    }
  }
  if (tabId === 'default-souvenirs' && targetTrip.souvenirs && Array.isArray(targetTrip.souvenirs)) {
    return targetTrip.souvenirs;
  }
  return [];
}

/**
 * Restores ONLY the specified souvenir tab from a backup snapshot, leaving all other tabs untouched.
 */
export function restoreTabFromBackup(
  currentTrip: Trip,
  tabId: string,
  backupTrip: Trip,
  tabTitle?: string
): Trip {
  const cloned: Trip = JSON.parse(JSON.stringify(currentTrip));
  const tabs = getTripSouvenirTabs(cloned);
  const backupItems = getSouvenirItemsForTab(backupTrip, tabId, tabTitle);

  // Find backup tab tags and tagColors if available
  let backupTags: string[] | undefined;
  let backupTagColors: Record<string, string> | undefined;
  if (backupTrip.souvenirTabs && Array.isArray(backupTrip.souvenirTabs)) {
    const bTab = backupTrip.souvenirTabs.find((t) => t.id === tabId || (tabTitle && t.title === tabTitle));
    if (bTab && bTab.tags && bTab.tags.length > 0) {
      backupTags = bTab.tags;
    }
    if (bTab && bTab.tagColors) {
      backupTagColors = bTab.tagColors;
    }
  }

  const updatedTabs = tabs.map((tab) => {
    if (tab.id === tabId || (tabTitle && tab.title === tabTitle)) {
      return {
        ...tab,
        items: JSON.parse(JSON.stringify(backupItems)),
        tags: backupTags || tab.tags,
        tagColors: backupTagColors || tab.tagColors
      };
    }
    return tab;
  });

  cloned.souvenirTabs = updatedTabs;
  cloned.souvenirs = updatedTabs[0]?.items || [];
  cloned.updatedAt = Date.now();
  return cloned;
}

/**
 * Auto-recovery algorithm scoped to a specific souvenir tab.
 * Inspects all historical backups, finds missing items for THIS tab, and restores them into this tab only.
 */
export async function autoRecoverTabSouvenirs(
  currentTrip: Trip,
  tabId: string,
  tabTitle?: string
): Promise<{ trip: Trip; recoveredCount: number }> {
  const cloned: Trip = JSON.parse(JSON.stringify(currentTrip));
  const backups = await getTripBackups(currentTrip.id);
  if (!backups || backups.length === 0) {
    return { trip: cloned, recoveredCount: 0 };
  }

  const currentTabItems = getSouvenirItemsForTab(cloned, tabId, tabTitle);
  const currentItemIds = new Set<string>();
  for (const item of currentTabItems) {
    if (item?.id) currentItemIds.add(item.id);
  }

  // Collect all known items that belonged to this tab in historical backups
  const knownTabItems = new Map<string, SouvenirItem>();
  for (const backup of backups) {
    const bItems = getSouvenirItemsForTab(backup.trip, tabId, tabTitle);
    for (const item of bItems) {
      if (item && item.id && !knownTabItems.has(item.id)) {
        knownTabItems.set(item.id, item);
      }
    }
  }

  const missingItems: SouvenirItem[] = [];
  for (const [id, item] of knownTabItems.entries()) {
    if (!currentItemIds.has(id)) {
      missingItems.push(item);
    }
  }

  if (missingItems.length === 0) {
    return { trip: cloned, recoveredCount: 0 };
  }

  // Merge missing items into the current tab only
  const tabs = getTripSouvenirTabs(cloned);
  const updatedTabs = tabs.map((tab) => {
    if (tab.id === tabId || (tabTitle && tab.title === tabTitle)) {
      return {
        ...tab,
        items: [...missingItems, ...(tab.items || [])]
      };
    }
    return tab;
  });

  cloned.souvenirTabs = updatedTabs;
  cloned.souvenirs = updatedTabs[0]?.items || [];
  cloned.updatedAt = Date.now();

  return { trip: cloned, recoveredCount: missingItems.length };
}

/**
 * Full auto-recovery across all tabs (for initial sync fallback)
 */
export async function autoRecoverMissingSouvenirs(currentTrip: Trip): Promise<{ trip: Trip; recoveredCount: number }> {
  const cloned: Trip = JSON.parse(JSON.stringify(currentTrip));
  const tabs = getTripSouvenirTabs(cloned);
  let totalRecovered = 0;
  let runningTrip = cloned;

  for (const tab of tabs) {
    const res = await autoRecoverTabSouvenirs(runningTrip, tab.id, tab.title);
    if (res.recoveredCount > 0) {
      totalRecovered += res.recoveredCount;
      runningTrip = res.trip;
    }
  }

  return { trip: runningTrip, recoveredCount: totalRecovered };
}
