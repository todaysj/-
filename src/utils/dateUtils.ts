/**
 * Date and Day calculation utilities for J-Planner
 * Ensures 100% accurate, timezone-safe date synchronization across Itinerary, Map, and Modals.
 */

import { ScheduleItem } from '../types';

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

/**
 * Auto-links start time and default end time when inserting a schedule item.
 * - Start time: directly matches the previous schedule item's end time (or start time if no end time)
 * - End time: default interval (1 hour later, or gap before next item) with user-editable capability
 */
export function getAutoLinkedTimes(
  prevItem?: { time?: string; endTime?: string; day?: number },
  nextItem?: { time?: string; endTime?: string; day?: number }
): { startTime: string; endTime: string } {
  let startTime = '10:00';
  if (prevItem) {
    if (prevItem.endTime && prevItem.endTime.trim()) {
      startTime = prevItem.endTime.trim();
    } else if (prevItem.time && prevItem.time.trim()) {
      startTime = prevItem.time.trim();
    }
  }

  let startMinutes = 10 * 60;
  const match = startTime.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    startMinutes = h * 60 + m;
  }

  let endMinutes = startMinutes + 60;

  if (nextItem && nextItem.time) {
    const nextMatch = nextItem.time.match(/^(\d{1,2}):(\d{2})$/);
    if (nextMatch) {
      const nextH = parseInt(nextMatch[1], 10);
      const nextM = parseInt(nextMatch[2], 10);
      const nextMinutes = nextH * 60 + nextM;

      const isSameDay =
        !prevItem ||
        prevItem.day === undefined ||
        nextItem.day === undefined ||
        prevItem.day === nextItem.day;

      if (isSameDay && nextMinutes > startMinutes) {
        const gap = nextMinutes - startMinutes;
        if (gap <= 60) {
          endMinutes = nextMinutes;
        } else {
          endMinutes = startMinutes + 60;
        }
      }
    }
  }

  if (endMinutes >= 24 * 60) {
    endMinutes = 23 * 60 + 59;
  }

  const endH = Math.floor(endMinutes / 60);
  const endM = endMinutes % 60;
  const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

  return { startTime, endTime };
}

/**
 * Convert "HH:MM" string to minutes from start of day (0 ~ 1439)
 */
export function timeStringToMinutes(timeStr?: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
}

/**
 * Convert minutes from start of day to "HH:MM" format
 */
export function minutesToTimeString(minutes: number): string {
  const bounded = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  const h = Math.floor(bounded / 60);
  const m = bounded % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Shift subsequent schedule items on the same day when a new or updated item conflicts with them.
 * Preserves the original duration of each shifted item and cascades forward cleanly.
 */
export function adjustSubsequentSchedules(
  schedule: ScheduleItem[],
  targetItem: ScheduleItem,
  insertAfterId?: string
): { updatedSchedule: ScheduleItem[]; shiftedCount: number } {
  // If targetItem has no valid start time, return unchanged
  if (!targetItem.time) {
    return { updatedSchedule: schedule, shiftedCount: 0 };
  }

  const targetDay = targetItem.day;
  const targetStart = timeStringToMinutes(targetItem.time);
  const targetEnd = targetItem.endTime
    ? timeStringToMinutes(targetItem.endTime)
    : targetStart;

  // We only shift if targetEnd > targetStart (the item occupies a time interval)
  if (targetEnd <= targetStart) {
    return { updatedSchedule: schedule, shiftedCount: 0 };
  }

  // Find index of targetItem in the current schedule array
  const targetIndex = schedule.findIndex((item) => item.id === targetItem.id);

  let minNextStart = targetEnd;
  let shiftedCount = 0;

  // Track modified items by id
  const modifiedMap = new Map<string, { time: string; endTime?: string }>();

  // Filter all candidate subsequent items on the same day
  const candidateItems = schedule.filter((item, idx) => {
    if (item.day !== targetDay || item.id === targetItem.id) return false;
    const itemStart = timeStringToMinutes(item.time);

    // If inserted after a specific item, all items after that index on the same day
    if (targetIndex >= 0 && idx > targetIndex) {
      return true;
    }

    // Otherwise, any item starting at or after targetItem's original start time
    return itemStart >= targetStart;
  });

  // Sort candidate items in chronological order to cascade shifts sequentially
  const sortedCandidates = [...candidateItems].sort((a, b) => {
    const aStart = timeStringToMinutes(a.time);
    const bStart = timeStringToMinutes(b.time);
    if (aStart !== bStart) return aStart - bStart;
    return schedule.indexOf(a) - schedule.indexOf(b);
  });

  for (const item of sortedCandidates) {
    const itemStart = timeStringToMinutes(item.time);

    if (itemStart < minNextStart) {
      // Conflict! Shift item to start at minNextStart
      shiftedCount++;
      const duration = item.endTime
        ? Math.max(0, timeStringToMinutes(item.endTime) - itemStart)
        : 0;

      const newStartMinutes = minNextStart;
      const newEndMinutes = item.endTime
        ? Math.min(23 * 60 + 59, newStartMinutes + duration)
        : undefined;

      const newTime = minutesToTimeString(newStartMinutes);
      const newEndTime = newEndMinutes !== undefined
        ? minutesToTimeString(newEndMinutes)
        : undefined;

      modifiedMap.set(item.id, { time: newTime, endTime: newEndTime });

      // Update minimum start time for subsequent items
      minNextStart = newEndMinutes !== undefined ? newEndMinutes : newStartMinutes;
    } else {
      // No conflict, but this item's end time determines the boundary for subsequent items
      if (item.endTime) {
        minNextStart = Math.max(minNextStart, timeStringToMinutes(item.endTime));
      } else {
        minNextStart = Math.max(minNextStart, itemStart);
      }
    }
  }

  // Construct updated schedule with modified items
  const updatedSchedule = schedule.map((item) => {
    const mod = modifiedMap.get(item.id);
    if (mod) {
      return {
        ...item,
        time: mod.time,
        endTime: mod.endTime
      };
    }
    return item;
  });

  return { updatedSchedule, shiftedCount };
}


