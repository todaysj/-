import React, { useState } from 'react';
import { Trip, ExpenseItem, CategoryType } from '../types';
import {
  Users,
  CreditCard,
  ArrowRight,
  Copy,
  Check,
  Plus,
  Trash2,
  Edit3,
  Share2,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Sparkles,
  HelpCircle,
  Filter
} from 'lucide-react';
import {
  calculateDutchPay,
  getTripMembers,
  generateSettlementShareText,
  DutchPayResult
} from '../utils/splitUtils';
import { convertToKRW, DEFAULT_EXCHANGE_RATES } from '../utils/currencyUtils';

interface DutchPayViewProps {
  trip: Trip;
  onUpdateMembers: (newMembers: string[]) => void;
  onOpenAddExpense: () => void;
  onEditExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (expenseId: string) => void;
  onSwitchToBudget?: () => void;
}

export const DutchPayView: React.FC<DutchPayViewProps> = ({
  trip,
  onUpdateMembers,
  onOpenAddExpense,
  onEditExpense,
  onDeleteExpense,
  onSwitchToBudget
}) => {
  const members = getTripMembers(trip);
  const activeRates = {
    ...DEFAULT_EXCHANGE_RATES,
    ...(trip.customExchangeRates || {})
  };

  const [newMemberInput, setNewMemberInput] = useState('');
  const [copiedToast, setCopiedToast] = useState(false);
  const [completedTransfers, setCompletedTransfers] = useState<Record<string, boolean>>({});
  const [selectedMemberFilter, setSelectedMemberFilter] = useState<string>('ALL');

  const dutchPayResult: DutchPayResult = calculateDutchPay(trip, activeRates, members);

  // Add Member
  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newMemberInput.trim();
    if (!clean) return;
    if (!members.includes(clean)) {
      onUpdateMembers([...members, clean]);
    }
    setNewMemberInput('');
  };

  // Remove Member
  const handleRemoveMember = (memberToRemove: string) => {
    if (members.length <= 1) {
      alert('최소 1명 이상의 멤버가 필요합니다.');
      return;
    }
    // Check if member has paid expenses
    const hasPaid = trip.expenses.some((e) => e.paidBy === memberToRemove);
    if (hasPaid) {
      if (!confirm(`'${memberToRemove}'님이 결제한 지출 내역이 있습니다. 그래도 멤버에서 제외하시겠습니까?`)) {
        return;
      }
    }
    onUpdateMembers(members.filter((m) => m !== memberToRemove));
  };

  // Quick Preset Members
  const handleApplyPreset = (preset: string[]) => {
    onUpdateMembers(preset);
  };

  // Copy share text to clipboard
  const handleCopyShareText = () => {
    const text = generateSettlementShareText(trip.title, dutchPayResult);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedToast(true);
      setTimeout(() => setCopiedToast(false), 2500);
    });
  };

  // Toggle transfer completed
  const handleToggleTransferDone = (transferKey: string) => {
    setCompletedTransfers((prev) => ({
      ...prev,
      [transferKey]: !prev[transferKey]
    }));
  };

  // Category Colors
  const getCategoryColor = (cat: CategoryType) => {
    switch (cat) {
      case 'FLIGHT': return 'bg-indigo-500';
      case 'ACCOMMODATION': return 'bg-amber-500';
      case 'FOOD': return 'bg-emerald-500';
      case 'SIGHTSEEING': return 'bg-sky-500';
      case 'SHOPPING': return 'bg-purple-500';
      case 'TRANSPORT': return 'bg-orange-500';
      default: return 'bg-slate-500';
    }
  };

  // Filtered Expenses
  const filteredExpenses = trip.expenses.filter((exp) => {
    if (selectedMemberFilter === 'ALL') return true;
    return exp.paidBy === selectedMemberFilter || (exp.splitWith && exp.splitWith.includes(selectedMemberFilter));
  });

  return (
    <div className="space-y-6">
      {/* 🌟 Header & Member Management Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                <Users className="w-5 h-5" />
              </span>
              <h3 className="text-lg font-black text-slate-900">더치페이 정산</h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              호텔은 A가, 항공은 B가 긁었을 때 누가 누구에게 얼마를 송금해야 하는지 최소 송금 경로로 깔끔하게 계산해 드립니다.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyShareText}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold rounded-xl transition shadow-sm"
              title="카카오톡 단톡방 공유용 텍스트 복사"
            >
              {copiedToast ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>정산서 복사 완료!</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>정산서 텍스트 복사</span>
                </>
              )}
            </button>

            <button
              onClick={onOpenAddExpense}
              className="inline-flex items-center space-x-1 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>지출 기록</span>
            </button>
          </div>
        </div>

        {/* Member Management Row */}
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
              <span>👥 여행 정산 멤버 ({members.length}명)</span>
            </span>

            {/* Quick Presets */}
            <div className="flex items-center space-x-1 text-[11px] text-slate-400">
              <span>빠른 프리셋:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset(['A', 'B'])}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-semibold transition"
              >
                A, B (2인)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(['A', 'B', 'C'])}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-semibold transition"
              >
                A, B, C (3인)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(['나', '동행1', '동행2'])}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-md font-semibold transition"
              >
                나, 동행
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Member Badges */}
            {members.map((member, idx) => {
              const summary = dutchPayResult.memberSummaries.find((m) => m.name === member);
              const isPositive = summary ? summary.netBalance > 0 : false;
              const isNegative = summary ? summary.netBalance < 0 : false;

              return (
                <div
                  key={member}
                  className="inline-flex items-center space-x-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs"
                >
                  <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black">
                    {idx + 1}
                  </span>
                  <span>{member}</span>
                  {summary && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-md font-extrabold ${
                        isPositive
                          ? 'bg-emerald-100 text-emerald-800'
                          : isNegative
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isPositive
                        ? `+${summary.netBalance.toLocaleString()}원`
                        : isNegative
                        ? `${summary.netBalance.toLocaleString()}원`
                        : '0원'}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member)}
                    className="text-slate-400 hover:text-rose-600 transition p-0.5 rounded"
                    title={`${member} 멤버 삭제`}
                  >
                    ×
                  </button>
                </div>
              );
            })}

            {/* Add Member Form */}
            <form onSubmit={handleAddMember} className="inline-flex items-center space-x-1">
              <input
                type="text"
                placeholder="+ 새 멤버 이름 (예: C, 친구2)"
                value={newMemberInput}
                onChange={(e) => setNewMemberInput(e.target.value)}
                className="px-3 py-1.5 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none w-36"
              />
              <button
                type="submit"
                className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                추가
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 🌟 3 Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Spent */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-xs font-bold text-slate-400 mb-1">총 지출 정산 대상액</div>
          <div className="text-2xl font-black text-slate-900">
            {dutchPayResult.totalSpentKRW.toLocaleString()} <span className="text-sm font-semibold">원</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2 flex items-center justify-between">
            <span>총 {trip.expenses.length}건 결제</span>
            <span className="text-indigo-600 font-semibold">{members.length}명 참여 중</span>
          </div>
        </div>

        {/* 1-Person Average */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
          <div className="text-xs font-bold text-slate-400 mb-1">1인당 평균 분담금</div>
          <div className="text-2xl font-black text-indigo-600">
            {dutchPayResult.averagePerMemberKRW.toLocaleString()} <span className="text-sm font-semibold">원</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-2">
            전체 지출을 균등 분담할 경우 기준
          </div>
        </div>

        {/* Settlement Status */}
        <div className="bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-100 p-5 rounded-2xl shadow-sm">
          <div className="text-xs font-bold text-indigo-900/80 mb-1">최종 송금 필요 건수</div>
          <div className="text-2xl font-black text-indigo-950">
            {dutchPayResult.transfers.length === 0 ? '0건 (정산 완료)' : `${dutchPayResult.transfers.length}건 송금`}
          </div>
          <div className="text-[11px] text-indigo-700 mt-2">
            {dutchPayResult.transfers.length === 0
              ? '🎉 모든 결제 비율이 딱 맞아 송금이 불필요합니다!'
              : '💡 최소 송금 알고리즘으로 계산된 송금 건수입니다.'}
          </div>
        </div>
      </div>

      {/* 🌟 Smart Minimum Transfer Box (누가 누구에게 얼마 송금) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Sparkles className="w-5 h-5" />
            </span>
            <h4 className="font-extrabold text-slate-900 text-base">스마트 최소 송금 안내</h4>
          </div>
          <span className="text-xs font-bold text-slate-400">
            가장 적은 횟수로 정산을 끝내는 방법
          </span>
        </div>

        {dutchPayResult.transfers.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl space-y-2">
            <div className="text-3xl">🎉</div>
            <div className="text-sm font-extrabold text-slate-800">
              {trip.expenses.length === 0 ? '지출 내역을 추가하면 더치페이 정산이 계산됩니다.' : '정산 완료! 추가로 송금할 금액이 없습니다.'}
            </div>
            <p className="text-xs text-slate-400">
              각 멤버가 자신의 분담 몫만큼 정확히 결제했습니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dutchPayResult.transfers.map((t, idx) => {
              const transferKey = `${t.from}-${t.to}-${t.amount}`;
              const isDone = !!completedTransfers[transferKey];

              return (
                <div
                  key={transferKey}
                  onClick={() => handleToggleTransferDone(transferKey)}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                    isDone
                      ? 'bg-emerald-50/60 border-emerald-200 opacity-60'
                      : 'bg-indigo-50/40 border-indigo-200/80 hover:bg-indigo-50 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <button
                      type="button"
                      className={`w-6 h-6 rounded-lg flex items-center justify-center transition border ${
                        isDone
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white border-slate-300 text-transparent hover:border-indigo-400'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>

                    <div>
                      <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-800">
                        <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-md">
                          {t.from}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md">
                          {t.to}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        {t.from}님이 {t.to}님에게 계좌/카카오페이 송금
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-base font-black ${isDone ? 'line-through text-slate-400' : 'text-indigo-600'}`}>
                      {t.amount.toLocaleString()} <span className="text-xs font-semibold">원</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400">
                      {isDone ? '송금 완료' : '클릭하여 완료 표시'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🌟 Member Settlement Detailed Breakdown Cards */}
      <div className="space-y-3">
        <h4 className="font-extrabold text-slate-900 text-base flex items-center space-x-1.5">
          <CreditCard className="w-4 h-4 text-indigo-600" />
          <span>멤버별 결제 & 정산 상세 현황</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dutchPayResult.memberSummaries.map((m) => {
            const isPositive = m.netBalance > 0;
            const isNegative = m.netBalance < 0;

            // Expenses paid by this member
            const memberPaidExpenses = trip.expenses.filter((e) => e.paidBy === m.name);

            return (
              <div
                key={m.name}
                className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center">
                        {m.name.slice(0, 2)}
                      </div>
                      <div>
                        <div className="font-black text-slate-900 text-sm">{m.name}</div>
                        <div className="text-[10px] text-slate-400">결제 {m.paidCount}건 • 분담 {m.sharedCount}건</div>
                      </div>
                    </div>

                    <span
                      className={`text-xs px-2.5 py-1 rounded-xl font-black ${
                        isPositive
                          ? 'bg-emerald-100 text-emerald-800'
                          : isNegative
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isPositive
                        ? `+${m.netBalance.toLocaleString()}원 받기`
                        : isNegative
                        ? `${Math.abs(m.netBalance).toLocaleString()}원 송금`
                        : '0원 (정산 완료)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <div className="text-slate-400 text-[10px] font-bold">내가 낸 금액 (결제)</div>
                      <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                        {m.totalPaid.toLocaleString()}원
                      </div>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-xl">
                      <div className="text-slate-400 text-[10px] font-bold">내가 낼 몫 (분담)</div>
                      <div className="font-extrabold text-slate-900 text-sm mt-0.5">
                        {m.totalOwed.toLocaleString()}원
                      </div>
                    </div>
                  </div>

                  {/* List of items paid by this member */}
                  <div className="space-y-1">
                    <div className="text-[11px] font-bold text-slate-500">결제한 주요 항목:</div>
                    {memberPaidExpenses.length === 0 ? (
                      <div className="text-[11px] text-slate-400 italic">결제한 내역이 없습니다.</div>
                    ) : (
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {memberPaidExpenses.map((exp) => (
                          <div
                            key={exp.id}
                            className="flex items-center justify-between text-[11px] py-1 px-2 bg-slate-50 rounded-lg"
                          >
                            <span className="truncate max-w-[140px] font-medium text-slate-700">
                              {exp.title}
                            </span>
                            <span className="font-bold text-slate-900 whitespace-nowrap">
                              {exp.amount.toLocaleString()} {exp.currency}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">정산 차액</span>
                  <span
                    className={`font-extrabold text-sm ${
                      isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-500'
                    }`}
                  >
                    {isPositive ? `+${m.netBalance.toLocaleString()}원` : `${m.netBalance.toLocaleString()}원`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 🌟 Transaction Breakdown with Filter */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h4 className="font-extrabold text-slate-900 text-base">
            지출별 결제자 & 분담 현황 ({filteredExpenses.length}건)
          </h4>

          {/* Member Filter Chips */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-bold text-slate-400 flex items-center">
              <Filter className="w-3 h-3 mr-1" /> 필터:
            </span>
            <button
              onClick={() => setSelectedMemberFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                selectedMemberFilter === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              전체
            </button>
            {members.map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMemberFilter(m)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  selectedMemberFilter === m
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m} 관련
              </button>
            ))}
          </div>
        </div>

        {filteredExpenses.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            표시할 지출 내역이 없습니다.
          </div>
        ) : (
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {filteredExpenses.map((expense) => {
              const krwVal = Math.round(convertToKRW(expense.amount, expense.currency, activeRates));
              const splitTargets = (expense.splitWith && expense.splitWith.length > 0)
                ? expense.splitWith
                : members;
              const perPersonKRW = Math.round(krwVal / splitTargets.length);

              return (
                <div
                  key={expense.id}
                  className="p-3.5 bg-slate-50 border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-100/70 transition"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${getCategoryColor(expense.category)}`} />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-slate-900 text-sm">{expense.title}</span>
                        {expense.notes && (
                          <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                            {expense.notes}
                          </span>
                        )}
                      </div>

                      {/* Who paid & Who splits */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs">
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-bold text-[11px]">
                          <span>💳 결제: {expense.paidBy || 'A'}</span>
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 bg-sky-100 text-sky-900 rounded-md font-bold text-[11px]">
                          <span>
                            👥 분담: {splitTargets.join(', ')} ({splitTargets.length}명 / 1인당 {perPersonKRW.toLocaleString()}원)
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-3 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200">
                    <div className="text-right">
                      <div className="font-black text-slate-900 text-sm">
                        {expense.amount.toLocaleString()} {expense.currency}
                      </div>
                      {expense.currency !== 'KRW' && (
                        <div className="text-[10px] text-slate-400">
                          (약 {krwVal.toLocaleString()} 원)
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition"
                        title="지출 및 더치페이 수정"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteExpense(expense.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition"
                        title="지출 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
