import React, { useState } from 'react';
import { Trip } from '../types';
import { X, Plane } from 'lucide-react';

interface NewTripModalProps {
  onClose: () => void;
  onSave: (trip: Trip) => void;
}

export const NewTripModal: React.FC<NewTripModalProps> = ({ onClose, onSave }) => {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('2026-10-04');
  const [totalBudget, setTotalBudget] = useState('1000000');
  const [currency, setCurrency] = useState('KRW');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destination.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const newTrip: Trip = {
        id: `trip-${Date.now()}`,
        title: title.trim(),
        destination: destination.trim(),
        startDate,
        endDate,
        coverImage: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80',
        totalBudget: Number(totalBudget) || 1000000,
        currency,
        schedule: [],
        reservations: [],
        expenses: [],
        packingList: [
          { id: 'p1', category: '필수 준비물', title: '여권/신분증 지참', isPacked: false, isEssential: true },
          { id: 'p2', category: '필수 준비물', title: '스마트폰 충전기 & 보조배터리', isPacked: false, isEssential: true }
        ]
      };

      onSave(newTrip);
      onClose();
    } catch (err) {
      console.error('상세 에러 (NewTripModal handleSubmit):', err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
          <h3 className="font-extrabold text-base flex items-center">
            <Plane className="w-5 h-5 text-sky-400 mr-2" /> 새 여행 플랜 생성
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">여행 제목 *</label>
            <input
              type="text"
              placeholder="예: 후쿠오카 2박 3일 온천 여행"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">여행지 *</label>
            <input
              type="text"
              placeholder="예: 후쿠오카, 일본"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">출발일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">도착일 (귀국일)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">총 예산 (KRW)</label>
            <input
              type="number"
              placeholder="1000000"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
            >
              <span>{isSaving ? '저장 중...' : '플랜 만들기'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
