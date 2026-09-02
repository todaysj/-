/**
 * Date and Day calculation utilities for J-Planner
 * Ensures 100% accurate, timezone-safe date synchronization across Itinerary, Map, and Modals.
 */

const KOREAN_DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * Safely parse YYYY-MM-DD into a local Date object without UTC timezone skew
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Format a Date object to YYYY-MM-DD
 */
export function formatDateToISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculate the exact number of days between startDate and endDate (inclusive)
 */
export function calculateTripDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 1;
  const start = parseLocalDate(startDateStr);
  const end = parseLocalDate(endDateStr);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, isNaN(diffDays) ? 1 : diffDays);
}

/**
 * Calculate the total days for a trip based on startDate and endDate.
 */
export function getTotalTripDays(trip: {
  startDate: string;
  endDate: string;
  schedule?: Array<{ day: number }>;
}): number {
  return calculateTripDays(trip.startDate, trip.endDate);
}

/**
 * Get the Date object for a specific dayNum (1-indexed) based on startDate
 */
export function getDayDate(startDateStr: string, dayNum: number): Date {
  const base = parseLocalDate(startDateStr);
  base.setDate(base.getDate() + (dayNum - 1));
  return base;
}

/**
 * Format date for tab buttons: "8/30 (토)"
 */
export function formatDayDateShort(startDateStr: string, dayNum: number): string {
  if (!startDateStr) return '';
  const d = getDayDate(startDateStr, dayNum);
  return `${d.getMonth() + 1}/${d.getDate()} (${KOREAN_DAY_NAMES[d.getDay()]})`;
}

/**
 * Format date day only: "30일 (토)"
 */
export function formatDayDateDayOnly(startDateStr: string, dayNum: number): string {
  if (!startDateStr) return '';
  const d = getDayDate(startDateStr, dayNum);
  return `${d.getDate()}일 (${KOREAN_DAY_NAMES[d.getDay()]})`;
}

/**
 * Format full date with year: "2026.08.30 (토)"
 */
export function formatDayDateFull(startDateStr: string, dayNum: number): string {
  if (!startDateStr) return '';
  const d = getDayDate(startDateStr, dayNum);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${day} (${KOREAN_DAY_NAMES[d.getDay()]})`;
}

/**
 * Format Korean natural date: "8월 30일 (토)"
 */
export function formatDayDateKorean(startDateStr: string, dayNum: number): string {
  if (!startDateStr) return '';
  const d = getDayDate(startDateStr, dayNum);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${KOREAN_DAY_NAMES[d.getDay()]})`;
}

/**
 * Format trip duration: "3박 4일" or "당일치기"
 */
export function formatTripNightsAndDays(startDateStr: string, endDateStr: string): string {
  const days = calculateTripDays(startDateStr, endDateStr);
  if (days <= 1) return '당일치기 (1일)';
  const nights = days - 1;
  return `${nights}박 ${days}일`;
}

/**
 * Remove any trailing schedule count suffixes like (10개 일정), (10개), (일정 10개) from trip titles
 */
export function cleanTripTitle(title?: string): string {
  if (!title) return '';
  return title
    .replace(/\s*\(\s*\d+\s*개\s*(일정)?\s*\)/gi, '')
    .replace(/\s*\(일정\s*\d+\s*개\s*\)/gi, '')
    .trim();
}
