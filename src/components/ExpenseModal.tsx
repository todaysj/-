import React, { useState, useEffect } from 'react';
import { ExpenseItem, CategoryType } from '../types';
import { X, Plus, DollarSign, Calendar, Tag, CreditCard, Users, Check, ArrowRightLeft } from 'lucide-react';
import { convertToKRW, getExchangeRate, DEFAULT_EXCHANGE_RATES } from '../utils/currencyUtils';
import { CurrencySelector } from './CurrencySelector';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expense: Omit<ExpenseItem, 'id'>, editId?: string) => void;
  editingExpense?: ExpenseItem | null;
  members: string[];
  onAddMember?: (newMember: string) => void;
  onRemoveMember?: (member: string) => void;
  customExchangeRates?: Record<string, number>;
  onAddCustomCurrency?: (code: string, rate: number) => void;
}

export const ExpenseModal: React.FC<ExpenseModalProps> = ({
  isOpen,
  onClose,
  onSave,
  editingExpense,
  members,
  onAddMember,
  onRemoveMember,
  customExchangeRates,
  onAddCustomCurrency
}) => {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('KRW');
  const [category, setCategory] = useState<CategoryType>('FOOD');
  const [paymentMethod, setPaymentMethod] = useState<'CARD' | 'CASH'>('CARD');
  const [paidBy, setPaidBy] = useState('');
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [isAddingNewMember, setIsAddingNewMember] = useState(false);

  const activeRates = {
    ...DEFAULT_EXCHANGE_RATES,
    ...(customExchangeRates || {})
  };

  useEffect(() => {
    if (editingExpense) {
      setTitle(editingExpense.title);
      setAmount(editingExpense.amount.toString());
      setCurrency(editingExpense.currency || 'KRW');
      setCategory(editingExpense.category || 'FOOD');
      setPaymentMethod(editingExpense.paymentMethod || 'CARD');
      setPaidBy(editingExpense.paidBy || (members[0] || '나'));
      setSplitWith(
        editingExpense.splitWith && editingExpense.splitWith.length > 0
          ? editingExpense.splitWith
          : members
      );
      setNotes(editingExpense.notes || '');
    } else {
      setTitle('');
      setAmount('');
      setCurrency('KRW');
      setCategory('FOOD');
      setPaymentMethod('CARD');
      setPaidBy(members[0] || 'A');
      setSplitWith([...members]);
      setNotes('');
    }
  }, [editingExpense, isOpen, members]);

  if (!isOpen) return null;

  const numAmount = Number(amount);
  const liveConvertedKRW = convertToKRW(numAmount, currency, activeRates);
  const currentRate = getExchangeRate(currency, activeRates);
  const perPersonKRW = splitWith.length > 0 ? Math.round(liveConvertedKRW / splitWith.length) : 0;

  const handleToggleSplitMember = (member: string) => {
    if (splitWith.includes(member)) {
      // Don't allow removing all
      if (splitWith.length > 1) {
        setSplitWith(splitWith.filter((m) => m !== member));
      }
    } else {
      setSplitWith([...splitWith, member]);
    }
  };

  const handleSelectAllMembers = () => {
    setSplitWith([...members]);
  };

  const handleRemoveMemberClick = (memberToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (members.length <= 1) {
      alert('최소 1명 이상의 멤버가 필요합니다.');
      return;
    }
    if (confirm(`'${memberToRemove}' 멤버를 삭제하시겠습니까?`)) {
      if (onRemoveMember) {
        onRemoveMember(memberToRemove);
      }
      if (paidBy === memberToRemove) {
        const remaining = members.filter((m) => m !== memberToRemove);
        setPaidBy(remaining[0] || 'A');
      }
      setSplitWith((prev) => prev.filter((m) => m !== memberToRemove));
    }
  };

  const handleAddNewMemberSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newMemberName.trim();
    if (!clean) return;
    if (onAddMember && !members.includes(clean)) {
      onAddMember(clean);
    }
    if (!splitWith.includes(clean)) {
      setSplitWith([...splitWith, clean]);
    }
    setPaidBy(clean);
    setNewMemberName('');
    setIsAddingNewMember(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return;

    onSave(
      {
        date: editingExpense?.date || new Date().toISOString().split('T')[0],
        title: title.trim(),
        category,
        amount: Number(amount),
        currency,
        paidBy: paidBy || members[0] || 'A',
        paymentMethod,
        splitWith: splitWith.length > 0 ? splitWith : members,
        notes: notes.trim()
      },
      editingExpense?.id
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-100 max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-lg">💰</span>
            <h3 className="font-extrabold text-sm sm:text-base">
              {editingExpense ? '지출 및 더치페이 내역 수정' : '새 지출 & 더치페이 기록'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">지출 항목명 *</label>
            <input
              type="text"
              placeholder="예: 시부야 호텔 숙박비, 왕복 항공권, 우동 점심"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sky-500 outline-none"
              required
              autoFocus
            />
          </div>

          {/* Amount & Currency */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">결제 금액 *</label>
              <input
                type="number"
                placeholder="0"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">결제 통화</label>
              <CurrencySelector
                value={currency}
                onChange={setCurrency}
                customExchangeRates={customExchangeRates}
                onAddCustomCurrency={onAddCustomCurrency}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>
          </div>

          {/* Exchange calculation preview */}
          {currency !== 'KRW' && numAmount > 0 && (
            <div className="bg-sky-50 border border-sky-200/70 rounded-xl p-2.5 text-xs text-sky-900 flex items-center justify-between">
              <div>
                <span className="font-bold">원화 환산 금액: </span>
                <span className="font-extrabold text-sky-700 text-sm">
                  약 {Math.round(liveConvertedKRW).toLocaleString()}원
                </span>
              </div>
              <span className="text-[11px] text-sky-600">(1 {currency} = {currentRate}원)</span>
            </div>
          )}

          {/* 🌟 DUTCH PAY SECTION: Payer (결제자) */}
          <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-amber-900 font-extrabold text-xs">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <span>결제자</span>
              </div>
              {!isAddingNewMember && onAddMember && (
                <button
                  type="button"
                  onClick={() => setIsAddingNewMember(true)}
                  className="text-[11px] font-bold text-amber-700 hover:text-amber-900 underline"
                >
                  + 새 멤버 추가
                </button>
              )}
            </div>

            {/* Member selector chips with delete support */}
            <div className="flex flex-wrap gap-1.5">
              {members.map((member) => (
                <div
                  key={member}
                  onClick={() => setPaidBy(member)}
                  className={`group px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer ${
                    paidBy === member
                      ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                      : 'bg-white text-slate-700 border border-amber-200 hover:bg-amber-100/50'
                  }`}
                >
                  <span>{member}</span>
                  {paidBy === member && <Check className="w-3.5 h-3.5 shrink-0" />}
                  {members.length > 1 && onRemoveMember && (
                    <button
                      type="button"
                      onClick={(e) => handleRemoveMemberClick(member, e)}
                      className={`p-0.5 rounded transition ${
                        paidBy === member
                          ? 'text-amber-200 hover:text-white hover:bg-amber-600'
                          : 'text-slate-400 hover:text-rose-600 hover:bg-slate-100'
                      }`}
                      title={`${member} 멤버 삭제`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Quick add member input */}
            {isAddingNewMember && (
              <div className="flex items-center space-x-1.5 pt-1">
                <input
                  type="text"
                  placeholder="추가할 멤버 이름 (예: C, 친구1, 민수)"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-amber-500 outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddNewMemberSubmit(e);
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddNewMemberSubmit}
                  className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-500 transition"
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingNewMember(false)}
                  className="px-2 py-1.5 text-slate-500 text-xs font-semibold hover:text-slate-700"
                >
                  취소
                </button>
              </div>
            )}
          </div>

          {/* 🌟 DUTCH PAY SECTION: Split with whom? (정산 대상 / N빵 분담) */}
          <div className="bg-sky-50/60 border border-sky-200/80 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1.5 text-sky-900 font-extrabold text-xs">
                <Users className="w-4 h-4 text-sky-600" />
                <span>정산 분담 대상 (N빵)</span>
              </div>
              <button
                type="button"
                onClick={handleSelectAllMembers}
                className="text-[11px] font-bold text-sky-700 hover:text-sky-900 underline cursor-pointer"
                title="모든 멤버를 분담 대상에 포함"
              >
                전체 선택
              </button>
            </div>

            {/* Member checkboxes */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {members.map((member) => {
                const isSelected = splitWith.includes(member);
                return (
                  <button
                    key={member}
                    type="button"
                    onClick={() => handleToggleSplitMember(member)}
                    className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-between border ${
                      isSelected
                        ? 'bg-sky-500 text-white border-sky-600 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-sky-50'
                    }`}
                  >
                    <span>{member}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-black/10">
                      {isSelected ? '분담함' : '제외'}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Per-person calculation feedback */}
            {numAmount > 0 && splitWith.length > 0 && (
              <div className="bg-white/90 p-2.5 rounded-xl border border-sky-100 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">
                  {splitWith.length}명 분담 ({splitWith.join(', ')})
                </span>
                <span className="font-extrabold text-sky-700">
                  1인당 약 {perPersonKRW.toLocaleString()}원
                </span>
              </div>
            )}
          </div>

          {/* Category & Payment Method */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">카테고리</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as CategoryType)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="FOOD">🍽️ 음식 (식비/카페)</option>
                <option value="ACCOMMODATION">🏨 숙박 (호텔/에어비앤비)</option>
                <option value="FLIGHT">✈️ 항공권</option>
                <option value="TRANSPORT">🚕 교통 (지하철/렌트/택시)</option>
                <option value="SIGHTSEEING">🎟️ 관광 & 티켓/체험</option>
                <option value="SHOPPING">🛍️ 쇼핑 & 기념품</option>
                <option value="OTHER">📦 기타 지출</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">결제 수단</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as 'CARD' | 'CASH')}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
              >
                <option value="CARD">💳 신용/체크카드</option>
                <option value="CASH">💵 현금</option>
              </select>
            </div>
          </div>

          {/* Notes / Remarks */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">메모 (선택)</label>
            <input
              type="text"
              placeholder="예: 호텔 전액 A 결제, 항공권 B 일괄 결제"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sky-500 outline-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-md flex items-center space-x-1.5"
            >
              <Check className="w-4 h-4" />
              <span>{editingExpense ? '수정 내용 저장' : '지출 기록 추가'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
