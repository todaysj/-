import React, { useState } from 'react';
import { X, Plus, Coins, ArrowRight, Check } from 'lucide-react';

interface AddCurrencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (code: string, rate: number) => void;
}

export const AddCurrencyModal: React.FC<AddCurrencyModalProps> = ({
  isOpen,
  onClose,
  onAdd
}) => {
  const [code, setCode] = useState('');
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();
    const numRate = parseFloat(rate);

    if (!cleanCode || cleanCode.length < 2) {
      setError('올바른 통화 코드(2~5자리 영문, 예: NZD, AED)를 입력해주세요.');
      return;
    }
    if (isNaN(numRate) || numRate <= 0) {
      setError('1단위당 원화 환율(0보다 큰 숫자)을 입력해주세요.');
      return;
    }

    onAdd(cleanCode, numRate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-70 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Coins className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-sm">새로운 통화 추가</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-lg transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <p className="text-slate-500 text-[11px] leading-relaxed">
            여행지에서 사용하는 새로운 화폐 단위와 1단위당 원화(KRW) 환율을 등록하면, 일정 및 가계부에서 바로 선택하여 계산할 수 있습니다.
          </p>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700">통화 코드 (영문 3~4자리) *</label>
            <input
              type="text"
              placeholder="예: NZD, AED, SEK, SGD, CHF"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError(null);
              }}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 uppercase focus:ring-2 focus:ring-sky-500 outline-none"
              maxLength={6}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block font-bold text-slate-700">
              1 {code ? code : '통화'}당 원화(KRW) 환율 *
            </label>
            <div className="relative">
              <input
                type="number"
                step="any"
                placeholder="예: 820 (1 NZD = 820원)"
                value={rate}
                onChange={(e) => {
                  setRate(e.target.value);
                  setError(null);
                }}
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
                required
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[11px]">
                원
              </span>
            </div>
            {code && rate && !isNaN(Number(rate)) && (
              <p className="text-[11px] text-sky-600 font-semibold mt-1">
                👉 1 {code} = {Number(rate).toLocaleString()} KRW 로 계산됩니다.
              </p>
            )}
          </div>

          {error && (
            <div className="p-2 bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-[11px] font-semibold">
              {error}
            </div>
          )}

          {/* Quick presets */}
          <div className="pt-1">
            <span className="text-[10px] font-bold text-slate-400 block mb-1.5">자주 찾는 통화 빠른 추가:</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { c: 'SGD', r: 1020, label: '싱가포르달러' },
                { c: 'GBP', r: 1720, label: '영국파운드' },
                { c: 'AUD', r: 890, label: '호주달러' },
                { c: 'CAD', r: 990, label: '캐나다달러' },
                { c: 'IDR', r: 0.085, label: '인도네시아' },
                { c: 'PHP', r: 24, label: '필리핀' },
                { c: 'MYR', r: 300, label: '말레이시아' }
              ].map((preset) => (
                <button
                  key={preset.c}
                  type="button"
                  onClick={() => {
                    setCode(preset.c);
                    setRate(preset.r.toString());
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-sky-50 hover:text-sky-700 border border-slate-200 rounded-lg text-[10px] font-medium transition"
                >
                  {preset.c} ({preset.r}원)
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition text-xs"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold rounded-xl transition text-xs flex items-center gap-1 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>통화 등록</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
