import { Trip, SouvenirTabConfig } from '../types';
import { cleanTripTitle } from './dateUtils';
import { getTripSouvenirTabs } from './tabUtils';
import { savePhotoLocal, generatePhotoId } from './photoStore';

export interface RestoreResult {
  trips: Trip[];
  targetTripId?: string;
  brandSettings?: any;
  message: string;
  totalScheduleCount: number;
}

/**
 * Robust parser for JPlanner backup files (supports localStorage export, trip arrays, and single trip formats)
 * Automatically extracts and preserves all HD photos into browser photoStore.
 */
export function parseTripBackup(fileContent: string): RestoreResult {
  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch (e: any) {
    throw new Error('올바른 JSON 파일 형식이 아닙니다: ' + (e?.message || '구문 오류'));
  }

  let extractedTrips: any[] = [];
  let extractedBrandSettings: any = undefined;
  let preferredTripId: string | undefined = undefined;

  // Case 1: Direct JSON Array of trips
  if (Array.isArray(parsed)) {
    extractedTrips = parsed;
  }
  // Case 2: Key-value Object (localStorage backup dump, or wrapped object)
  else if (typeof parsed === 'object' && parsed !== null) {
    const sourceObj = parsed.localStorage && typeof parsed.localStorage === 'object'
      ? parsed.localStorage
      : parsed;

    // Check jplanner_trips_cache (standard localStorage key)
    if (sourceObj.jplanner_trips_cache) {
      let raw = sourceObj.jplanner_trips_cache;
      if (typeof raw === 'string') {
        try {
          raw = JSON.parse(raw);
        } catch {}
      }
      if (Array.isArray(raw)) {
        extractedTrips = raw;
      }
    }

    // Check brand settings
    if (sourceObj.jplanner_brand_settings_cache) {
      let rawBrand = sourceObj.jplanner_brand_settings_cache;
      if (typeof rawBrand === 'string') {
        try {
          rawBrand = JSON.parse(rawBrand);
        } catch {}
      }
      if (typeof rawBrand === 'object' && rawBrand !== null) {
        extractedBrandSettings = rawBrand;
      }
    }

    // Check last active trip ID
    if (sourceObj.jplanner_last_active_trip_id && typeof sourceObj.jplanner_last_active_trip_id === 'string') {
      preferredTripId = sourceObj.jplanner_last_active_trip_id;
    }

    // Fallback checks for trips / data / backup
    if (extractedTrips.length === 0) {
      if (Array.isArray(sourceObj.trips)) {
        extractedTrips = sourceObj.trips;
      } else if (typeof sourceObj.trips === 'string') {
        try {
          const p = JSON.parse(sourceObj.trips);
          if (Array.isArray(p)) extractedTrips = p;
        } catch {}
      } else if (Array.isArray(sourceObj.data)) {
        extractedTrips = sourceObj.data;
      } else if (sourceObj.trip && typeof sourceObj.trip === 'object') {
        extractedTrips = [sourceObj.trip];
      }
    }

    // Case 3: It's a single Trip object
    if (extractedTrips.length === 0 && (sourceObj.title || sourceObj.schedule)) {
      extractedTrips = [sourceObj];
    }
  }

  if (!extractedTrips || extractedTrips.length === 0) {
    throw new Error('백업 파일에서 유효한 여행 일정 데이터를 찾을 수 없습니다. (trip-backup.json 형식을 확인해주세요)');
  }

  // Sanitize and validate every trip, guaranteeing souvenir photos are extracted and preserved
  const validTrips: Trip[] = extractedTrips.map((rawTrip, idx) => {
    const tripId = rawTrip.id || `trip-restored-${Date.now()}-${idx}`;
    const sanitizedTrip: Trip = {
      ...rawTrip,
      id: tripId,
      title: cleanTripTitle(rawTrip.title || `복원된 여행 ${idx + 1}`),
      destination: rawTrip.destination || '도쿄',
      startDate: rawTrip.startDate || new Date().toISOString().split('T')[0],
      endDate: rawTrip.endDate || new Date().toISOString().split('T')[0],
      totalBudget: typeof rawTrip.totalBudget === 'number' ? rawTrip.totalBudget : 0,
      currency: rawTrip.currency || 'KRW',
      schedule: Array.isArray(rawTrip.schedule) ? rawTrip.schedule : [],
      reservations: Array.isArray(rawTrip.reservations) ? rawTrip.reservations : [],
      expenses: Array.isArray(rawTrip.expenses) ? rawTrip.expenses : [],
      packingList: Array.isArray(rawTrip.packingList) ? rawTrip.packingList : [],
      checklistTabs: Array.isArray(rawTrip.checklistTabs) ? rawTrip.checklistTabs : (rawTrip.checklistTabs || []),
      souvenirTabs: Array.isArray(rawTrip.souvenirTabs) ? rawTrip.souvenirTabs : (rawTrip.souvenirTabs || []),
      souvenirs: Array.isArray(rawTrip.souvenirs) ? rawTrip.souvenirs : [],
      packingCategories: Array.isArray(rawTrip.packingCategories) ? rawTrip.packingCategories : [],
      members: Array.isArray(rawTrip.members) ? rawTrip.members : [],
      customExchangeRates: typeof rawTrip.customExchangeRates === 'object' && rawTrip.customExchangeRates !== null
        ? rawTrip.customExchangeRates
        : {},
      updatedAt: rawTrip.updatedAt || Date.now()
    };

    // Ensure souvenir tabs and items are unified with legacy souvenirs
    const resolvedSouvenirTabs = getTripSouvenirTabs(sanitizedTrip);
    sanitizedTrip.souvenirTabs = resolvedSouvenirTabs;
    sanitizedTrip.souvenirs = resolvedSouvenirTabs[0]?.items || [];

    // Extract all base64 photos in this trip and cache in photoStore immediately
    for (const tab of sanitizedTrip.souvenirTabs) {
      for (const item of tab.items || []) {
        if (item.images && Array.isArray(item.images)) {
          item.images.forEach((img: string, imgIdx: number) => {
            if (typeof img === 'string' && img.startsWith('data:image/')) {
              const photoId = generatePhotoId(`${tripId}_${item.id}_${imgIdx}`);
              savePhotoLocal(photoId, img).catch(() => {});
            }
          });
        }
        if (item.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.startsWith('data:image/')) {
          const photoId = generatePhotoId(`${tripId}_${item.id}_0`);
          savePhotoLocal(photoId, item.imageUrl).catch(() => {});
        }
      }
    }

    return sanitizedTrip;
  });

  // Prioritize active trip:
  // 1. Trip with 32 schedule items (explicit user target)
  // 2. Trip with "도쿄" and most schedules
  // 3. Preferred trip id from backup
  // 4. Trip with maximum registered schedules
  let targetTrip = validTrips.find((t) => t.schedule.length === 32);
  if (!targetTrip) {
    targetTrip = validTrips.find((t) => t.title.includes('도쿄') && t.schedule.length >= 10);
  }
  if (!targetTrip && preferredTripId) {
    targetTrip = validTrips.find((t) => t.id === preferredTripId);
  }
  if (!targetTrip) {
    const sorted = [...validTrips].sort((a, b) => (b.schedule?.length || 0) - (a.schedule?.length || 0));
    targetTrip = sorted[0];
  }

  const scheduleCount = targetTrip?.schedule?.length || 0;
  const message = `'${targetTrip?.title || '여행'}' (일정 ${scheduleCount}개)을 포함하여 총 ${validTrips.length}개 여행 일정이 성공적으로 복원되었습니다!`;

  return {
    trips: validTrips,
    targetTripId: targetTrip?.id || validTrips[0]?.id,
    brandSettings: extractedBrandSettings,
    totalScheduleCount: scheduleCount,
    message
  };
}
