import React, { useState } from 'react';
import { ScheduleItem, CategoryType } from '../types';
import { X, Clock, MapPin, Tag, AlignLeft, DollarSign, Search, ExternalLink, Sparkles, Wallet, Coins } from 'lucide-react';
import { GooglePlaceSearchModal } from './GooglePlaceSearchModal';
import { CurrencySelector } from './CurrencySelector';
import { convertToKRW, getExchangeRate } from '../utils/currencyUtils';

interface EventModalProps {
  day: number;
  onClose: () => void;
  onSave: (item: ScheduleItem) => void;
  editingItem?: ScheduleItem | null;
  totalDays?: number;
  tripDestination?: string;
  customExchangeRates?: Record<string, number>;
  onAddCustomCurrency?: (code: string, rate: number) => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  day,
  onClose,
  onSave,
  editingItem,
  totalDays = 10,
  tripDestination = '',
  customExchangeRates,
  onAddCustomCurrency
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(editingItem ? editingItem.day : day);
  const [title, setTitle] = useState(editingItem ? editingItem.title : '');
  const [time, setTime] = useState(editingItem ? editingItem.time : '10:00');
  const [endTime, setEndTime] = useState(editingItem ? editingItem.endTime || '' : '');
  const [category, setCategory] = useState<CategoryType>(editingItem ? editingItem.category : 'SIGHTSEEING');
  const [location, setLocation] = useState(editingItem ? editingItem.location : '');
  const [lat, setLat] = useState<number | undefined>(editingItem?.lat);
  const [lng, setLng] = useState<number | undefined>(editingItem?.lng);
  const [cost, setCost] = useState(editingItem && editingItem.cost > 0 ? editingItem.cost.toString() : '');
  const [currency, setCurrency] = useState(editingItem ? editingItem.currency : 'KRW');
  const [notes, setNotes] = useState(editingItem ? editingItem.notes || '' : '');
  const [bookingRef, setBookingRef] = useState(editingItem ? editingItem.bookingRef || '' : '');

  // Google Maps Search Modal State
  const [isPlaceSearchOpen, setIsPlaceSearchOpen] = useState(false);

  const handlePlaceSelect = (place: { name: string; address: string; lat: number; lng: number; category?: string }) => {
    setLocation(place.name);
    if (place.lat && place.lng) {
      setLat(place.lat);
      setLng(place.lng);
    }
    // If title is currently empty, suggest place name as title
    if (!title.trim()) {
      setTitle(place.name);
    }
    // If category is provided, optionally align category
    if (place.category && ['SIGHTSEEING', 'FOOD', 'ACCOMMODATION', 'SHOPPING', 'TRANSPORT', 'OTHER'].includes(place.category)) {
      setCategory(place.category as CategoryType);
    }
  };

  const handleClearLocation = () => {
    setLocation('');
    setLat(undefined);
    setLng(undefined);
  };

  const numCost = Number(cost) || 0;
  const liveConvertedKRW = convertToKRW(numCost, currency, customExchangeRates);
  const currentRate = getExchangeRate(currency, customExchangeRates);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      id: editingItem ? editingItem.id : `evt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      day: selectedDay,
      time,
      endTime: endTime.trim() ? endTime.trim() : undefined,
      title: title.trim(),
      category,
      location: location.trim(),
      lat: lat && !isNaN(lat) ? lat : undefined,
      lng: lng && !isNaN(lng) ? lng : undefined,
      cost: numCost,
      currency,
      notes: notes.trim(),
      bookingRef: bookingRef.trim(),
      isDone: editingItem ? editingItem.isDone : false
    });

    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
        <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col">
          {/* Modal Header */}
          <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <h3 className="font-extrabold text-sm sm:text-base">
              {editingItem ? `Day ${selectedDay} 일정 수정` : `Day ${selectedDay} 새 일정 추가`}
            </h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition text-slate-400">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">일차 (Day)</label>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(Number(e.target.value))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  {Array.from({ length: Math.max(10, totalDays) }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      Day {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-700 mb-1">일정 제목 *</label>
                <input
                  type="text"
                  placeholder="예: 시부야 스카이 전망대 관람"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">시작 시간 *</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  종료 시간 <span className="text-slate-400 font-normal">(선택)</span>
                </label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">카테고리</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as CategoryType)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  <option value="SIGHTSEEING">관광/체험</option>
                  <option value="FOOD">음식/카페</option>
                  <option value="SHOPPING">쇼핑</option>
                  <option value="TRANSPORT">교통</option>
                  <option value="ACCOMMODATION">숙소</option>
                  <option value="FLIGHT">항공</option>
                  <option value="OTHER">기타</option>
                </select>
              </div>
            </div>

            {/* Location Section with Google Maps Search Integration */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  장소 / 주소 <span className="text-slate-400 font-normal">(선택)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsPlaceSearchOpen(true)}
                  className="inline-flex items-center space-x-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2.5 py-1 rounded-lg transition border border-sky-200/80 cursor-pointer"
                >
                  <Search className="w-3 h-3 text-sky-500" />
                  <span>구글지도 검색</span>
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="예: 시부야 스카이 (입력하지 않아도 일정 저장이 가능합니다)"
                  value={location}
                  onChange={(e) => {
                    setLocation(e.target.value);
                    if (!e.target.value) {
                      setLat(undefined);
                      setLng(undefined);
                    }
                  }}
                  className="w-full pl-3.5 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                />

                {location ? (
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-md transition"
                    title="장소 지우기"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPlaceSearchOpen(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-white hover:bg-slate-100 text-slate-500 border border-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                  >
                    <MapPin className="w-3 h-3 text-sky-500" />
                    검색
                  </button>
                )}
              </div>

              {/* Coordinates Connected Badge */}
              {lat !== undefined && lng !== undefined && (
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-sky-50/80 border border-sky-200 rounded-lg text-[11px] text-sky-800">
                  <div className="flex items-center space-x-1.5 truncate">
                    <MapPin className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span className="font-semibold truncate">
                      지도 좌표 연결됨: {lat.toFixed(4)}, {lng.toFixed(4)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-600 hover:underline flex items-center font-bold text-[10px]"
                    >
                      지도 <ExternalLink className="w-2.5 h-2.5 ml-0.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setLat(undefined);
                        setLng(undefined);
                      }}
                      className="text-slate-400 hover:text-slate-600"
                      title="좌표 연결 해제"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 🌟 Amount (금액) & Currency Selection Section */}
            <div className="bg-amber-50/50 border border-amber-200/70 rounded-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-amber-900 font-extrabold text-xs">
                  <Wallet className="w-4 h-4 text-amber-600" />
                  <span>금액 및 통화 (선택)</span>
                </div>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                  예산&가계부 자동 연동
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">금액</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">통화</label>
                  <CurrencySelector
                    value={currency}
                    onChange={setCurrency}
                    customExchangeRates={customExchangeRates}
                    onAddCustomCurrency={onAddCustomCurrency}
                    className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>
              </div>

              {/* Converted Amount Preview & Auto-Sync Notice */}
              {numCost > 0 ? (
                <div className="bg-white/90 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 space-y-1">
                  <div className="flex items-center justify-between font-bold">
                    <span>원화 환산 금액:</span>
                    <span className="text-amber-800 text-sm font-extrabold">
                      약 {Math.round(liveConvertedKRW).toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-amber-700 pt-1 border-t border-amber-100">
                    <span>(1 {currency} = {currentRate}원)</span>
                    <span className="flex items-center gap-1 font-semibold text-sky-700">
                      <Sparkles className="w-3 h-3 text-amber-500" />
                      저장 시 [예산&가계부]에 자동 기록됩니다
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">
                  💡 금액을 입력하면 [예산&가계부] 탭에 해당 날짜의 지출 항목으로 자동 등록되어 총 지출에 반영됩니다.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">예약 번호 (선택)</label>
              <input
                type="text"
                placeholder="예: KLK-88231"
                value={bookingRef}
                onChange={(e) => setBookingRef(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">메모 & 팁 (선택)</label>
              <textarea
                placeholder="예: 18시 예약, 바우처 QR코드 제시 필수"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
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
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                일정 저장
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Google Place Search Modal */}
      {isPlaceSearchOpen && (
        <GooglePlaceSearchModal
          initialQuery={location || title}
          destination={tripDestination}
          onClose={() => setIsPlaceSearchOpen(false)}
          onSelectPlace={handlePlaceSelect}
        />
      )}
    </>
  );
};
