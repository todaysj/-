import { Trip, ScheduleItem, Reservation, PackingItem, ExpenseItem } from '../types';
import { resolveTripPhotos } from './imageUtils';
import { getTripChecklistTabs, getTripSouvenirTabs } from './tabUtils';

export interface ExportSectionOptions {
  cover?: boolean;
  schedule?: boolean;
  checklist?: boolean;
  souvenirs?: boolean;
  reservations?: boolean;
  expenses?: boolean;
}

/**
 * Downloads text or JSON content as a file in the browser
 */
export function downloadFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Formats a Trip object into a human-readable Markdown itinerary document
 */
export function generateTripMarkdown(trip: Trip, options?: ExportSectionOptions): string {
  const lines: string[] = [];

  const includeCover = options?.cover !== false;
  const includeSchedule = options?.schedule !== false;
  const includeReservations = options?.reservations !== false;
  const includeChecklist = options?.checklist !== false;
  const includeExpenses = options?.expenses !== false;
  const includeSouvenirs = options?.souvenirs !== false;

  // Title & Summary
  if (includeCover) {
    lines.push(`# ✈️ ${trip.title}`);
    lines.push(`**목적지:** ${trip.destination}`);
    lines.push(`**여행 기간:** ${trip.startDate} ~ ${trip.endDate}`);
    lines.push(`**총 예산:** ${trip.totalBudget.toLocaleString()} ${trip.currency}`);
    lines.push(`**작성일:** ${new Date().toLocaleDateString('ko-KR')}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  } else {
    lines.push(`# ✈️ ${trip.title}`);
    lines.push(`*(${trip.destination} · ${trip.startDate} ~ ${trip.endDate})*`);
    lines.push('');
  }

  // 1. Schedule / Itinerary
  if (includeSchedule) {
    lines.push('## 📅 일자별 일정 (Itinerary)');
    lines.push('');

    // Calculate total days
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

    for (let day = 1; day <= totalDays; day++) {
      const dayDate = new Date(trip.startDate);
      dayDate.setDate(dayDate.getDate() + (day - 1));
      const dateStr = `${dayDate.getMonth() + 1}/${dayDate.getDate()} (${['일', '월', '화', '수', '목', '금', '토'][dayDate.getDay()]})`;

      const daySchedules = (trip.schedule || [])
        .filter((s) => s.day === day)
        .sort((a, b) => a.time.localeCompare(b.time));

      lines.push(`### Day ${day} - ${dateStr}`);

      if (daySchedules.length === 0) {
        lines.push('*등록된 일정이 없습니다.*');
      } else {
        daySchedules.forEach((item) => {
          const doneMark = item.isDone ? '✅' : '📌';
          const costStr = item.cost > 0 ? ` (${item.cost.toLocaleString()} ${item.currency})` : '';
          const bookingStr = item.bookingRef ? ` [예약번호: ${item.bookingRef}]` : '';

          lines.push(`- **${item.time}** ${doneMark} **${item.title}** (${item.location})${costStr}${bookingStr}`);
          if (item.notes) {
            lines.push(`  - *메모:* ${item.notes}`);
          }
        });
      }
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // 2. Reservations
  if (includeReservations) {
    lines.push('## 🎫 예약 서류함 (Reservations)');
    lines.push('');

    const reservations = trip.reservations || [];
    if (reservations.length === 0) {
      lines.push('*등록된 예약 서류가 없습니다.*');
    } else {
      lines.push('| 구분 | 예약 항목 | 이용일 | 공급업체 | 예약번호/인증코드 | 비고 |');
      lines.push('| --- | --- | --- | --- | --- | --- |');

      const catLabels: Record<string, string> = {
        FLIGHT: '✈️ 항공',
        HOTEL: '🏨 숙소',
        ACTIVITY: '🎟️ 액티비티',
        TRANSPORT: '🚆 교통',
        OTHER: '📑 기타',
      };

      reservations.forEach((res) => {
        const cat = catLabels[res.category] || res.category;
        const details = (res.details || '').replace(/\n/g, ' ');
        lines.push(`| ${cat} | ${res.title} | ${res.date} ${res.time || ''} | ${res.provider} | \`${res.confirmationNo}\` | ${details} |`);
      });
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // 3. Packing List / Checklist
  if (includeChecklist) {
    lines.push('## 🎒 준비물 체크리스트 (Checklist)');
    lines.push('');

    const checklistTabs = getTripChecklistTabs(trip);
    const totalItems = checklistTabs.reduce((sum, tab) => sum + (tab.items?.length || 0), 0);

    if (totalItems === 0) {
      lines.push('*등록된 준비물이 없습니다.*');
    } else {
      checklistTabs.forEach((tab) => {
        lines.push(`### 📁 ${tab.title}`);
        const items = tab.items || [];
        if (items.length === 0) {
          lines.push('*준비물 없음*');
        } else {
          items.forEach((item) => {
            const check = item.isPacked ? '[x]' : '[ ]';
            const essential = item.isEssential ? '⭐ (필수)' : '';
            lines.push(`- ${check} ${item.title} ${essential}`);
          });
        }
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('');
  }

  // 4. Budget / Expenses Summary
  if (includeExpenses) {
    lines.push('## 💰 예산 및 지출 내역 (Expenses)');
    lines.push('');

    const expenses = trip.expenses || [];
    const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

    lines.push(`- **총 예산:** ${trip.totalBudget.toLocaleString()} ${trip.currency}`);
    lines.push(`- **현재 총 사용액:** ${totalSpent.toLocaleString()} ${trip.currency}`);
    lines.push('');

    if (expenses.length > 0) {
      lines.push('| 날짜 | 항목 | 금액 | 결제수단 | 결제자 |');
      lines.push('| --- | --- | --- | --- | --- |');

      expenses.forEach((e) => {
        const payMethod = e.paymentMethod === 'CARD' ? '💳 카드' : '💵 현금';
        lines.push(`| ${e.date} | ${e.title} | ${e.amount.toLocaleString()} ${e.currency} | ${payMethod} | ${e.paidBy} |`);
      });
    } else {
      lines.push('*등록된 지출 내역이 없습니다.*');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  }

  // 5. Souvenirs / Shopping List
  if (includeSouvenirs) {
    lines.push('## 🎁 기념품 & 쇼핑 리스트 (Souvenirs)');
    lines.push('');

    const souvenirTabs = getTripSouvenirTabs(trip);
    const totalSouvenirs = souvenirTabs.reduce((sum, tab) => sum + (tab.items?.length || 0), 0);

    if (totalSouvenirs === 0) {
      lines.push('*등록된 기념품이나 쇼핑 목록이 없습니다.*');
    } else {
      souvenirTabs.forEach((tab) => {
        lines.push(`### 📁 ${tab.title}`);
        const items = tab.items || [];
        if (items.length === 0) {
          lines.push('*등록된 물품 없음*');
        } else {
          lines.push('| 구분 | 물품명 | 구입여부 | 선물대상 | 구매장소 | 예상금액 |');
          lines.push('| --- | --- | --- | --- | --- | --- |');

          items.forEach((s) => {
            const purchasedStr = s.isPurchased ? '✅ 구입완료' : '☐ 미구입';
            const personStr = s.targetPerson || '-';
            const locStr = s.location || '-';
            const priceStr = s.estimatedPrice ? `${s.estimatedPrice.toLocaleString()} ${s.currency || trip.currency}` : '-';
            lines.push(`| ${s.tag} | ${s.title} | ${purchasedStr} | ${personStr} | ${locStr} | ${priceStr} |`);
          });
        }
        lines.push('');
      });
    }

    lines.push('---');
    lines.push('');
  }

  lines.push('*J플래너에서 생성된 여행 일정표 파일입니다.*');

  return lines.join('\n');
}

/**
 * Downloads Markdown file
 */
export function exportTripAsMarkdownFile(trip: Trip, options?: ExportSectionOptions) {
  const content = generateTripMarkdown(trip, options);
  const cleanTitle = trip.title.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `${cleanTitle}_일정표.md`;
  downloadFile(filename, content, 'text/markdown;charset=utf-8');
}

/**
 * Downloads JSON backup file with 100% of souvenir photos fully resolved to base64
 */
export async function exportTripAsJSONFile(trip: Trip): Promise<void> {
  const fullyResolvedTrip = await resolveTripPhotos(trip);
  const cleanTitle = trip.title.replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `${cleanTitle}_데이터_백업.json`;
  const content = JSON.stringify(fullyResolvedTrip, null, 2);
  downloadFile(filename, content, 'application/json;charset=utf-8');
}

/**
 * Downloads full comprehensive workspace backup (all trips + all souvenir photos + brand settings)
 */
export async function exportFullBackupJSONFile(trips: Trip[], brandSettings?: any): Promise<void> {
  const resolvedTrips = await Promise.all(
    trips.map(async (t) => {
      try {
        return await resolveTripPhotos(t);
      } catch {
        return t;
      }
    })
  );

  const payload = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    trips: resolvedTrips,
    localStorage: {
      jplanner_trips_cache: resolvedTrips,
      jplanner_brand_settings_cache: brandSettings || undefined
    },
    jplanner_brand_settings_cache: brandSettings || undefined
  };

  const filename = `J플래너_전체여행_기념품사진포함_백업_${new Date().toISOString().split('T')[0]}.json`;
  const content = JSON.stringify(payload, null, 2);
  downloadFile(filename, content, 'application/json;charset=utf-8');
}
