export type CategoryType = 'FLIGHT' | 'ACCOMMODATION' | 'FOOD' | 'SIGHTSEEING' | 'SHOPPING' | 'TRANSPORT' | 'OTHER';

export type TabType = 'itinerary' | 'map' | 'reservations' | 'budget' | 'checklist' | 'souvenirs' | (string & {});

export interface ScheduleItem {
  id: string;
  day: number; // Day 1, 2, etc.
  time: string; // 시작 시간, e.g., "09:00"
  endTime?: string; // 끝나는 시간 (선택), e.g., "11:30"
  title: string;
  category: CategoryType;
  location: string;
  lat?: number;
  lng?: number;
  cost: number;
  currency: string;
  notes?: string;
  isDone?: boolean;
  bookingRef?: string;
}

export interface Reservation {
  id: string;
  title: string;
  category: 'FLIGHT' | 'HOTEL' | 'ACTIVITY' | 'TRANSPORT' | 'OTHER';
  confirmationNo: string;
  provider: string;
  date: string;
  time?: string;
  details: string;
  price?: number;
  currency?: string;
  qrCodeUrl?: string;
  fileUrl?: string;
  fileName?: string;
}

export interface ExpenseItem {
  id: string;
  date: string;
  title: string;
  category: CategoryType;
  amount: number;
  currency: string;
  paidBy: string;
  paymentMethod: 'CARD' | 'CASH';
  splitWith?: string[];
  notes?: string;
  scheduleItemId?: string;
}

export interface PackingItem {
  id: string;
  category: string;
  title: string;
  isPacked: boolean;
  isEssential: boolean;
}

export interface ChecklistTabConfig {
  id: string;
  title: string;
  subtitle?: string;
  items: PackingItem[];
  categories?: string[];
}

export interface SouvenirItem {
  id: string;
  tag: string; // 말머리 (기본값: '기념품', '사 먹을 것', 또는 사용자 추가 말머리)
  title: string;
  targetPerson?: string; // 선물 대상 / 받는 사람
  location?: string; // 구매처 / 매장 위치
  notes?: string;
  estimatedPrice?: number;
  currency?: string;
  imageUrl?: string; // 첫 번째 사진 (하위 호환)
  images?: string[]; // 최대 2장 사진 목록
  isPurchased: boolean;
  createdAt?: string;
}

export interface SouvenirTabConfig {
  id: string;
  title: string;
  items: SouvenirItem[];
  tags?: string[];
  tagColors?: Record<string, string>; // tag name -> color identifier (e.g., 'pink', 'emerald')
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverImage: string;
  totalBudget: number;
  currency: string;
  schedule: ScheduleItem[];
  reservations: Reservation[];
  expenses: ExpenseItem[];
  packingList: PackingItem[];
  checklistTitle?: string;
  checklistSubtitle?: string;
  packingCategories?: string[];
  souvenirs?: SouvenirItem[];
  souvenirTags?: string[];
  souvenirTagColors?: Record<string, string>;
  checklistTabs?: ChecklistTabConfig[];
  souvenirTabs?: SouvenirTabConfig[];
  customExchangeRates?: Record<string, number>;
  members?: string[];
  updatedAt?: number;
}
