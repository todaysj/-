import { Trip, ExpenseItem } from '../types';
import { convertToKRW } from './currencyUtils';

export interface MemberSummary {
  name: string;
  totalPaid: number; // 총 결제한 금액 (KRW)
  totalOwed: number; // 자신이 분담해야 할 금액 (KRW)
  netBalance: number; // totalPaid - totalOwed (> 0: 받아야 함, < 0: 보내야 함)
  paidCount: number; // 결제한 건수
  sharedCount: number; // 분담 참여 건수
}

export interface SettlementTransfer {
  from: string; // 보내는 사람
  to: string; // 받는 사람
  amount: number; // 송금 금액 (KRW)
}

export interface DutchPayResult {
  members: string[];
  totalSpentKRW: number;
  averagePerMemberKRW: number;
  memberSummaries: MemberSummary[];
  transfers: SettlementTransfer[];
}

/**
 * Returns clean list of members for a trip
 */
export function getTripMembers(trip: Trip): string[] {
  if (trip.members && trip.members.length > 0) {
    return Array.from(new Set(trip.members.map((m) => m.trim()))).filter(Boolean);
  }

  // Derive from expenses if no explicit members set
  const derived = new Set<string>();
  trip.expenses.forEach((e) => {
    if (e.paidBy && e.paidBy.trim()) derived.add(e.paidBy.trim());
    if (e.splitWith && Array.isArray(e.splitWith)) {
      e.splitWith.forEach((m) => {
        if (m && m.trim()) derived.add(m.trim());
      });
    }
  });

  const memberList = Array.from(derived);
  if (memberList.length >= 2) {
    return memberList;
  }
  if (memberList.length === 1) {
    return [memberList[0], '동행'];
  }
  return ['A', 'B'];
}

/**
 * Calculates complete Dutch Pay (Split Bill) statistics and minimum settlement transfers
 */
export function calculateDutchPay(
  trip: Trip,
  rates: Record<string, number>,
  customMemberList?: string[]
): DutchPayResult {
  const members = customMemberList && customMemberList.length > 0
    ? customMemberList
    : getTripMembers(trip);

  const memberStats: Record<string, { totalPaid: number; totalOwed: number; paidCount: number; sharedCount: number }> = {};
  members.forEach((m) => {
    memberStats[m] = { totalPaid: 0, totalOwed: 0, paidCount: 0, sharedCount: 0 };
  });

  let totalSpentKRW = 0;

  trip.expenses.forEach((expense) => {
    const krw = convertToKRW(expense.amount, expense.currency, rates);
    totalSpentKRW += krw;

    const payer = (expense.paidBy || '').trim();
    if (payer && memberStats[payer]) {
      memberStats[payer].totalPaid += krw;
      memberStats[payer].paidCount += 1;
    } else if (payer && !memberStats[payer]) {
      // If payer not in active member list, record dynamically or assign to first member
      const fallback = members[0];
      if (fallback && memberStats[fallback]) {
        memberStats[fallback].totalPaid += krw;
        memberStats[fallback].paidCount += 1;
      }
    }

    // Determine who splits this expense
    let splitTargets: string[] = [];
    if (expense.splitWith && expense.splitWith.length > 0) {
      splitTargets = expense.splitWith.filter((m) => members.includes(m));
    }
    if (splitTargets.length === 0) {
      // Defaults to all active members
      splitTargets = [...members];
    }

    const sharePerPerson = krw / splitTargets.length;
    splitTargets.forEach((m) => {
      if (memberStats[m]) {
        memberStats[m].totalOwed += sharePerPerson;
        memberStats[m].sharedCount += 1;
      }
    });
  });

  const memberSummaries: MemberSummary[] = members.map((m) => {
    const stats = memberStats[m] || { totalPaid: 0, totalOwed: 0, paidCount: 0, sharedCount: 0 };
    return {
      name: m,
      totalPaid: Math.round(stats.totalPaid),
      totalOwed: Math.round(stats.totalOwed),
      netBalance: Math.round(stats.totalPaid - stats.totalOwed),
      paidCount: stats.paidCount,
      sharedCount: stats.sharedCount
    };
  });

  // Calculate Optimal Settlement Transfers (Debt Simplification)
  const debtors: { name: string; amount: number }[] = [];
  const creditors: { name: string; amount: number }[] = [];

  memberSummaries.forEach((m) => {
    if (m.netBalance < -10) {
      debtors.push({ name: m.name, amount: Math.abs(m.netBalance) });
    } else if (m.netBalance > 10) {
      creditors.push({ name: m.name, amount: m.netBalance });
    }
  });

  // Sort descending
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transfers: SettlementTransfer[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const settle = Math.min(debtor.amount, creditor.amount);

    if (Math.round(settle) > 0) {
      transfers.push({
        from: debtor.name,
        to: creditor.name,
        amount: Math.round(settle)
      });
    }

    debtor.amount -= settle;
    creditor.amount -= settle;

    if (debtor.amount < 1) d++;
    if (creditor.amount < 1) c++;
  }

  const averagePerMemberKRW = members.length > 0 ? Math.round(totalSpentKRW / members.length) : 0;

  return {
    members,
    totalSpentKRW: Math.round(totalSpentKRW),
    averagePerMemberKRW,
    memberSummaries,
    transfers
  };
}

/**
 * Formats Dutch Pay results into a clean, ready-to-paste text message for KakaoTalk/SMS
 */
export function generateSettlementShareText(tripTitle: string, result: DutchPayResult): string {
  let text = `✈️ [${tripTitle}] 여행 더치페이 정산서\n`;
  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💰 총 지출 금액: ${result.totalSpentKRW.toLocaleString()}원\n`;
  text += `👥 정산 인원 (${result.members.length}명): ${result.members.join(', ')}\n`;
  text += `📊 1인당 평균 분담액: 약 ${result.averagePerMemberKRW.toLocaleString()}원\n\n`;

  text += `📌 멤버별 결제 현황\n`;
  result.memberSummaries.forEach((m) => {
    let action = '✅ 정산 완료 (0원)';
    if (m.netBalance > 0) {
      action = `👉 ${m.netBalance.toLocaleString()}원 받기 (+환급)`;
    } else if (m.netBalance < 0) {
      action = `👉 ${Math.abs(m.netBalance).toLocaleString()}원 송금 필요`;
    }
    text += `• ${m.name}: 결제 ${m.totalPaid.toLocaleString()}원 / 부담 ${m.totalOwed.toLocaleString()}원\n  └ ${action}\n`;
  });

  text += `\n💸 최종 송금 정산 내역 (최소 송금)\n`;
  if (result.transfers.length === 0) {
    text += `🎉 모든 정산이 깔끔하게 맞아 추가 송금이 필요 없습니다!\n`;
  } else {
    result.transfers.forEach((t, idx) => {
      text += `${idx + 1}. [${t.from}] ➔ [${t.to}] : ${t.amount.toLocaleString()}원 송금\n`;
    });
  }

  text += `━━━━━━━━━━━━━━━━━━━━\n`;
  text += `💡 J플래너 스마트 더치페이에서 자동 계산되었습니다.`;
  return text;
}
