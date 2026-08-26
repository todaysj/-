import React, { useState } from 'react';
import { Trip, ExpenseItem, CategoryType } from '../types';
import {
  Wallet,
  Plus,
  CreditCard,
  DollarSign,
  TrendingUp,
  PieChart,
  ArrowRightLeft,
  Trash2,
  Pencil,
  Check,
  X,
  Users,
  Sparkles,
  ArrowRight,
  Edit3,
  Scale
} from 'lucide-react';
import { convertToKRW, getExchangeRate, DEFAULT_EXCHANGE_RATES } from '../utils/currencyUtils';
import { getTripMembers } from '../utils/splitUtils';
import { DutchPayView } from './DutchPayView';
import { ExpenseModal } from './ExpenseModal';
import { CurrencySelector } from './CurrencySelector';

interface BudgetViewProps {
  trip: Trip;
  onAddExpense: (expense: Omit<ExpenseItem, 'id'>) => void;
  onUpdateExpense?: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: string) => void;
  onUpdateTotalBudget?: (newBudget: number) => void;
  onUpdateExchangeRates?: (rates: Record<string, number>) => void;
  onUpdateMembers?: (newMembers: string[]) => void;
  onAddCustomCurrency?: (code: string, rate: number) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({
  trip,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  onUpdateTotalBudget,
  onUpdateExchangeRates,
  onUpdateMembers,
  onAddCustomCurrency
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'dutchpay'>('overview');

  // Inline form state
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [category, setCategory] = useState<CategoryType>('FOOD');
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH'>('CARD');
  const [paidBy, setPaidBy] = useState('');
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState('');

  // Exchange rate modal state
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [ratesInput, setRatesInput] = useState<Record<string, number>>(() => ({
    ...DEFAULT_EXCHANGE_RATES,
    ...(trip.customExchangeRates || {})
  }));

  // Expense Modal State (for full Add / Edit)
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpenseItem, setEditingExpenseItem] = useState<ExpenseItem | null>(null);

  const members = getTripMembers(trip);

  const activeRates = {
    ...DEFAULT_EXCHANGE_RATES,
    ...(trip.customExchangeRates || {})
  };

  // Sync default payer and split members when members change
  React.useEffect(() => {
    if (!paidBy || !members.includes(paidBy)) {
      setPaidBy(members[0] || 'A');
    }
    if (splitWith.length === 0 || splitWith.some((m) => !members.includes(m))) {
      setSplitWith([...members]);
    }
  }, [members]);

  const handleToggleQuickSplitMember = (member: string) => {
    if (splitWith.includes(member)) {
      if (splitWith.length > 1) {
        setSplitWith(splitWith.filter((m) => m !== member));
      }
    } else {
      setSplitWith([...splitWith, member]);
    }
  };

  // Total Expenses in KRW
  const totalSpentKRW = trip.expenses.reduce((sum, item) => {
    return sum + convertToKRW(item.amount, item.currency, activeRates);
  }, 0);

  const budgetKRW = trip.totalBudget;
  const remainingKRW = budgetKRW - totalSpentKRW;
  const spentPercent = Math.min(100, Math.round((totalSpentKRW / budgetKRW) * 100));

  const numAmount = Number(amount);
  const liveConvertedKRW = convertToKRW(numAmount, currency, activeRates);
  const currentRate = getExchangeRate(currency, activeRates);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return;

    onAddExpense({
      date: new Date().toISOString().split('T')[0],
      title: title.trim(),
      category,
      amount: Number(amount),
      currency,
      paidBy: paidBy || members[0] || 'A',
      paymentMethod,
      splitWith: splitWith.length > 0 ? splitWith : members,
      notes: notes.trim()
    });

    setTitle('');
    setAmount('');
    setNotes('');
  };

  const handleOpenRatesModal = () => {
    setRatesInput({
      ...DEFAULT_EXCHANGE_RATES,
      ...(trip.customExchangeRates || {})
    });
    setIsRatesModalOpen(true);
  };

  const handleSaveRates = (e: React.FormEvent) => {
    e.preventDefault();
    if (onUpdateExchangeRates) {
      onUpdateExchangeRates(ratesInput);
    }
    setIsRatesModalOpen(false);
  };

  const handleResetDefaultRates = () => {
    setRatesInput({ ...DEFAULT_EXCHANGE_RATES });
  };

  // Handle Save from ExpenseModal (Add or Edit)
  const handleSaveExpenseModal = (expenseData: Omit<ExpenseItem, 'id'>, editId?: string) => {
    if (editId && onUpdateExpense) {
      onUpdateExpense({
        ...expenseData,
        id: editId
      });
    } else {
      onAddExpense(expenseData);
    }
    setIsExpenseModalOpen(false);
    setEditingExpenseItem(null);
  };

  // Open Edit Expense Modal
  const handleOpenEditModal = (expense: ExpenseItem) => {
    setEditingExpenseItem(expense);
    setIsExpenseModalOpen(true);
  };

  // Open New Expense Modal
  const handleOpenAddModal = () => {
    setEditingExpenseItem(null);
    setIsExpenseModalOpen(true);
  };

  // Handle Add Member
  const handleAddMember = (newMember: string) => {
    if (onUpdateMembers) {
      const current = getTripMembers(trip);
      if (!current.includes(newMember)) {
        onUpdateMembers([...current, newMember]);
      }
    }
  };

  // Handle Remove Member
  const handleRemoveMember = (memberToRemove: string) => {
    if (onUpdateMembers) {
      const current = getTripMembers(trip);
      if (current.length <= 1) {
        alert('최소 1명 이상의 멤버가 필요합니다.');
        return;
      }
      const hasPaid = trip.expenses.some((e) => e.paidBy === memberToRemove);
      if (hasPaid) {
        if (!confirm(`'${memberToRemove}'님이 결제한 지출 내역이 있습니다. 그래도 멤버에서 삭제하시겠습니까?`)) {
          return;
        }
      }
      const updated = current.filter((m) => m !== memberToRemove);
      onUpdateMembers(updated);
      if (paidBy === memberToRemove) {
        setPaidBy(updated[0] || 'A');
      }
      setSplitWith((prev) => prev.filter((m) => m !== memberToRemove));
    }
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

  const getCategoryName = (cat: CategoryType) => {
    switch (cat) {
      case 'FLIGHT': return '항공권';
      case 'ACCOMMODATION': return '숙박';
      case 'FOOD': return '음식';
      case 'SIGHTSEEING': return '관광/티켓';
      case 'SHOPPING': return '쇼핑';
      case 'TRANSPORT': return '교통';
      default: return '기타';
    }
  };

  // Category summary calculation
  const categoryTotals: Record<CategoryType, number> = {
    FOOD: 0,
    ACCOMMODATION: 0,
    FLIGHT: 0,
    TRANSPORT: 0,
    SIGHTSEEING: 0,
    SHOPPING: 0,
    OTHER: 0
  };

  trip.expenses.forEach((item) => {
    const krw = convertToKRW(item.amount, item.currency, activeRates);
    const cat = item.category || 'OTHER';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + krw;
  });

  return (
    <div className="space-y-6">
      {/* 🌟 Sub-Navigation: Budget Overview vs Dutch Pay Settlement */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex space-x-1.5 sm:space-x-2">
          <button
            type="button"
            onClick={() => setActiveSubTab('overview')}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
              activeSubTab === 'overview'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>예산 & 지출 개요</span>
            <span className={`text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-full ${
              activeSubTab === 'overview' ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
            }`}>
              {trip.expenses.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('dutchpay')}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition ${
              activeSubTab === 'dutchpay'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>더치페이 정산</span>
            <span className={`text-[10px] sm:text-[11px] px-1.5 py-0.2 rounded-full font-bold ${
              activeSubTab === 'dutchpay' ? 'bg-indigo-700 text-indigo-100' : 'bg-indigo-50 text-indigo-700'
            }`}>
              {members.length}명
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="hidden sm:inline-flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold rounded-xl transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>지출 기록 추가</span>
        </button>
      </div>

      {/* 🌟 DUTCH PAY TAB VIEW */}
      {activeSubTab === 'dutchpay' && (
        <DutchPayView
          trip={trip}
          onUpdateMembers={onUpdateMembers || (() => {})}
          onOpenAddExpense={handleOpenAddModal}
          onEditExpense={handleOpenEditModal}
          onDeleteExpense={onDeleteExpense}
          onSwitchToBudget={() => setActiveSubTab('overview')}
        />
      )}

      {/* 🌟 BUDGET OVERVIEW TAB VIEW */}
      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          {/* Budget Overview Cards - 1 Row across mobile & desktop */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            {/* Total Budget Card */}
            <div className="bg-white p-2.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                  <div className="text-[10px] sm:text-xs font-bold text-slate-400 truncate">총 예산</div>
                  {!isEditingBudget && onUpdateTotalBudget && (
                    <button
                      onClick={() => {
                        setBudgetInput(budgetKRW.toString());
                        setIsEditingBudget(true);
                      }}
                      className="text-[10px] sm:text-xs font-bold text-slate-400 hover:text-sky-600 flex items-center space-x-0.5 sm:space-x-1 transition p-0.5 sm:p-1 hover:bg-slate-50 rounded shrink-0"
                      title="총 예산 수정하기"
                    >
                      <Pencil className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                      <span className="hidden sm:inline">수정</span>
                    </button>
                  )}
                </div>

                {isEditingBudget ? (
                  <div className="flex items-center space-x-1 my-1">
                    <input
                      type="number"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      className="w-full px-1.5 py-0.5 bg-slate-50 border border-sky-400 rounded text-xs sm:text-lg font-black text-slate-900 outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        const val = Number(budgetInput);
                        if (!isNaN(val) && val >= 0 && onUpdateTotalBudget) {
                          onUpdateTotalBudget(val);
                        }
                        setIsEditingBudget(false);
                      }}
                      className="p-1 bg-sky-500 text-white rounded hover:bg-sky-600 transition"
                    >
                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                    <button
                      onClick={() => setIsEditingBudget(false)}
                      className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 transition"
                    >
                      <X className="w-3 h-3 sm:w-4 sm:h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="text-xs sm:text-xl md:text-2xl font-black text-slate-900 truncate">
                    {budgetKRW.toLocaleString()}<span className="text-[10px] sm:text-sm font-semibold ml-0.5">원</span>
                  </div>
                )}
              </div>

              <div className="text-[9px] sm:text-xs text-slate-400 mt-1 sm:mt-2 truncate">
                여행 예산 한도
              </div>
            </div>

            {/* Total Spent */}
            <div className="bg-white p-2.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="text-[10px] sm:text-xs font-bold text-slate-400 mb-0.5 sm:mb-1 truncate">총 지출액</div>
                <div className="text-xs sm:text-xl md:text-2xl font-black text-slate-900 truncate">
                  {Math.round(totalSpentKRW).toLocaleString()}<span className="text-[10px] sm:text-sm font-semibold ml-0.5">원</span>
                </div>
              </div>
              <div>
                <div className="w-full bg-slate-100 h-1 sm:h-2 rounded-full mt-1.5 sm:mt-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      spentPercent > 90 ? 'bg-rose-500' : 'bg-sky-500'
                    }`}
                    style={{ width: `${spentPercent}%` }}
                  />
                </div>
                <div className="text-[9px] sm:text-xs text-slate-400 mt-0.5 sm:mt-1 flex items-center justify-between">
                  <span className="hidden sm:inline">소진율</span>
                  <span className="font-bold text-slate-700">{spentPercent}%</span>
                </div>
              </div>
            </div>

            {/* Remaining Budget */}
            <div className="bg-white p-2.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <div className="text-[10px] sm:text-xs font-bold text-slate-400 mb-0.5 sm:mb-1 truncate">남은 잔여액</div>
                <div
                  className={`text-xs sm:text-xl md:text-2xl font-black truncate ${
                    remainingKRW < 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {Math.round(remainingKRW).toLocaleString()}<span className="text-[10px] sm:text-sm font-semibold ml-0.5">원</span>
                </div>
              </div>
              <div className="text-[9px] sm:text-xs text-slate-400 mt-1 sm:mt-2 flex items-center justify-between">
                <span className="truncate">{remainingKRW < 0 ? '초과' : '여유'}</span>
                <span className={`font-bold ${remainingKRW < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {remainingKRW < 0 ? '예산초과' : '안전'}
                </span>
              </div>
            </div>
          </div>

          {/* Category Breakdown Progress */}
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
            <h4 className="font-extrabold text-slate-900 text-sm flex items-center justify-between">
              <span>카테고리별 지출 현황</span>
              <span className="text-xs text-slate-400 font-normal">
                총 {trip.expenses.length}개 항목
              </span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-1">
              {(['FLIGHT', 'ACCOMMODATION', 'FOOD', 'SIGHTSEEING', 'SHOPPING', 'TRANSPORT', 'OTHER'] as CategoryType[]).map((cat) => {
                const total = categoryTotals[cat] || 0;
                const percent = totalSpentKRW > 0 ? Math.round((total / totalSpentKRW) * 100) : 0;
                return (
                  <div key={cat} className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                    <div className="flex items-center space-x-1.5">
                      <div className={`w-2 h-2 rounded-full ${getCategoryColor(cat)}`} />
                      <span className="text-[11px] font-bold text-slate-600">{getCategoryName(cat)}</span>
                    </div>
                    <div className="text-xs font-black text-slate-900">
                      {Math.round(total).toLocaleString()}원
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold">{percent}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Form & Table Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Add Expense Quick Form */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1 h-fit">
              <h3 className="font-extrabold text-slate-800 text-base mb-4 flex items-center justify-between">
                <div className="flex items-center">
                  <Plus className="w-5 h-5 text-sky-600 mr-1.5" />
                  <span>지출 내역 기록</span>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddModal}
                  className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition flex items-center justify-center text-sm"
                  title="상세 모달 (멤버 추가/삭제 및 정산 설정)"
                >
                  ⚙️
                </button>
              </h3>

              <form onSubmit={handleFormSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">항목명 *</label>
                  <input
                    type="text"
                    placeholder="예: 라멘 점심, 호텔 숙박비, 항공권"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sky-500 outline-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">금액 *</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">통화</label>
                    <CurrencySelector
                      value={currency}
                      onChange={setCurrency}
                      customExchangeRates={trip.customExchangeRates}
                      onAddCustomCurrency={onAddCustomCurrency}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                    />
                  </div>
                </div>

                {/* Live Exchange Rate Conversion Feedback */}
                {currency !== 'KRW' && numAmount > 0 && (
                  <div className="bg-sky-50 border border-sky-200/80 rounded-xl p-2.5 text-xs text-sky-900 space-y-1">
                    <div className="flex justify-between items-center font-extrabold">
                      <span>💡 원화 환산 예상 차감액:</span>
                      <span className="text-sky-700 text-sm">
                        약 {Math.round(liveConvertedKRW).toLocaleString()} 원
                      </span>
                    </div>
                    <div className="text-[11px] text-sky-600">
                      (적용 환율: 1 {currency} = {currentRate} 원)
                    </div>
                  </div>
                )}

                {/* Who paid selector */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">
                    💳 결제자
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPaidBy(m)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          paidBy === m
                            ? 'bg-amber-500 text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Split with selector (분담자 선택) */}
                <div className="bg-sky-50/70 border border-sky-200/80 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-sky-900 flex items-center space-x-1">
                      <Users className="w-3.5 h-3.5 text-sky-600" />
                      <span>정산 분담자 (N빵)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setSplitWith([...members])}
                      className="text-[11px] font-bold text-sky-700 hover:text-sky-900 underline cursor-pointer"
                      title="전체 멤버를 분담 대상에 포함"
                    >
                      전체
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {members.map((m) => {
                      const isSelected = splitWith.includes(m);
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => handleToggleQuickSplitMember(m)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1 cursor-pointer border ${
                            isSelected
                              ? 'bg-sky-500 text-white border-sky-600 shadow-2xs'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-sky-50/50'
                          }`}
                        >
                          <span>{m}</span>
                          <span
                            className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                              isSelected ? 'bg-black/15 text-white' : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {isSelected ? '분담' : '제외'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {numAmount > 0 && splitWith.length > 0 && (
                    <div className="text-[11px] text-sky-900 font-semibold bg-white/90 px-2.5 py-1.5 rounded-lg border border-sky-100 flex items-center justify-between">
                      <span className="text-slate-600">{splitWith.length}명 분담</span>
                      <span className="font-extrabold text-sky-700">
                        1인당 약 {Math.round(liveConvertedKRW / splitWith.length).toLocaleString()}원
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">카테고리</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as CategoryType)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                    >
                      <option value="FOOD">음식</option>
                      <option value="TRANSPORT">교통</option>
                      <option value="SHOPPING">쇼핑</option>
                      <option value="SIGHTSEEING">관광/체험</option>
                      <option value="ACCOMMODATION">숙박</option>
                      <option value="FLIGHT">항공</option>
                      <option value="OTHER">기타</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">결제 수단</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as 'CARD' | 'CASH')}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                    >
                      <option value="CARD">💳 카드</option>
                      <option value="CASH">💵 현금</option>
                    </select>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition shadow-sm mt-2 flex items-center justify-center space-x-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>지출 기록 추가</span>
                </button>
              </form>
            </div>

            {/* Expense History Table */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 space-y-4">
              <h3 className="font-extrabold text-slate-800 text-base flex flex-wrap items-center justify-between gap-2">
                <span>지출 상세 내역 ({trip.expenses.length}건)</span>
                <button
                  type="button"
                  onClick={handleOpenRatesModal}
                  className="flex items-center space-x-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-xl transition"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>환율 설정 (1엔={activeRates.JPY}원, 1달러={activeRates.USD.toLocaleString()}원)</span>
                </button>
              </h3>

              {trip.expenses.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                  지출 내역이 아직 없습니다.
                </div>
              ) : (
                <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                  {trip.expenses.map((expense) => {
                    const krwVal = Math.round(convertToKRW(expense.amount, expense.currency, activeRates));
                    const splitTargets = (expense.splitWith && expense.splitWith.length > 0)
                      ? expense.splitWith
                      : members;
                    const perPersonKRW = Math.round(krwVal / splitTargets.length);

                    return (
                      <div
                        key={expense.id}
                        className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-100/60 transition text-xs"
                      >
                        <div className="flex items-start space-x-3">
                          <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 ${getCategoryColor(expense.category)}`} />
                          <div>
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className="font-bold text-slate-800 text-sm">
                                {expense.title}
                              </span>
                              {expense.scheduleItemId && (
                                <span className="px-1.5 py-0.5 bg-sky-100/80 text-sky-800 rounded-md font-bold text-[10px] flex items-center gap-1 border border-sky-200">
                                  <span>🗓️</span>
                                  <span>일정 연동</span>
                                </span>
                              )}
                              {expense.notes && (
                                <span className="text-[10px] text-slate-400 bg-white px-1.5 py-0.2 rounded border border-slate-200">
                                  {expense.notes}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-1.5 mt-0.5">
                              <span>{expense.date}</span>
                              <span>•</span>
                              <span>{expense.paymentMethod === 'CARD' ? '카드' : '현금'}</span>
                              <span>•</span>
                              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                                결제: {expense.paidBy || 'A'}
                              </span>
                              <span>•</span>
                              <span className="px-1.5 py-0.2 bg-sky-100 text-sky-800 rounded font-bold text-[10px]">
                                분담: {splitTargets.join(', ')} (1인 {perPersonKRW.toLocaleString()}원)
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
                              onClick={() => handleOpenEditModal(expense)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition"
                              title="지출 및 더치페이 정보 수정"
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
        </div>
      )}

      {/* 🌟 Full Expense Modal (Add / Edit) */}
      <ExpenseModal
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpenseItem(null);
        }}
        onSave={handleSaveExpenseModal}
        editingExpense={editingExpenseItem}
        members={members}
        onAddMember={handleAddMember}
        onRemoveMember={handleRemoveMember}
        customExchangeRates={trip.customExchangeRates}
        onAddCustomCurrency={onAddCustomCurrency}
      />

      {/* 🌟 Exchange Rate Customization Modal */}
      {isRatesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ArrowRightLeft className="w-5 h-5 text-sky-600" />
                <h3 className="font-extrabold text-slate-900 text-base">환율 직접 설정</h3>
              </div>
              <button
                onClick={() => setIsRatesModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              지출 기록 시 원화(KRW)로 환산할 기준 환율을 수정할 수 있습니다.
            </p>

            <form onSubmit={handleSaveRates} className="space-y-3 max-h-80 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3 text-xs">
                {Object.entries(ratesInput).map(([cur, rate]) => {
                  if (cur === 'KRW') return null;
                  return (
                    <div key={cur} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                      <label className="block font-bold text-slate-700 mb-1">
                        1 {cur}당 원화(KRW)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={rate}
                        onChange={(e) =>
                          setRatesInput({
                            ...ratesInput,
                            [cur]: Number(e.target.value) || 0
                          })
                        }
                        className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg font-bold text-slate-900 outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleResetDefaultRates}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700 underline"
                >
                  기본 환율로 복원
                </button>
                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsRatesModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl transition shadow-sm"
                  >
                    저장하기
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
