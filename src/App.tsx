import React, { useState, useEffect, useRef } from 'react';
import { Trip, ScheduleItem, Reservation, ExpenseItem, PackingItem, TabType } from './types';
import { INITIAL_TRIPS } from './data/mockData';
import { Navbar } from './components/Navbar';
import { ItineraryView } from './components/ItineraryView';
import { MapView } from './components/MapView';
import { ReservationsView } from './components/ReservationsView';
import { BudgetView } from './components/BudgetView';
import { ChecklistView } from './components/ChecklistView';
import { SouvenirView } from './components/SouvenirView';
import { EventModal } from './components/EventModal';
import { ReservationModal } from './components/ReservationModal';
import { NewTripModal } from './components/NewTripModal';
import { EditTripModal } from './components/EditTripModal';
import { BrandEditModal } from './components/BrandEditModal';
import { ExportModal } from './components/ExportModal';
import { PasswordPromptModal } from './components/PasswordPromptModal';
import { TripOrderModal } from './components/TripOrderModal';
import { SiteLockScreen } from './components/SiteLockScreen';
import { SupabaseSetupBanner } from './components/SupabaseSetupBanner';
import { CheckCircle2, WifiOff, AlertTriangle, X, Upload, RotateCcw } from 'lucide-react';
import { calculateEventDate } from './utils/currencyUtils';
import { getTotalTripDays, adjustSubsequentSchedules, timeStringToMinutes } from './utils/dateUtils';
import {
  subscribeToTrips,
  saveTripToFirestore,
  deleteTripFromFirestore,
  subscribeToBrandSettings,
  saveBrandSettingsToFirestore,
  syncAllTripsToServer,
  getStoredTrips,
  getStoredBrandSettings,
  saveTripsToLocalStorage,
  subscribeToSyncStatus,
  subscribeToFirestoreErrors,
  isQuotaExceeded,
  markTripAsDeleted,
  getDeletedTripIds,
  safeLocalStorageSet,
  STORAGE_BRAND_KEY,
  SyncStatus
} from './lib/tripService';
import { getAllLocalPhotos, savePhotoToCloud } from './utils/photoStore';
import { getTripsFromIDB, saveTripsToIDB } from './utils/tripIndexedDB';
import { parseTripBackup } from './utils/backupUtils';

const STORAGE_LAST_TRIP_KEY = 'jplanner_last_active_trip_id';

const resolveBestTripId = (
  tripList: Trip[],
  currentActiveId?: string,
  orderList?: string[],
  userSelectedExplicitly?: boolean,
  cloudActiveTripId?: string
): string => {
  if (!tripList || tripList.length === 0) return '';

  // 1. If user explicitly switched trip during this active browser session, preserve their explicit choice
  if (userSelectedExplicitly && currentActiveId && tripList.some((t) => t.id === currentActiveId)) {
    return currentActiveId;
  }

  // 2. URL parameter ?trip=... (if present and matches a valid trip, e.g. shared deep links)
  if (typeof window !== 'undefined') {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTrip = urlParams.get('trip');
      if (urlTrip && tripList.some((t) => t.id === urlTrip)) {
        return urlTrip;
      }
    } catch {}
  }

  // 3. Primary trip configured in Cloud tripOrder settings (top of user's custom order)
  if (orderList && orderList.length > 0) {
    const firstOrdered = tripList.find((t) => t.id === orderList[0]);
    if (firstOrdered) return firstOrdered.id;
  }

  // 4. Cloud configured active trip (from Firestore settings/brand)
  if (cloudActiveTripId && tripList.some((t) => t.id === cloudActiveTripId)) {
    return cloudActiveTripId;
  }

  // 5. Trip with the newest updatedAt or first available in tripList
  const validTrips = (tripList || []).filter((t): t is Trip => Boolean(t && t.id));
  if (validTrips.length === 0) return '';

  const sortedByUpdated = [...validTrips].sort((a, b) => {
    return (b?.updatedAt || 0) - (a?.updatedAt || 0);
  });

  return sortedByUpdated[0]?.id || validTrips[0]?.id || '';
};

const sortTripsWithOrder = (tripsToSort: Trip[], order?: string[]): Trip[] => {
  const valid = (tripsToSort || []).filter((t): t is Trip => Boolean(t && t.id));
  if (!order || order.length === 0) return valid;
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...valid].sort((a, b) => {
    const idxA = a?.id && orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
    const idxB = b?.id && orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
    return idxA - idxB;
  });
};

const DEFAULT_STARTER_TRIP: Trip = {
  id: 'trip-starter',
  title: '새 여행 일정',
  destination: '여행지',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
  coverImage: '',
  totalBudget: 0,
  currency: 'KRW',
  schedule: [],
  reservations: [],
  expenses: [],
  packingList: [],
  checklistTabs: [
    {
      id: 'cl-default',
      title: '기본 체크리스트',
      items: [],
      categories: ['필수 서류', '전자기기', '금융/통신', '의류/세면', '상비약', '기타']
    }
  ],
  souvenirTabs: [
    {
      id: 'souv-default',
      title: '기념품',
      items: [],
      tags: ['식품', '화장품', '의류', '기념품', '면세품', '기타'],
      tagColors: {}
    }
  ],
  updatedAt: Date.now()
};

export interface ScheduleHistorySnapshot {
  tripId: string;
  schedule: ScheduleItem[];
  expenses: ExpenseItem[];
  description: string;
}

export default function App() {
  const [trips, setTrips] = useState<Trip[]>(() => getStoredTrips());
  const tripsRef = useRef<Trip[]>(trips);
  useEffect(() => {
    tripsRef.current = trips;
  }, [trips]);

  const initialBrand = getStoredBrandSettings();
  const userExplicitlySelectedRef = useRef<boolean>(false);
  const cloudActiveTripIdRef = useRef<string | undefined>(initialBrand.activeTripId);

  const [activeTripId, setActiveTripId] = useState<string>(() => {
    const initialList = getStoredTrips();
    return resolveBestTripId(
      initialList,
      undefined,
      initialBrand.tripOrder,
      false,
      initialBrand.activeTripId
    );
  });
  const [activeTab, setActiveTab] = useState<TabType>('itinerary');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<{ message: string; timestamp: number } | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [syncMessage, setSyncMessage] = useState<string>('DB 연결 대기 중...');
  const [isOffline, setIsOffline] = useState<boolean>(() => !navigator.onLine);
  const [loadTimedOut, setLoadTimedOut] = useState<boolean>(false);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

  // Safety watchdog timer for initial cloud load (prevents blank/infinite spinner on devices when Firestore quota is exceeded)
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoadTimedOut(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Subscribe to DB Sync Status & Silent Error Monitor
  useEffect(() => {
    const unsubStatus = subscribeToSyncStatus((info) => {
      setSyncStatus(info.status);
      if (info.message) setSyncMessage(info.message);
    });

    const unsubError = subscribeToFirestoreErrors((errorMsg) => {
      setErrorToast({
        message: errorMsg,
        timestamp: Date.now()
      });
    });

    return () => {
      unsubStatus();
      unsubError();
    };
  }, []);

  // 3-second Auto-Dismiss for Red Error Toast
  useEffect(() => {
    if (!errorToast) return;
    const timer = setTimeout(() => {
      setErrorToast(null);
    }, 3000);
    return () => clearTimeout(timer);
  }, [errorToast]);

  // Clean URL bar from old query params if any
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.location.search) {
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
      }
    } catch (err) {
      console.error('상세 에러 (URL cleanup):', err);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Custom Brand Header & Tab Order State & Security
  const [brandTitle, setBrandTitle] = useState<string>(initialBrand.title);
  const [brandSubtitle, setBrandSubtitle] = useState<string>(initialBrand.subtitle);
  const [brandBadge, setBrandBadge] = useState<string>(initialBrand.badge);
  const [tabOrder, setTabOrder] = useState<TabType[]>(() => {
    const order = [...initialBrand.tabOrder];
    if (!order.includes('souvenirs')) {
      order.push('souvenirs');
    }
    return order;
  });
  const [tripOrder, setTripOrder] = useState<string[]>(initialBrand.tripOrder || []);
  const tripOrderRef = useRef<string[]>(initialBrand.tripOrder || []);
  const [adminPassword, setAdminPassword] = useState<string>(initialBrand.adminPassword);

  // Site Access Password Lock State (requires password on site entry, remembered during active session)
  const [isSiteUnlocked, setIsSiteUnlocked] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        return sessionStorage.getItem('jplanner_site_unlocked') === 'true';
      }
    } catch (e) {}
    return false;
  });

  // Manual Cloud Save State
  const [isManualSaving, setIsManualSaving] = useState<boolean>(false);
  const [isSaveSuccess, setIsSaveSuccess] = useState<boolean>(false);
  const saveSuccessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Password Verification Prompt State
  const [passwordModalConfig, setPasswordModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onSuccess: () => void;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onSuccess: () => {}
  });

  // Modals state
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventModalDay, setEventModalDay] = useState<number>(1);
  const [editingScheduleItem, setEditingScheduleItem] = useState<ScheduleItem | null>(null);
  const [eventModalInitialTime, setEventModalInitialTime] = useState<string | undefined>();
  const [eventModalInitialEndTime, setEventModalInitialEndTime] = useState<string | undefined>();
  const [eventModalInsertAfterId, setEventModalInsertAfterId] = useState<string | undefined>();
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTripOrderModalOpen, setIsTripOrderModalOpen] = useState(false);

  // Schedule Undo History Stack (stores up to 20 previous snapshots per trip)
  const [scheduleHistory, setScheduleHistory] = useState<ScheduleHistorySnapshot[]>([]);

  const pushScheduleHistory = (trip: Trip, actionDescription: string) => {
    setScheduleHistory((prev) => [
      {
        tripId: trip.id,
        schedule: JSON.parse(JSON.stringify(trip.schedule || [])),
        expenses: JSON.parse(JSON.stringify(trip.expenses || [])),
        description: actionDescription
      },
      ...prev.slice(0, 19)
    ]);
  };

  const handleUndoSchedule = () => {
    if (!activeTrip) return;
    const targetIndex = scheduleHistory.findIndex((h) => h.tripId === activeTrip.id);
    if (targetIndex === -1) return;

    const snapshotToRestore = scheduleHistory[targetIndex];
    const newHistory = scheduleHistory.filter((_, idx) => idx !== targetIndex);

    updateActiveTrip((trip) => ({
      ...trip,
      schedule: snapshotToRestore.schedule,
      expenses: snapshotToRestore.expenses
    }), true);

    setScheduleHistory(newHistory);
    setToastMessage(`직전 작업이 취소되었습니다. (${snapshotToRestore.description} 취소)`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Helper to switch active trip, sync URL and save to localStorage (Zero cloud writes on tab switch)
  const handleSelectTrip = (tripId: string) => {
    userExplicitlySelectedRef.current = true;
    cloudActiveTripIdRef.current = tripId;
    setActiveTripId(tripId);
    try {
      localStorage.setItem(STORAGE_LAST_TRIP_KEY, tripId);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.set('trip', tripId);
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {}
  };

  // Real-time Firestore sync for Trips
  useEffect(() => {
    const unsubscribe = subscribeToTrips((remoteTrips) => {
      if (remoteTrips && remoteTrips.length > 0) {
        const sorted = sortTripsWithOrder(remoteTrips, tripOrderRef.current);
        setTrips(sorted);
        setActiveTripId((prevId) => {
          const resolved = resolveBestTripId(
            sorted,
            prevId,
            tripOrderRef.current,
            userExplicitlySelectedRef.current,
            cloudActiveTripIdRef.current
          );
          try {
            localStorage.setItem(STORAGE_LAST_TRIP_KEY, resolved);
            if (typeof window !== 'undefined') {
              const url = new URL(window.location.href);
              url.searchParams.set('trip', resolved);
              window.history.replaceState({}, '', url.toString());
            }
          } catch (e) {}
          return resolved;
        });
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time Firestore sync for Brand Header, Tab Order, and Admin Password
  useEffect(() => {
    const unsubscribe = subscribeToBrandSettings((settings) => {
      if (settings.title) setBrandTitle(settings.title);
      if (settings.subtitle) setBrandSubtitle(settings.subtitle);
      if (settings.badge) setBrandBadge(settings.badge);
      if (settings.tabOrder && Array.isArray(settings.tabOrder) && settings.tabOrder.length > 0) {
        const order = [...settings.tabOrder];
        if (!order.includes('souvenirs')) {
          order.push('souvenirs');
        }
        setTabOrder(order);
      }
      if (settings.activeTripId) {
        cloudActiveTripIdRef.current = settings.activeTripId;
        if (!userExplicitlySelectedRef.current) {
          setActiveTripId(settings.activeTripId);
        }
      }
      if (settings.tripOrder && Array.isArray(settings.tripOrder)) {
        setTripOrder(settings.tripOrder);
        tripOrderRef.current = settings.tripOrder;
        setTrips((prev) => {
          const sorted = sortTripsWithOrder(prev, settings.tripOrder);
          if (!userExplicitlySelectedRef.current && sorted.length > 0) {
            const bestId = resolveBestTripId(
              sorted,
              undefined,
              settings.tripOrder,
              false,
              settings.activeTripId || cloudActiveTripIdRef.current
            );
            setActiveTripId(bestId);
          }
          return sorted;
        });
      }
      if (settings.adminPassword) {
        setAdminPassword(settings.adminPassword);
      }
    });

    return () => unsubscribe();
  }, []);

  const activeTrip = trips.find((t) => t.id === activeTripId) || trips[0] || INITIAL_TRIPS[0];

  // Helper to open password verification modal
  const requestProtectedAction = (title: string, description: string, action: () => void) => {
    setPasswordModalConfig({
      isOpen: true,
      title,
      description,
      onSuccess: action
    });
  };

  // Helper to update active trip locally & persist automatically to Cloud & Storage
  const updateActiveTrip = (updater: (trip: Trip) => Trip, forceImmediate: boolean = false) => {
    const prevTrips = tripsRef.current && tripsRef.current.length > 0 ? tripsRef.current : trips;
    const current = prevTrips.find((t) => t.id === activeTripId) || prevTrips[0];
    if (!current) return;

    const nextUpdatedTrip: Trip = { ...updater(current), updatedAt: Date.now() };
    const nextTrips = prevTrips.map((t) => (t.id === current.id ? nextUpdatedTrip : t));

    tripsRef.current = nextTrips;
    setTrips(nextTrips);

    // 1. Instantly save to LocalStorage and IndexedDB
    saveTripsToLocalStorage(nextTrips);
    saveTripsToIDB(nextTrips).catch(() => {});

    // 2. Automatically save to Supabase & Server Hub without needing manual button click
    saveTripToFirestore(nextUpdatedTrip, forceImmediate);
  };

  // Manual Cloud Save Handler: forces immediate synchronization to Firestore and persists full local cache
  const handleManualSave = async () => {
    if (isManualSaving) return;
    setIsManualSaving(true);
    setIsSaveSuccess(false);
    try {
      const current = (tripsRef.current && tripsRef.current.length > 0
        ? tripsRef.current.find((t) => t.id === activeTripId)
        : null) || activeTrip;
      if (!current) {
        setIsManualSaving(false);
        return;
      }
      const timestampedTrip: Trip = {
        ...current,
        updatedAt: Date.now()
      };

      // 1. Immediately update local state, reference, and offline caches
      const prevList = tripsRef.current && tripsRef.current.length > 0 ? tripsRef.current : trips;
      const currentTrips = prevList.map((t) => (t.id === timestampedTrip.id ? timestampedTrip : t));
      tripsRef.current = currentTrips;
      setTrips(currentTrips);
      saveTripsToLocalStorage(currentTrips);
      await saveTripsToIDB(currentTrips).catch(() => {});

      // 2. Force direct write active trip to Cloud & Supabase
      await saveTripToFirestore(timestampedTrip, true);

      // 3. Preserve user's configured trip order — NEVER forcefully move active trip to front!
      const currentOrder = tripOrderRef.current && tripOrderRef.current.length > 0
        ? tripOrderRef.current
        : currentTrips.map((t) => t.id);
      const preservedOrder = currentOrder.includes(timestampedTrip.id)
        ? currentOrder
        : [...currentOrder, timestampedTrip.id];
      setTripOrder(preservedOrder);
      tripOrderRef.current = preservedOrder;

      await saveBrandSettingsToFirestore({
        title: brandTitle,
        subtitle: brandSubtitle,
        badge: brandBadge,
        tabOrder,
        adminPassword: adminPassword || '1205',
        tripOrder: preservedOrder,
        activeTripId: timestampedTrip.id
      }, true);

      // 4. Trigger Save Success feedback
      setIsSaveSuccess(true);
      if (saveSuccessTimerRef.current) clearTimeout(saveSuccessTimerRef.current);
      saveSuccessTimerRef.current = setTimeout(() => {
        setIsSaveSuccess(false);
      }, 3500);

      // 5. User feedback toast
      setToastMessage('클라우드 서버에 안전하게 저장되었습니다! 모든 기기(스마트폰, 노트북, 공유된 기기)에 실시간 자동 동기화됩니다.');
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err: any) {
      console.error('수동 저장 오류:', err);
      setErrorToast({
        message: '저장 중 오류가 발생했습니다. 브라우저 캐시에 안전하게 보관되었습니다.',
        timestamp: Date.now()
      });
    } finally {
      setIsManualSaving(false);
    }
  };

  // Brand Header & Tab Order Handlers
  const handleSaveBrand = async (
    title: string,
    subtitle: string,
    badge: string,
    newTabOrder?: TabType[],
    newTripOrder?: string[],
    newActiveTripId?: string
  ) => {
    setBrandTitle(title);
    setBrandSubtitle(subtitle);
    setBrandBadge(badge);
    const orderToSave = newTabOrder || tabOrder;
    if (newTabOrder) {
      setTabOrder(newTabOrder);
    }
    const finalTripOrder = newTripOrder && newTripOrder.length > 0 ? newTripOrder : tripOrderRef.current;
    if (newTripOrder && newTripOrder.length > 0) {
      setTripOrder(newTripOrder);
      tripOrderRef.current = newTripOrder;
      setTrips((prev) => sortTripsWithOrder(prev, newTripOrder));
    }
    const finalActiveTripId = newActiveTripId || activeTripId;
    if (newActiveTripId) {
      setActiveTripId(newActiveTripId);
      cloudActiveTripIdRef.current = newActiveTripId;
    }
    await saveBrandSettingsToFirestore({
      title,
      subtitle,
      badge,
      tabOrder: orderToSave,
      adminPassword,
      tripOrder: finalTripOrder,
      activeTripId: finalActiveTripId
    }, true);
  };

  const handleSavePassword = (newPw: string) => {
    setAdminPassword(newPw);
    saveBrandSettingsToFirestore({
      title: brandTitle,
      subtitle: brandSubtitle,
      badge: brandBadge,
      tabOrder,
      adminPassword: newPw,
      tripOrder: tripOrderRef.current,
      activeTripId
    }, true);
  };

  const handleResetBrand = () => {
    const defaults = {
      title: 'J플래너',
      subtitle: '스마트 여행 일정 & 예약 보관함',
      badge: 'MBTI J전용',
      tabOrder: ['itinerary', 'map', 'reservations', 'budget', 'checklist', 'souvenirs'] as TabType[],
      adminPassword: '1205',
      tripOrder: []
    };
    setBrandTitle(defaults.title);
    setBrandSubtitle(defaults.subtitle);
    setBrandBadge(defaults.badge);
    setTabOrder(defaults.tabOrder);
    setAdminPassword(defaults.adminPassword);
    setTripOrder([]);
    tripOrderRef.current = [];
    saveBrandSettingsToFirestore(defaults, true);
  };

  // Trip Order Reordering Handler
  const handleSaveTripOrder = async (newOrderedTrips: Trip[]) => {
    const newOrderIds = newOrderedTrips.map((t) => t.id);
    setTrips(newOrderedTrips);
    setTripOrder(newOrderIds);
    tripOrderRef.current = newOrderIds;

    const topTripId = newOrderIds[0];

    // 1. Immediately persist new trips order to localStorage & IDB
    saveTripsToLocalStorage(newOrderedTrips);
    saveTripsToIDB(newOrderedTrips).catch(() => {});

    // 2. Immediately cache in localStorage brand settings
    const storedBrand = getStoredBrandSettings();
    const updatedBrand = {
      ...storedBrand,
      title: brandTitle,
      subtitle: brandSubtitle,
      badge: brandBadge,
      tabOrder,
      adminPassword,
      tripOrder: newOrderIds,
      activeTripId: topTripId
    };
    safeLocalStorageSet(STORAGE_BRAND_KEY, JSON.stringify(updatedBrand));

    // 3. Save brand settings with forceDirect = true to guarantee cloud & server persistence first
    await saveBrandSettingsToFirestore(updatedBrand, true);

    // 4. Sync ordered trips to Server Hub so data/trips.json reflects the new order
    await syncAllTripsToServer(newOrderedTrips).catch(() => {});

    // 5. Update active trip & URL so refreshing the browser immediately honors the new first trip
    if (topTripId) {
      cloudActiveTripIdRef.current = topTripId;
      setActiveTripId(topTripId);
      try {
        localStorage.setItem(STORAGE_LAST_TRIP_KEY, topTripId);
        if (typeof window !== 'undefined') {
          const url = new URL(window.location.href);
          url.searchParams.set('trip', topTripId);
          window.history.replaceState({}, '', url.toString());
        }
      } catch (e) {}
    }

    setToastMessage('여행 순서가 성공적으로 저장되었습니다!');
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Handlers for Itinerary
  const handleToggleScheduleDone = (itemId: string) => {
    if (activeTrip) {
      const item = activeTrip.schedule.find((s) => s.id === itemId);
      pushScheduleHistory(activeTrip, item ? `"${item.title}" 완료 토글` : '일정 상태 변경');
    }
    updateActiveTrip((trip) => ({
      ...trip,
      schedule: trip.schedule.map((s) =>
        s.id === itemId ? { ...s, isDone: !s.isDone } : s
      )
    }));
  };

  const handleDeleteScheduleItem = (itemId: string) => {
    if (activeTrip) {
      const item = activeTrip.schedule.find((s) => s.id === itemId);
      pushScheduleHistory(activeTrip, item ? `"${item.title}" 삭제` : '일정 삭제');
    }
    updateActiveTrip((trip) => ({
      ...trip,
      schedule: trip.schedule.filter((s) => s.id !== itemId),
      expenses: (trip.expenses || []).filter(
        (e) => e.scheduleItemId !== itemId && e.id !== `exp-sched-${itemId}`
      )
    }), true);
    setToastMessage('일정이 삭제되었습니다.');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveScheduleItem = (
    savedItem: ScheduleItem,
    insertAfterId?: string,
    shiftSubsequent: boolean = false
  ) => {
    let shiftedCount = 0;
    if (activeTrip) {
      const exists = activeTrip.schedule.some((s) => s.id === savedItem.id);
      pushScheduleHistory(
        activeTrip,
        exists
          ? `"${savedItem.title}" 일정 수정${shiftSubsequent ? ' (자동 순연)' : ''}`
          : `"${savedItem.title}" 일정 추가${shiftSubsequent ? ' (자동 순연)' : ''}`
      );
    }
    updateActiveTrip((trip) => {
      const exists = trip.schedule.some((s) => s.id === savedItem.id);
      let newSchedule: ScheduleItem[];
      if (exists) {
        newSchedule = trip.schedule.map((s) => (s.id === savedItem.id ? savedItem : s));
      } else if (insertAfterId) {
        const prevIdx = trip.schedule.findIndex((s) => s.id === insertAfterId);
        if (prevIdx !== -1) {
          newSchedule = [
            ...trip.schedule.slice(0, prevIdx + 1),
            savedItem,
            ...trip.schedule.slice(prevIdx + 1)
          ];
        } else {
          newSchedule = [...trip.schedule, savedItem];
        }
      } else {
        newSchedule = [...trip.schedule, savedItem];
      }

      // Auto-shift subsequent schedules if enabled
      if (shiftSubsequent) {
        const result = adjustSubsequentSchedules(newSchedule, savedItem, insertAfterId);
        newSchedule = result.updatedSchedule;
        shiftedCount = result.shiftedCount;
      }

      // Chronologically sort newSchedule strictly by day, start time, and end time
      newSchedule.sort((a, b) => {
        if (a.day !== b.day) return a.day - b.day;
        const aMin = timeStringToMinutes(a.time);
        const bMin = timeStringToMinutes(b.time);
        if (aMin !== bMin) return aMin - bMin;
        return (a.endTime ? timeStringToMinutes(a.endTime) : aMin) - (b.endTime ? timeStringToMinutes(b.endTime) : bMin);
      });

      // 🌟 Synchronize schedule item cost to Budget & Expenses (예산 & 가계부 연동)
      const linkedExpenseId = `exp-sched-${savedItem.id}`;
      let updatedExpenses = [...(trip.expenses || [])];

      if (savedItem.cost > 0) {
        const existingExpIndex = updatedExpenses.findIndex(
          (e) => e.scheduleItemId === savedItem.id || e.id === linkedExpenseId
        );

        const eventDate = calculateEventDate(trip.startDate, savedItem.day);
        const members = trip.members && trip.members.length > 0 ? trip.members : ['나'];
        const notesText = savedItem.notes
          ? `${savedItem.notes} (Day ${savedItem.day} 일정 연동)`
          : `Day ${savedItem.day} 일정 연동 (${savedItem.time})`;

        if (existingExpIndex >= 0) {
          const existing = updatedExpenses[existingExpIndex];
          updatedExpenses[existingExpIndex] = {
            ...existing,
            title: savedItem.title,
            category: savedItem.category,
            amount: savedItem.cost,
            currency: savedItem.currency,
            date: eventDate,
            notes: notesText,
            scheduleItemId: savedItem.id
          };
        } else {
          const newLinkedExpense: ExpenseItem = {
            id: linkedExpenseId,
            scheduleItemId: savedItem.id,
            date: eventDate,
            title: savedItem.title,
            category: savedItem.category,
            amount: savedItem.cost,
            currency: savedItem.currency,
            paidBy: members[0],
            paymentMethod: 'CARD',
            splitWith: [...members],
            notes: notesText
          };
          updatedExpenses = [newLinkedExpense, ...updatedExpenses];
        }
      } else {
        // If cost is 0 or cleared, remove any linked expense
        updatedExpenses = updatedExpenses.filter(
          (e) => e.scheduleItemId !== savedItem.id && e.id !== linkedExpenseId
        );
      }

      return {
        ...trip,
        schedule: newSchedule,
        expenses: updatedExpenses
      };
    }, true);
    if (shiftedCount > 0) {
      setToastMessage(`일정이 저장되고, 뒤의 ${shiftedCount}개 일정이 자동 순연되었습니다.`);
      setTimeout(() => setToastMessage(null), 4000);
    } else {
      setToastMessage('일정이 성공적으로 저장되었습니다.');
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  // Custom Currency Handler
  const handleAddCustomCurrency = (code: string, rate: number) => {
    updateActiveTrip((trip) => ({
      ...trip,
      customExchangeRates: {
        ...(trip.customExchangeRates || {}),
        [code.toUpperCase()]: rate
      }
    }));
  };

  // Duplicate Trip Handler (여행 복사하기)
  const handleDuplicateTrip = (tripToDuplicate?: Trip) => {
    const source = tripToDuplicate || activeTrip;
    if (!source) return;

    const timestamp = Date.now();
    const newId = `trip-${timestamp}`;
    const newTitle = `${source.title} (복사본)`;

    const duplicatedSchedule: ScheduleItem[] = (source.schedule || []).map((item, idx) => ({
      ...item,
      id: `item-${timestamp}-${idx}`
    }));

    const duplicatedReservations: Reservation[] = (source.reservations || []).map((res, idx) => ({
      ...res,
      id: `res-${timestamp}-${idx}`
    }));

    const duplicatedExpenses: ExpenseItem[] = (source.expenses || []).map((exp, idx) => ({
      ...exp,
      id: `exp-${timestamp}-${idx}`
    }));

    const duplicatedPacking: PackingItem[] = (source.packingList || []).map((pack, idx) => ({
      ...pack,
      id: `pack-${timestamp}-${idx}`
    }));

    const clonedTrip: Trip = {
      ...source,
      id: newId,
      title: newTitle,
      schedule: duplicatedSchedule,
      reservations: duplicatedReservations,
      expenses: duplicatedExpenses,
      packingList: duplicatedPacking
    };

    setTrips((prev) => [clonedTrip, ...prev]);
    handleSelectTrip(newId);
    saveTripToFirestore(clonedTrip);

    if (tripOrder.length > 0) {
      const updatedOrder = [newId, ...tripOrder];
      setTripOrder(updatedOrder);
      tripOrderRef.current = updatedOrder;
      saveBrandSettingsToFirestore({
        title: brandTitle,
        subtitle: brandSubtitle,
        badge: brandBadge,
        tabOrder,
        adminPassword,
        tripOrder: updatedOrder
      });
    }

    // Show copy complete message
    setToastMessage('복사가 완료되었습니다');
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Protected action triggers
  const handleRequestEditTrip = () => {
    requestProtectedAction(
      '여행 정보 수정',
      '여행명, 일정, 장소 등의 여행 정보를 수정하시려면 비밀번호를 입력해주세요.',
      () => setIsEditTripModalOpen(true)
    );
  };

  const handleRequestAdminModal = () => {
    requestProtectedAction(
      '관리자 모드 설정',
      '관리자 설정(여행 순서, 메인 탭 순서, 브랜드 문구, 비밀번호 변경)에 진입하시려면 비밀번호를 입력해주세요.',
      () => setIsBrandModalOpen(true)
    );
  };

  const handleRequestDeleteTrip = (tripIdToDelete: string) => {
    const targetTrip = trips.find((t) => t.id === tripIdToDelete) || activeTrip;
    requestProtectedAction(
      '여행 일정 삭제',
      `'${targetTrip?.title || '선택한'}' 여행 일정을 영구히 삭제하시겠습니까? 삭제된 일정과 모든 지출/예약 내역은 복구할 수 없습니다.`,
      () => handleDeleteTrip(tripIdToDelete)
    );
  };

  // Handlers for Trip Info Edit & Delete
  const handleDeleteTrip = (tripIdToDelete: string) => {
    const remainingTrips = trips.filter((t) => t.id !== tripIdToDelete);
    deleteTripFromFirestore(tripIdToDelete);

    if (remainingTrips.length === 0) {
      const fallbackTrip = INITIAL_TRIPS[0];
      setTrips([fallbackTrip]);
      handleSelectTrip(fallbackTrip.id);
      saveTripToFirestore(fallbackTrip);
    } else {
      setTrips(remainingTrips);
      saveTripsToLocalStorage(remainingTrips);
      saveTripsToIDB(remainingTrips).catch(() => {});
      syncAllTripsToServer(remainingTrips).catch(() => {});
      if (activeTripId === tripIdToDelete) {
        handleSelectTrip(remainingTrips[0].id);
      }
    }

    const updatedOrder = tripOrderRef.current.filter((id) => id !== tripIdToDelete);
    setTripOrder(updatedOrder);
    tripOrderRef.current = updatedOrder;
    saveBrandSettingsToFirestore({
      title: brandTitle,
      subtitle: brandSubtitle,
      badge: brandBadge,
      tabOrder,
      adminPassword,
      tripOrder: updatedOrder,
      activeTripId: remainingTrips[0]?.id
    }, true);

    // Show delete complete message
    setToastMessage('여행이 삭제되었습니다');
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSaveTrip = (updatedTrip: Trip) => {
    const timestamped: Trip = { ...updatedTrip, updatedAt: Date.now() };
    const prevTrips = tripsRef.current && tripsRef.current.length > 0 ? tripsRef.current : trips;
    const nextTrips = prevTrips.map((t) => (t.id === timestamped.id ? timestamped : t));
    tripsRef.current = nextTrips;
    setTrips(nextTrips);
    saveTripsToLocalStorage(nextTrips);
    saveTripsToIDB(nextTrips).catch(() => {});
    saveTripToFirestore(timestamped, true);
  };

  // Handlers for Reservations
  const handleSaveReservation = (newRes: Omit<Reservation, 'id'>) => {
    const resWithId: Reservation = {
      ...newRes,
      id: `res-${Date.now()}`
    };
    updateActiveTrip((trip) => ({
      ...trip,
      reservations: [...trip.reservations, resWithId]
    }));
  };

  // Handlers for Budget / Expenses
  const handleUpdateTotalBudget = (newBudget: number) => {
    updateActiveTrip((trip) => ({
      ...trip,
      totalBudget: newBudget
    }));
  };

  const handleUpdateExchangeRates = (rates: Record<string, number>) => {
    updateActiveTrip((trip) => ({
      ...trip,
      customExchangeRates: rates
    }));
  };

  const handleAddExpense = (newExpense: Omit<ExpenseItem, 'id'>) => {
    const expenseWithId: ExpenseItem = {
      ...newExpense,
      id: `exp-${Date.now()}`
    };
    updateActiveTrip((trip) => ({
      ...trip,
      expenses: [expenseWithId, ...trip.expenses]
    }));
  };

  const handleUpdateExpense = (updatedExpense: ExpenseItem) => {
    updateActiveTrip((trip) => ({
      ...trip,
      expenses: trip.expenses.map((e) => (e.id === updatedExpense.id ? updatedExpense : e))
    }));
  };

  const handleDeleteExpense = (id: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      expenses: trip.expenses.filter((e) => e.id !== id)
    }), true);
  };

  const handleUpdateMembers = (newMembers: string[]) => {
    updateActiveTrip((trip) => ({
      ...trip,
      members: newMembers
    }));
  };

  // Handlers for Checklist
  const handleUpdateChecklistHeader = (title: string, subtitle: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      checklistTitle: title,
      checklistSubtitle: subtitle
    }));
  };

  const handleAddCategory = (categoryName: string) => {
    updateActiveTrip((trip) => {
      const defaultCats = ['필수 서류', '전자기기', '금융/통신', '의류/세면', '상비약', '기타'];
      const current = trip.packingCategories !== undefined
        ? trip.packingCategories
        : defaultCats;
      if (current.includes(categoryName)) return trip;
      return {
        ...trip,
        packingCategories: [...current, categoryName]
      };
    });
  };

  const handleDeleteCategory = (categoryName: string) => {
    updateActiveTrip((trip) => {
      const defaultCats = ['필수 서류', '전자기기', '금융/통신', '의류/세면', '상비약', '기타'];
      const current = trip.packingCategories !== undefined
        ? trip.packingCategories
        : defaultCats;
      return {
        ...trip,
        packingCategories: current.filter((c) => c !== categoryName),
        packingList: trip.packingList.filter((p) => p.category !== categoryName)
      };
    });
  };

  const handleTogglePacked = (itemId: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      packingList: trip.packingList.map((p) =>
        p.id === itemId ? { ...p, isPacked: !p.isPacked } : p
      )
    }));
  };

  const handleAddPackingItem = (newItem: Omit<PackingItem, 'id'>) => {
    const itemWithId: PackingItem = {
      ...newItem,
      id: `pack-${Date.now()}`
    };
    updateActiveTrip((trip) => ({
      ...trip,
      packingList: [...trip.packingList, itemWithId]
    }));
  };

  const handleDeletePackingItem = (itemId: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      packingList: trip.packingList.filter((p) => p.id !== itemId)
    }));
  };

  // Handler for New Trip
  const handleSaveNewTrip = (newTrip: Trip) => {
    setTrips((prev) => [newTrip, ...prev]);

    const updatedOrder = [newTrip.id, ...tripOrderRef.current.filter((id) => id !== newTrip.id)];
    setTripOrder(updatedOrder);
    tripOrderRef.current = updatedOrder;

    handleSelectTrip(newTrip.id);
    saveTripToFirestore(newTrip, true);

    saveBrandSettingsToFirestore({
      title: brandTitle,
      subtitle: brandSubtitle,
      badge: brandBadge,
      tabOrder,
      adminPassword,
      tripOrder: updatedOrder,
      activeTripId: newTrip.id
    });
  };

  // Handler for Imported Trip
  const handleImportTrip = (importedTrip: Trip) => {
    setTrips((prev) => {
      const exists = prev.some((t) => t.id === importedTrip.id);
      const updated = exists
        ? prev.map((t) => (t.id === importedTrip.id ? importedTrip : t))
        : [importedTrip, ...prev];
      saveTripsToIDB(updated).catch(() => {});
      return updated;
    });

    const updatedOrder = [importedTrip.id, ...tripOrderRef.current.filter((id) => id !== importedTrip.id)];
    setTripOrder(updatedOrder);
    tripOrderRef.current = updatedOrder;

    handleSelectTrip(importedTrip.id);
    saveTripToFirestore(importedTrip, true);

    saveBrandSettingsToFirestore({
      title: brandTitle,
      subtitle: brandSubtitle,
      badge: brandBadge,
      tabOrder,
      adminPassword,
      tripOrder: updatedOrder,
      activeTripId: importedTrip.id
    });
  };

  // Handler for full backup file restore (trip-backup.json)
  const handleRestoreBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const result = parseTripBackup(content);

        // 1. Immediately cache in browser storage (IndexedDB + LocalStorage) to guarantee 100% data persistence
        await saveTripsToIDB(result.trips).catch((err) => {
          console.error('IDB save error during restore:', err);
        });
        saveTripsToLocalStorage(result.trips);

        // 2. Restore brand settings if included in backup
        if (result.brandSettings) {
          if (result.brandSettings.title) setBrandTitle(result.brandSettings.title);
          if (result.brandSettings.subtitle) setBrandSubtitle(result.brandSettings.subtitle);
          if (result.brandSettings.badge) setBrandBadge(result.brandSettings.badge);
          if (Array.isArray(result.brandSettings.tabOrder) && result.brandSettings.tabOrder.length > 0) {
            setTabOrder(result.brandSettings.tabOrder);
          }
          if (Array.isArray(result.brandSettings.tripOrder)) {
            setTripOrder(result.brandSettings.tripOrder);
            tripOrderRef.current = result.brandSettings.tripOrder;
          }
          if (result.brandSettings.adminPassword) {
            setAdminPassword(result.brandSettings.adminPassword);
          }
          saveBrandSettingsToFirestore(result.brandSettings);
        }

        // 3. Update React state immediately
        userExplicitlySelectedRef.current = true;
        setTrips(result.trips);
        const targetId = result.targetTripId || result.trips[0].id;
        setActiveTripId(targetId);
        try {
          localStorage.setItem(STORAGE_LAST_TRIP_KEY, targetId);
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.set('trip', targetId);
            window.history.replaceState({}, '', url.toString());
          }
        } catch {}

        // 4. Safely sync directly to Server & Firestore for instant cross-device synchronization
        await syncAllTripsToServer(result.trips);
        for (const trip of result.trips) {
          saveTripToFirestore(trip, true).catch(() => {});
        }

        const updatedOrder = [targetId, ...tripOrderRef.current.filter((id) => id !== targetId)];
        setTripOrder(updatedOrder);
        tripOrderRef.current = updatedOrder;
        await saveBrandSettingsToFirestore({
          title: brandTitle,
          subtitle: brandSubtitle,
          badge: brandBadge,
          tabOrder,
          adminPassword,
          tripOrder: updatedOrder,
          activeTripId: targetId
        }, true);

        // 5. Notify user
        setToastMessage(`${result.message} 모든 기기(스마트폰, 공유된 다른 사용자 기기)에 즉시 실시간 자동 동기화되었습니다!`);
        setTimeout(() => setToastMessage(null), 4500);
      } catch (err: any) {
        console.error('백업 복원 실패:', err);
        setErrorToast({
          message: err?.message || '백업 파일을 복원하는 중 오류가 발생했습니다.',
          timestamp: Date.now()
        });
      }
    };
    reader.readAsText(file);
  };

  if (!isSiteUnlocked) {
    return (
      <SiteLockScreen
        expectedPassword={adminPassword || '1205'}
        onUnlocked={() => setIsSiteUnlocked(true)}
        brandTitle={brandTitle}
        brandSubtitle={brandSubtitle}
      />
    );
  }

  if (trips.length === 0) {
    if (!loadTimedOut) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-4 space-y-4">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-slate-300">클라우드에서 여행 일정을 불러오는 중입니다...</p>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <WifiOff className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white mb-2">클라우드 연결 안내</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Firebase 클라우드 응답 대기 중이거나 일일 할당량 소진 상태입니다.<br />
              노트북에서 다운로드한 백업 파일(<span className="text-emerald-400 font-mono">trip-backup.json</span>)이 있으신 경우 바로 불러올 수 있습니다.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <input
              ref={restoreFileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleRestoreBackup(file);
              }}
            />
            <button
              onClick={() => restoreFileInputRef.current?.click()}
              className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl transition shadow-lg shadow-emerald-950 flex items-center justify-center space-x-2 text-sm cursor-pointer active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>백업 파일(JSON)로 즉시 일정 불러오기</span>
            </button>

            <button
              onClick={() => {
                setTrips([DEFAULT_STARTER_TRIP]);
                setActiveTripId(DEFAULT_STARTER_TRIP.id);
              }}
              className="w-full py-3 px-4 bg-slate-700/80 hover:bg-slate-600 text-slate-200 font-semibold rounded-2xl transition border border-slate-600/70 text-xs sm:text-sm cursor-pointer"
            >
              <span>새 여행으로 시작하기 (앱 화면 열기)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 sm:pb-16 w-full overflow-x-hidden flex flex-col">
      {/* Supabase 1-Click Setup Guidance Banner (shown when trips table is not yet created) */}
      <SupabaseSetupBanner />

      {/* Top Navigation */}
      <Navbar
        trips={trips}
        activeTrip={activeTrip}
        onSelectTrip={handleSelectTrip}
        onOpenNewTripModal={() => setIsNewTripModalOpen(true)}
        onOpenEditTripModal={handleRequestEditTrip}
        onDeleteTrip={handleRequestDeleteTrip}
        onDuplicateTrip={() => handleDuplicateTrip(activeTrip)}
        onOpenTripOrderModal={() => setIsTripOrderModalOpen(true)}
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        brandTitle={brandTitle}
        brandSubtitle={brandSubtitle}
        brandBadge={brandBadge}
        tabOrder={tabOrder}
        onOpenBrandModal={handleRequestAdminModal}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onRestoreBackup={handleRestoreBackup}
        onLockSite={() => setIsSiteUnlocked(false)}
        syncStatus={syncStatus}
        syncMessage={syncMessage}
        onManualSave={handleManualSave}
        isManualSaving={isManualSaving}
        isSaveSuccess={isSaveSuccess}
      />

      {/* Offline Status Alert Banner */}
      {isOffline && (
        <div className="bg-amber-500/15 border-b border-amber-300 text-amber-900 px-4 py-2 text-xs font-bold flex items-center justify-center space-x-2">
          <WifiOff className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>오프라인 모드: 인터넷 연결이 없어도 이전에 저장된 여행 일정 및 자료를 안전하게 조회할 수 있습니다.</span>
        </div>
      )}

      {/* Main Active Tab View Container */}
      <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 flex-1">
        {activeTab === 'itinerary' && (
          <ItineraryView
            trip={activeTrip}
            onToggleDone={handleToggleScheduleDone}
            onDeleteItem={handleDeleteScheduleItem}
            onEditItem={(item) => {
              setEditingScheduleItem(item);
              setEventModalDay(item.day);
              setEventModalInitialTime(undefined);
              setEventModalInitialEndTime(undefined);
              setEventModalInsertAfterId(undefined);
              setIsEventModalOpen(true);
            }}
            onOpenAddModal={(day, defaultTime, defaultEndTime, insertAfterId) => {
              setEditingScheduleItem(null);
              setEventModalDay(day);
              setEventModalInitialTime(defaultTime);
              setEventModalInitialEndTime(defaultEndTime);
              setEventModalInsertAfterId(insertAfterId);
              setIsEventModalOpen(true);
            }}
            onOpenEditTripModal={handleRequestEditTrip}
            onDeleteTrip={handleRequestDeleteTrip}
            onDuplicateTrip={() => handleDuplicateTrip(activeTrip)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
            onManualSave={handleManualSave}
            isManualSaving={isManualSaving}
            isSaveSuccess={isSaveSuccess}
            canUndo={activeTrip ? scheduleHistory.some((h) => h.tripId === activeTrip.id) : false}
            undoCount={activeTrip ? scheduleHistory.filter((h) => h.tripId === activeTrip.id).length : 0}
            onUndo={handleUndoSchedule}
          />
        )}

        {activeTab === 'map' && <MapView trip={activeTrip} />}

        {activeTab === 'reservations' && (
          <ReservationsView
            trip={activeTrip}
            onOpenAddModal={() => setIsReservationModalOpen(true)}
          />
        )}

        {activeTab === 'budget' && (
          <BudgetView
            trip={activeTrip}
            onAddExpense={handleAddExpense}
            onUpdateExpense={handleUpdateExpense}
            onDeleteExpense={handleDeleteExpense}
            onUpdateTotalBudget={handleUpdateTotalBudget}
            onUpdateExchangeRates={handleUpdateExchangeRates}
            onUpdateMembers={handleUpdateMembers}
            onAddCustomCurrency={handleAddCustomCurrency}
          />
        )}

        {activeTab.startsWith('checklist') && (
          <ChecklistView
            trip={activeTrip}
            activeChecklistTabId={activeTab.includes(':') ? activeTab.split(':')[1] : undefined}
            onSelectChecklistTab={(id) => setActiveTab(`checklist:${id}`)}
            onUpdateTrip={(updated) => updateActiveTrip(() => updated)}
          />
        )}

        {activeTab.startsWith('souvenirs') && (
          <SouvenirView
            trip={activeTrip}
            activeSouvenirTabId={activeTab.includes(':') ? activeTab.split(':')[1] : undefined}
            onSelectSouvenirTab={(id) => setActiveTab(`souvenirs:${id}`)}
            onUpdateTrip={(updated) => updateActiveTrip(() => updated)}
            onManualSave={handleManualSave}
            isManualSaving={isManualSaving}
            isSaveSuccess={isSaveSuccess}
          />
        )}
      </main>

      {/* Modals */}
      {isEventModalOpen && (
        <EventModal
          day={eventModalDay}
          editingItem={editingScheduleItem}
          initialTime={eventModalInitialTime}
          initialEndTime={eventModalInitialEndTime}
          insertAfterId={eventModalInsertAfterId}
          tripDestination={activeTrip?.destination || ''}
          totalDays={activeTrip ? getTotalTripDays(activeTrip) : 10}
          startDate={activeTrip?.startDate || ''}
          onClose={() => {
            setIsEventModalOpen(false);
            setEditingScheduleItem(null);
            setEventModalInitialTime(undefined);
            setEventModalInitialEndTime(undefined);
            setEventModalInsertAfterId(undefined);
          }}
          onSave={handleSaveScheduleItem}
        />
      )}

      {isReservationModalOpen && (
        <ReservationModal
          onClose={() => setIsReservationModalOpen(false)}
          onSave={handleSaveReservation}
        />
      )}

      {isNewTripModalOpen && (
        <NewTripModal
          onClose={() => setIsNewTripModalOpen(false)}
          onSave={handleSaveNewTrip}
        />
      )}

      {isEditTripModalOpen && (
        <EditTripModal
          trip={activeTrip}
          onClose={() => setIsEditTripModalOpen(false)}
          onSave={handleSaveTrip}
          onDeleteTrip={handleRequestDeleteTrip}
          onDuplicateTrip={handleDuplicateTrip}
        />
      )}

      {isBrandModalOpen && (
        <BrandEditModal
          currentTitle={brandTitle}
          currentSubtitle={brandSubtitle}
          currentBadge={brandBadge}
          currentTabOrder={tabOrder}
          currentPassword={adminPassword}
          trips={trips}
          onClose={() => setIsBrandModalOpen(false)}
          onSave={handleSaveBrand}
          onReset={handleResetBrand}
          onSavePassword={handleSavePassword}
          onSaveTripOrder={handleSaveTripOrder}
        />
      )}

      {isTripOrderModalOpen && (
        <TripOrderModal
          trips={trips}
          onClose={() => setIsTripOrderModalOpen(false)}
          onSaveTripOrder={handleSaveTripOrder}
        />
      )}

      {isExportModalOpen && (
        <ExportModal
          trip={activeTrip}
          allTrips={trips}
          brandSettings={{
            title: brandTitle,
            subtitle: brandSubtitle,
            badge: brandBadge,
            tabOrder,
            adminPassword,
            tripOrder
          }}
          onClose={() => setIsExportModalOpen(false)}
          onImportTrip={handleImportTrip}
        />
      )}

      {/* Password Security Verification Modal */}
      <PasswordPromptModal
        isOpen={passwordModalConfig.isOpen}
        title={passwordModalConfig.title}
        description={passwordModalConfig.description}
        correctPassword={adminPassword}
        onSuccess={passwordModalConfig.onSuccess}
        onClose={() =>
          setPasswordModalConfig((prev) => ({ ...prev, isOpen: false }))
        }
      />

      {/* Floating Toast Notification (Success with Undo action) */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2.5 px-4 sm:px-5 py-3 bg-slate-900 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-2xl border border-slate-700/80 animate-fade-in max-w-[92vw]">
          <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span className="truncate">{toastMessage}</span>
          {activeTrip && scheduleHistory.some((h) => h.tripId === activeTrip.id) && (
            <button
              onClick={handleUndoSchedule}
              className="ml-2 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 text-xs font-black rounded-lg transition shrink-0 flex items-center space-x-1 cursor-pointer shadow-xs"
              title="직전 작업 취소 (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>되돌리기</span>
            </button>
          )}
        </div>
      )}

      {/* Top-Right Red Error Toast Notification (3s auto-dismiss) */}
      {errorToast && (
        <div className="fixed top-5 right-5 z-[100] max-w-sm sm:max-w-md bg-rose-600 text-white px-4 py-3.5 rounded-2xl shadow-2xl border border-rose-400 flex items-start space-x-3 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="p-1.5 bg-white/20 rounded-xl shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm text-white">클라우드 동기화 알림</div>
            <div className="text-xs text-rose-100 mt-0.5 leading-relaxed break-words font-medium">{errorToast.message}</div>
          </div>
          <button
            onClick={() => setErrorToast(null)}
            className="p-1 hover:bg-white/20 rounded-lg transition shrink-0 text-white/80 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}