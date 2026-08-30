import React, { useState, useMemo } from 'react';
import { ScheduleItem, CategoryType } from '../types';
import { X, Clock, MapPin, Tag, AlignLeft, DollarSign, Search, ExternalLink, Sparkles, Wallet, Coins, Compass, Check } from 'lucide-react';
import { GooglePlaceSearchModal } from './GooglePlaceSearchModal';
import { CurrencySelector } from './CurrencySelector';
import { convertToKRW, getExchangeRate } from '../utils/currencyUtils';
import { getGoogleMapsUrl, parseGoogleMapsUrlOrCoords, POPULAR_TRAVEL_SPOTS, PlaceSearchResult } from '../utils/placeSearch';

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
  const [isSaving, setIsSaving] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fast inline suggestions based on typed text
  const suggestions = useMemo(() => {
    const trimmed = location.trim().toLowerCase().replace(/\s+/g, '');
    if (!trimmed || trimmed.length < 2) return [];

    const matches: Array<{ name: string; address: string; lat: number; lng: number; category: any }> = [];
    for (const spot of POPULAR_TRAVEL_SPOTS) {
      const matchName = spot.name.toLowerCase().replace(/\s+/g, '').includes(trimmed);
      const matchAlias = spot.aliases.some(
        (a) => a.toLowerCase().replace(/\s+/g, '').includes(trimmed) || trimmed.includes(a.toLowerCase().replace(/\s+/g, ''))
      );
      if (matchName || matchAlias) {
        matches.push(spot);
        if (matches.length >= 4) break;
      }
    }
    return matches;
  }, [location]);

  const handleLocationChange = (val: string) => {
    setLocation(val);
    setShowSuggestions(true);

    // Auto-detect pasted Google Maps link or raw coordinates
    const parsed = parseGoogleMapsUrlOrCoords(val);
    if (parsed) {
      if (parsed.name) {
        setLocation(parsed.name);
      }
      setLat(parsed.lat);
      setLng(parsed.lng);
    } else if (!val.trim()) {
      setLat(undefined);
      setLng(undefined);
    }
  };

  const handleSelectSuggestion = (s: { name: string; address: string; lat: number; lng: number; category: any }) => {
    setLocation(s.name);
    setLat(s.lat);
    setLng(s.lng);
    setShowSuggestions(false);
    if (!title.trim()) {
      setTitle(s.name);
    }
    if (s.category && ['SIGHTSEEING', 'FOOD', 'ACCOMMODATION', 'SHOPPING', 'TRANSPORT', 'OTHER'].includes(s.category)) {
      setCategory(s.category as CategoryType);
    }
  };

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
    setShowSuggestions(false);
  };


  const numCost = Number(cost) || 0;
  const liveConvertedKRW = convertToKRW(numCost, currency, customExchangeRates);
  const currentRate = getExchangeRate(currency, customExchangeRates);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || isSaving) return;

    setIsSaving(true);
    try {
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
    } catch (err) {
      console.error('상세 에러 (EventModal handleSubmit):', err);
      setIsSaving(false);
    }
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

            {/* Location Section with Google Maps Direct Integration */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  장소 / 위치 <span className="text-slate-400 font-normal">(상호, 주소, 또는 지도 링크)</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsPlaceSearchOpen(true)}
                    className="inline-flex items-center space-x-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-2 py-0.5 rounded-lg transition border border-sky-200 cursor-pointer"
                  >
                    <Search className="w-3 h-3 text-sky-500" />
                    <span>지도 핀 검색</span>
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="예: 삼성궁1분 자연산장, 시부야 스카이, 호텔명 (직접 타이핑 가능)"
                  value={location}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                  className="w-full pl-3.5 pr-20 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-sky-500 focus:bg-white outline-none transition shadow-xs"
                />

                {location ? (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleClearLocation}
                      className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition cursor-pointer"
                      title="장소 지우기"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[11px]">
                    📍
                  </div>
                )}

                {/* Inline Fast Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100 divide-y divide-slate-100">
                    <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 flex items-center justify-between">
                      <span>추천 명소 자동완성</span>
                      <button
                        type="button"
                        onClick={() => setShowSuggestions(false)}
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                      >
                        닫기
                      </button>
                    </div>
                    {suggestions.map((s, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSuggestion(s)}
                        className="px-3 py-2 hover:bg-sky-50 cursor-pointer transition flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="font-bold text-xs text-slate-800 truncate">{s.name}</div>
                          <div className="text-[10px] text-slate-400 truncate">{s.address}</div>
                        </div>
                        <span className="text-[10px] font-bold text-sky-600 bg-sky-100 px-1.5 py-0.5 rounded shrink-0">
                          선택
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Google Maps Real-time Auto-link Banner */}
              {location.trim() ? (
                <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50/90 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 shadow-2xs">
                  <div className="flex items-center space-x-1.5 truncate">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                    <span className="font-bold truncate">
                      구글 지도 자동 연동됨
                    </span>
                    {lat !== undefined && lng !== undefined && (
                      <span className="text-[10px] text-emerald-700 font-mono hidden sm:inline">
                        ({lat.toFixed(3)}, {lng.toFixed(3)})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 shrink-0">
                    <a
                      href={getGoogleMapsUrl(location, lat, lng)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-100 font-bold rounded-lg text-[10px] transition cursor-pointer"
                      title="새 창에서 구글 지도로 이 장소 열기"
                    >
                      <span>Google 지도 보기</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 px-1">
                  💡 직접 식당/명소 이름을 적으시면 일정에서 클릭 시 <strong>구글 지도 검색</strong>으로 바로 연결됩니다.
                </p>
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
                disabled={isSaving}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isSaving ? '저장 중...' : '일정 저장'}</span>
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
