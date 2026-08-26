import { Trip, ChecklistTabConfig, SouvenirTabConfig, SouvenirItem, PackingItem } from '../types';

export const DEFAULT_PACKING_CATEGORIES = ['필수 서류', '전자기기', '금융/통신', '의류/세면', '상비약', '기타'];
export const DEFAULT_SOUVENIR_TAGS = ['기념품', '사 먹을 것', '의류/패션', '화장품/뷰티', '캐릭터/굿즈', '주류/음료', '기타'];

export interface TagColorOption {
  id: string;
  name: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
  ringClass: string;
  bgLight: string;
}

export const TAG_COLOR_PALETTE: TagColorOption[] = [
  { id: 'pink', name: '핑크', badgeClass: 'bg-pink-100 text-pink-700 border-pink-200', dotClass: 'bg-pink-500', borderClass: 'border-pink-500', ringClass: 'ring-pink-400', bgLight: 'bg-pink-50 text-pink-700' },
  { id: 'rose', name: '로즈', badgeClass: 'bg-rose-100 text-rose-700 border-rose-200', dotClass: 'bg-rose-500', borderClass: 'border-rose-500', ringClass: 'ring-rose-400', bgLight: 'bg-rose-50 text-rose-700' },
  { id: 'orange', name: '오렌지', badgeClass: 'bg-orange-100 text-orange-700 border-orange-200', dotClass: 'bg-orange-500', borderClass: 'border-orange-500', ringClass: 'ring-orange-400', bgLight: 'bg-orange-50 text-orange-700' },
  { id: 'amber', name: '옐로우', badgeClass: 'bg-amber-100 text-amber-800 border-amber-200', dotClass: 'bg-amber-500', borderClass: 'border-amber-500', ringClass: 'ring-amber-400', bgLight: 'bg-amber-50 text-amber-800' },
  { id: 'emerald', name: '에메랄드', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200', dotClass: 'bg-emerald-500', borderClass: 'border-emerald-500', ringClass: 'ring-emerald-400', bgLight: 'bg-emerald-50 text-emerald-700' },
  { id: 'teal', name: '민트', badgeClass: 'bg-teal-100 text-teal-700 border-teal-200', dotClass: 'bg-teal-500', borderClass: 'border-teal-500', ringClass: 'ring-teal-400', bgLight: 'bg-teal-50 text-teal-700' },
  { id: 'sky', name: '스카이블루', badgeClass: 'bg-sky-100 text-sky-700 border-sky-200', dotClass: 'bg-sky-500', borderClass: 'border-sky-500', ringClass: 'ring-sky-400', bgLight: 'bg-sky-50 text-sky-700' },
  { id: 'blue', name: '블루', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200', dotClass: 'bg-blue-500', borderClass: 'border-blue-500', ringClass: 'ring-blue-400', bgLight: 'bg-blue-50 text-blue-700' },
  { id: 'indigo', name: '인디고', badgeClass: 'bg-indigo-100 text-indigo-700 border-indigo-200', dotClass: 'bg-indigo-500', borderClass: 'border-indigo-500', ringClass: 'ring-indigo-400', bgLight: 'bg-indigo-50 text-indigo-700' },
  { id: 'purple', name: '퍼플', badgeClass: 'bg-purple-100 text-purple-700 border-purple-200', dotClass: 'bg-purple-500', borderClass: 'border-purple-500', ringClass: 'ring-purple-400', bgLight: 'bg-purple-50 text-purple-700' },
  { id: 'violet', name: '바이올렛', badgeClass: 'bg-violet-100 text-violet-700 border-violet-200', dotClass: 'bg-violet-500', borderClass: 'border-violet-500', ringClass: 'ring-violet-400', bgLight: 'bg-violet-50 text-violet-700' },
  { id: 'slate', name: '그레이', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200', dotClass: 'bg-slate-500', borderClass: 'border-slate-500', ringClass: 'ring-slate-400', bgLight: 'bg-slate-50 text-slate-700' },
];

export const DEFAULT_TAG_COLORS: Record<string, string> = {
  '기념품': 'pink',
  '사 먹을 것': 'emerald',
  '의류/패션': 'purple',
  '화장품/뷰티': 'rose',
  '캐릭터/굿즈': 'amber',
  '주류/음료': 'indigo',
  '기타': 'slate'
};

export function getTagColorInfo(tag: string, customTagColors?: Record<string, string>): TagColorOption {
  const colorId = customTagColors?.[tag] || DEFAULT_TAG_COLORS[tag] || 'slate';
  const found = TAG_COLOR_PALETTE.find((c) => c.id === colorId);
  return found || TAG_COLOR_PALETTE[TAG_COLOR_PALETTE.length - 1];
}

/**
 * Get all checklist tabs for a trip, combining legacy packingList items with tabs to ensure 0 data loss
 */
export function getTripChecklistTabs(trip: Trip): ChecklistTabConfig[] {
  let baseTabs: ChecklistTabConfig[] = [];
  if (trip.checklistTabs && Array.isArray(trip.checklistTabs) && trip.checklistTabs.length > 0) {
    baseTabs = JSON.parse(JSON.stringify(trip.checklistTabs));
  } else {
    baseTabs = [
      {
        id: 'default-checklist',
        title: trip.checklistTitle || '체크리스트',
        subtitle: trip.checklistSubtitle || '빠트린 물품이 없는지 출발 전 최종 점검하세요!',
        items: trip.packingList || [],
        categories: trip.packingCategories || DEFAULT_PACKING_CATEGORIES
      }
    ];
  }

  // If legacy packingList contains items not in baseTabs, merge them safely
  if (trip.packingList && Array.isArray(trip.packingList) && trip.packingList.length > 0) {
    const existingIds = new Set<string>();
    for (const tab of baseTabs) {
      for (const item of tab.items || []) {
        if (item?.id) existingIds.add(item.id);
      }
    }
    const missingLegacy = trip.packingList.filter((item) => item?.id && !existingIds.has(item.id));
    if (missingLegacy.length > 0 && baseTabs[0]) {
      baseTabs[0].items = [...baseTabs[0].items, ...missingLegacy];
    }
  }

  return baseTabs;
}

/**
 * Get all souvenir tabs for a trip, uniting legacy souvenirs array with tabs to ensure 0 data loss
 */
export function getTripSouvenirTabs(trip: Trip): SouvenirTabConfig[] {
  let baseTabs: SouvenirTabConfig[] = [];
  if (trip.souvenirTabs && Array.isArray(trip.souvenirTabs) && trip.souvenirTabs.length > 0) {
    baseTabs = JSON.parse(JSON.stringify(trip.souvenirTabs));
  } else {
    baseTabs = [
      {
        id: 'default-souvenirs',
        title: '기념품',
        items: trip.souvenirs || [],
        tags: trip.souvenirTags || DEFAULT_SOUVENIR_TAGS,
        tagColors: trip.souvenirTagColors || { ...DEFAULT_TAG_COLORS }
      }
    ];
  }

  // If legacy souvenirs array contains items not in baseTabs, merge them safely
  if (trip.souvenirs && Array.isArray(trip.souvenirs) && trip.souvenirs.length > 0) {
    const existingIds = new Set<string>();
    for (const tab of baseTabs) {
      for (const item of tab.items || []) {
        if (item?.id) existingIds.add(item.id);
      }
    }
    const missingLegacy = trip.souvenirs.filter((item) => item?.id && !existingIds.has(item.id));
    if (missingLegacy.length > 0 && baseTabs[0]) {
      baseTabs[0].items = [...baseTabs[0].items, ...missingLegacy];
    }
  }

  return baseTabs;
}

/**
 * Smart Union of two lists of SouvenirItems by ID
 */
export function unionSouvenirItems(listA: SouvenirItem[] = [], listB: SouvenirItem[] = []): SouvenirItem[] {
  const map = new Map<string, SouvenirItem>();
  // listA has precedence for newer values
  for (const item of listA) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of listB) {
    if (item && item.id && !map.has(item.id)) {
      map.set(item.id, item);
    }
  }
  return Array.from(map.values());
}
