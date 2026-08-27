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
import { CheckCircle2, WifiOff } from 'lucide-react';
import { calculateEventDate } from './utils/currencyUtils';
import {
  subscribeToTrips,
  saveTripToFirestore,
  deleteTripFromFirestore,
  subscribeToBrandSettings,
  saveBrandSettingsToFirestore,
  getStoredTrips,
  getStoredBrandSettings,
  saveTripsToLocalStorage
} from './lib/tripService';
import { getAllLocalPhotos, savePhotoToCloud } from './utils/photoStore';
import { resolveTripPhotos } from './utils/imageUtils';
import { getTripsFromIDB } from './utils/tripIndexedDB';

const STORAGE_LAST_TRIP_KEY = 'jplanner_last_active_trip_id';

const getUrlTripId = (): string | null => {
  try {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('trip') || null;
    }
  } catch {}
  return null;
};

const resolveBestTripId = (
  tripList: Trip[],
  currentActiveId?: string,
  orderList?: string[]
): string => {
  if (!tripList || tripList.length === 0) return 'tokyo-2026';

  // 1. URL parameter has top priority
  const urlTrip = getUrlTripId();
  if (urlTrip && tripList.some((t) => t.id === urlTrip)) {
    return urlTrip;
  }

  // 2. Current active state if valid
  if (currentActiveId && tripList.some((t) => t.id === currentActiveId)) {
    return currentActiveId;
  }

  // 3. Stored localStorage ID if valid
  try {
    const stored = localStorage.getItem(STORAGE_LAST_TRIP_KEY);
    if (stored && tripList.some((t) => t.id === stored)) {
      return stored;
    }
  } catch {}

  // 4. Trip ordered by brand settings if available
  if (orderList && orderList.length > 0) {
    const firstOrdered = tripList.find((t) => t.id === orderList[0]);
    if (firstOrdered) return firstOrdered.id;
  }

  // 5. Most recently updated trip (highest updatedAt)
  const sortedByRecent = [...tripList].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return sortedByRecent[0].id;
};

const sortTripsWithOrder = (tripsToSort: Trip[], order?: string[]): Trip[] => {
  if (!order || order.length === 0) return tripsToSort;
  const orderMap = new Map(order.map((id, index) => [id, index]));
  return [...tripsToSort].sort((a, b) => {
    const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
    const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
    return idxA - idxB;
  });
};

export default function App() {
  const [trips, setTrips] = useState<Trip[]>(() => getStoredTrips());
  const [activeTripId, setActiveTripId] = useState<string>(() => {
    const urlId = getUrlTripId();
    if (urlId) return urlId;
    try {
      const saved = localStorage.getItem(STORAGE_LAST_TRIP_KEY);
      if (saved) return saved;
    } catch (e) {}
    const initialList = getStoredTrips();
    return resolveBestTripId(initialList);
  });
  const [activeTab, setActiveTab] = useState<TabType>('itinerary');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(() => !navigator.onLine);

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
  const initialBrand = getStoredBrandSettings();
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

  // Site Access Password Lock State (requires password on site entry)
  const [isSiteUnlocked, setIsSiteUnlocked] = useState<boolean>(false);

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
  const [isReservationModalOpen, setIsReservationModalOpen] = useState(false);
  const [isNewTripModalOpen, setIsNewTripModalOpen] = useState(false);
  const [isEditTripModalOpen, setIsEditTripModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isTripOrderModalOpen, setIsTripOrderModalOpen] = useState(false);

  // Helper to switch active trip, sync URL and save to localStorage
  const handleSelectTrip = (tripId: string) => {
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
          const resolved = resolveBestTripId(sorted, prevId, tripOrderRef.current);
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
      if (settings.tripOrder && Array.isArray(settings.tripOrder)) {
        setTripOrder(settings.tripOrder);
        tripOrderRef.current = settings.tripOrder;
        setTrips((prev) => sortTripsWithOrder(prev, settings.tripOrder));
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

  // Helper to update active trip locally & persist to Firestore
  const updateActiveTrip = (updater: (trip: Trip) => Trip) => {
    setTrips((prevTrips) => {
      const current = prevTrips.find((t) => t.id === activeTripId) || prevTrips[0];
      if (!current) return prevTrips;
      const updatedTrip = { ...updater(current), updatedAt: Date.now() };
      saveTripToFirestore(updatedTrip);
      return prevTrips.map((t) => (t.id === current.id ? updatedTrip : t));
    });
  };

  // Brand Header & Tab Order Handlers
  const handleSaveBrand = (
    title: string,
    subtitle: string,
    badge: string,
    newTabOrder?: TabType[]
  ) => {
    setBrandTitle(title);
    setBrandSubtitle(subtitle);
    setBrandBadge(badge);
    const orderToSave = newTabOrder || tabOrder;
    if (newTabOrder) {
      setTabOrder(newTabOrder);
    }
    saveBrandSettingsToFirestore({
      title,
      subtitle,
      badge,
      tabOrder: orderToSave,
      adminPassword,
      tripOrder
    });
  };

  const handleSavePassword = (newPw: string) => {
    setAdminPassword(newPw);
    saveBrandSettingsToFirestore({
      title: brandTitle,
      subtitle: brandSubtitle,
      badge: brandBadge,
      tabOrder,
      adminPassword: newPw,
      tripOrder
    });
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
    saveBrandSettingsToFirestore(defaults);
  };

  // Trip Order Reordering Handler
  const handleSaveTripOrder = (newOrderedTrips: Trip[]) => {
    const newOrderIds = newOrderedTrips.map((t) => t.id);
    setTrips(newOrderedTrips);
    setTripOrder(newOrderIds);
    tripOrderRef.current = newOrderIds;

    saveBrandSettingsToFirestore({
      title: brandTitle,
      subtitle: brandSubtitle,
      badge: brandBadge,
      tabOrder,
      adminPassword,
      tripOrder: newOrderIds
    });

    setToastMessage('여행 순서가 저장되었습니다');
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Handlers for Itinerary
  const handleToggleScheduleDone = (itemId: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      schedule: trip.schedule.map((s) =>
        s.id === itemId ? { ...s, isDone: !s.isDone } : s
      )
    }));
  };

  const handleDeleteScheduleItem = (itemId: string) => {
    updateActiveTrip((trip) => ({
      ...trip,
      schedule: trip.schedule.filter((s) => s.id !== itemId),
      expenses: (trip.expenses || []).filter(
        (e) => e.scheduleItemId !== itemId && e.id !== `exp-sched-${itemId}`
      )
    }));
  };

  const handleSaveScheduleItem = (savedItem: ScheduleItem) => {
    updateActiveTrip((trip) => {
      const exists = trip.schedule.some((s) => s.id === savedItem.id);
      let newSchedule: ScheduleItem[];
      if (exists) {
        newSchedule = trip.schedule.map((s) => (s.id === savedItem.id ? savedItem : s));
      } else {
        newSchedule = [...trip.schedule, savedItem];
      }

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
    });
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
      if (activeTripId === tripIdToDelete) {
        handleSelectTrip(remainingTrips[0].id);
      }
    }

    if (tripOrder.length > 0) {
      const updatedOrder = tripOrder.filter((id) => id !== tripIdToDelete);
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

    // Show delete complete message
    setToastMessage('여행이 삭제되었습니다');
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  const handleSaveTrip = (updatedTrip: Trip) => {
    setTrips((prev) => prev.map((t) => (t.id === updatedTrip.id ? updatedTrip : t)));
    saveTripToFirestore(updatedTrip);
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
    }));
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
    handleSelectTrip(newTrip.id);
    saveTripToFirestore(newTrip);

    if (tripOrder.length > 0) {
      const updatedOrder = [newTrip.id, ...tripOrder];
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
  };

  // Handler for Imported Trip
  const handleImportTrip = (importedTrip: Trip) => {
    setTrips((prev) => {
      const exists = prev.some((t) => t.id === importedTrip.id);
      if (exists) {
        return prev.map((t) => (t.id === importedTrip.id ? importedTrip : t));
      }
      return [importedTrip, ...prev];
    });
    handleSelectTrip(importedTrip.id);
    saveTripToFirestore(importedTrip);
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 sm:pb-16 w-full overflow-x-hidden flex flex-col">
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
        onLockSite={() => setIsSiteUnlocked(false)}
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
              setIsEventModalOpen(true);
            }}
            onOpenAddModal={(day) => {
              setEditingScheduleItem(null);
              setEventModalDay(day);
              setIsEventModalOpen(true);
            }}
            onOpenEditTripModal={handleRequestEditTrip}
            onDeleteTrip={handleRequestDeleteTrip}
            onDuplicateTrip={() => handleDuplicateTrip(activeTrip)}
            onOpenExportModal={() => setIsExportModalOpen(true)}
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
          />
        )}
      </main>

      {/* Modals */}
      {isEventModalOpen && (
        <EventModal
          day={eventModalDay}
          editingItem={editingScheduleItem}
          tripDestination={activeTrip?.destination || ''}
          onClose={() => {
            setIsEventModalOpen(false);
            setEditingScheduleItem(null);
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

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center space-x-2.5 px-5 py-3 bg-slate-900 text-white text-xs sm:text-sm font-bold rounded-2xl shadow-2xl border border-slate-700/80 animate-fade-in pointer-events-none">
          <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
