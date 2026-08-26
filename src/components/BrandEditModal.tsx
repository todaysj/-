import React, { useState } from 'react';
import {
  X,
  Check,
  Edit3,
  RotateCcw,
  Compass,
  MapPin,
  Ticket,
  Wallet,
  CheckSquare,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Settings,
  Sliders,
  Lock,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  ListOrdered,
  Plane,
  Calendar,
  Gift
} from 'lucide-react';
import { TabType, Trip } from '../types';

export const DEFAULT_TAB_ORDER: TabType[] = ['itinerary', 'map', 'reservations', 'budget', 'checklist', 'souvenirs'];

export const TAB_CONFIG: Record<TabType, { id: TabType; title: string; desc: string; icon: React.FC<{ className?: string }>; color: string }> = {
  itinerary: {
    id: 'itinerary',
    title: '일자별 일정',
    desc: '타임라인 및 일자별 스케줄 관리',
    icon: Compass,
    color: 'bg-sky-500/15 text-sky-400 border-sky-400/30'
  },
  map: {
    id: 'map',
    title: '동선 지도',
    desc: '방문 장소 위치 및 지도 동선 시각화',
    icon: MapPin,
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-400/30'
  },
  reservations: {
    id: 'reservations',
    title: '예약 서류함',
    desc: '항공권/숙소 바우처, 티켓 QR 보관',
    icon: Ticket,
    color: 'bg-violet-500/15 text-violet-400 border-violet-400/30'
  },
  budget: {
    id: 'budget',
    title: '예산 & 가계부',
    desc: '경비 기록, 환율 계산 및 더치페이 정산',
    icon: Wallet,
    color: 'bg-amber-500/15 text-amber-400 border-amber-400/30'
  },
  checklist: {
    id: 'checklist',
    title: '체크리스트',
    desc: '준비물 패킹 리스트 및 필수 항목 체크',
    icon: CheckSquare,
    color: 'bg-rose-500/15 text-rose-400 border-rose-400/30'
  },
  souvenirs: {
    id: 'souvenirs',
    title: '기념품',
    desc: '사올 물건, 기념품, 사 먹을 음식 및 쇼핑 리스트',
    icon: Gift,
    color: 'bg-pink-500/15 text-pink-400 border-pink-400/30'
  }
};

interface BrandEditModalProps {
  currentTitle: string;
  currentSubtitle: string;
  currentBadge?: string;
  currentTabOrder?: TabType[];
  currentPassword?: string;
  trips?: Trip[];
  onClose: () => void;
  onSave: (title: string, subtitle: string, badge: string, tabOrder: TabType[]) => void;
  onReset: () => void;
  onSavePassword?: (newPassword: string) => void;
  onSaveTripOrder?: (newOrderedTrips: Trip[]) => void;
}

export const BrandEditModal: React.FC<BrandEditModalProps> = ({
  currentTitle,
  currentSubtitle,
  currentBadge = '',
  currentTabOrder = DEFAULT_TAB_ORDER,
  currentPassword = '1205',
  trips = [],
  onClose,
  onSave,
  onReset,
  onSavePassword,
  onSaveTripOrder
}) => {
  const [activeSection, setActiveSection] = useState<'trips' | 'tabs' | 'brand' | 'security'>('trips');
  const [title, setTitle] = useState(currentTitle);
  const [subtitle, setSubtitle] = useState(currentSubtitle);
  const [tabOrder, setTabOrder] = useState<TabType[]>(() => {
    // Ensure all 5 tabs exist in currentTabOrder
    const unique = Array.from(new Set(currentTabOrder));
    for (const key of DEFAULT_TAB_ORDER) {
      if (!unique.includes(key)) unique.push(key);
    }
    return unique;
  });

  // Trip ordering states
  const [orderedTrips, setOrderedTrips] = useState<Trip[]>([...trips]);
  const [tripOrderSaved, setTripOrderSaved] = useState(false);

  // Password change states
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPwText, setShowPwText] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  const handleMoveTrip = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= orderedTrips.length) return;
    const newItems = [...orderedTrips];
    const temp = newItems[index];
    newItems[index] = newItems[newIndex];
    newItems[newIndex] = temp;
    setOrderedTrips(newItems);
  };

  const handleMoveTripToTop = (index: number) => {
    if (index <= 0) return;
    const newItems = [...orderedTrips];
    const [item] = newItems.splice(index, 1);
    newItems.unshift(item);
    setOrderedTrips(newItems);
  };

  const handleMoveTripToBottom = (index: number) => {
    if (index >= orderedTrips.length - 1) return;
    const newItems = [...orderedTrips];
    const [item] = newItems.splice(index, 1);
    newItems.push(item);
    setOrderedTrips(newItems);
  };

  const handleSaveTrips = () => {
    if (onSaveTripOrder) {
      onSaveTripOrder(orderedTrips);
      setTripOrderSaved(true);
      setTimeout(() => setTripOrderSaved(false), 3000);
    }
  };

  const handleMoveTab = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= tabOrder.length) return;

    const updated = [...tabOrder];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    setTabOrder(updated);
  };

  const handleResetTabOrder = () => {
    setTabOrder([...DEFAULT_TAB_ORDER]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave(title.trim(), subtitle.trim(), '', tabOrder);
    onClose();
  };

  const handleResetDefault = () => {
    onReset();
    setTabOrder([...DEFAULT_TAB_ORDER]);
    onClose();
  };

  // Password Change Handler
  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (oldPw.trim() !== currentPassword) {
      setPwError('현재 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (!newPw.trim()) {
      setPwError('새 비밀번호를 입력해주세요.');
      return;
    }

    if (newPw.trim().length < 2) {
      setPwError('비밀번호는 최소 2자리 이상이어야 합니다.');
      return;
    }

    if (newPw.trim() !== confirmPw.trim()) {
      setPwError('새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    if (onSavePassword) {
      onSavePassword(newPw.trim());
      setPwSuccess(true);
      setOldPw('');
      setNewPw('');
      setConfirmPw('');
      setTimeout(() => setPwSuccess(false), 4000);
    }
  };

  const handleResetPasswordToDefault = () => {
    if (confirm('비밀번호를 기본값으로 재설정하시겠습니까?')) {
      if (onSavePassword) {
        onSavePassword('1205');
        setPwSuccess(true);
        setPwError('');
        setOldPw('');
        setNewPw('');
        setConfirmPw('');
        setTimeout(() => setPwSuccess(false), 4000);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-sky-500/20 text-sky-400 rounded-xl border border-sky-400/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">관리자 설정</h3>
              <p className="text-[11px] text-slate-400">메인 탭 순서 변경, 사이트 타이틀 & 비밀번호 관리</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section Switcher Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-3 sm:px-6 pt-2 shrink-0 gap-1 sm:gap-2 overflow-x-auto scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveSection('trips')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition whitespace-nowrap shrink-0 ${
              activeSection === 'trips'
                ? 'border-sky-600 text-sky-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>여행 순서</span>
            <span className="px-1.5 py-0.2 bg-sky-100 text-sky-800 text-[10px] rounded-full font-extrabold">
              {orderedTrips.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('tabs')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition whitespace-nowrap shrink-0 ${
              activeSection === 'tabs'
                ? 'border-sky-600 text-sky-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>탭 순서</span>
            <span className="px-1.5 py-0.2 bg-sky-100 text-sky-800 text-[10px] rounded-full font-extrabold">
              5
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('brand')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition whitespace-nowrap shrink-0 ${
              activeSection === 'brand'
                ? 'border-sky-600 text-sky-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Edit3 className="w-4 h-4" />
            <span>타이틀 문구</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection('security')}
            className={`flex items-center space-x-1.5 py-2.5 px-3 sm:px-4 font-bold text-xs sm:text-sm border-b-2 transition whitespace-nowrap shrink-0 ${
              activeSection === 'security'
                ? 'border-amber-500 text-amber-600 bg-white rounded-t-xl shadow-xs'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>비밀번호 관리</span>
          </button>
        </div>

        {/* Modal Body / Form */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TRIP ORDER REORDER SECTION */}
          {activeSection === 'trips' && (
            <div className="space-y-3.5">
              <div className="bg-sky-50/80 p-3 rounded-xl border border-sky-100 flex items-start space-x-2.5">
                <span className="text-base shrink-0">✈️</span>
                <div className="text-xs text-sky-900 leading-relaxed">
                  <p className="font-bold">여행 일정 표시 순서 변경</p>
                  <p className="mt-0.5 text-sky-800">
                    상단 네비게이션 및 여행 선택 메뉴에 표시되는 여행 목록의 순서를 변경할 수 있습니다.
                  </p>
                </div>
              </div>

              {tripOrderSaved && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center space-x-2 animate-fade-in">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>여행 순서가 성공적으로 저장되었습니다.</span>
                </div>
              )}

              {/* Trip Reorder List */}
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {orderedTrips.map((trip, idx) => {
                  const isFirst = idx === 0;
                  const isLast = idx === orderedTrips.length - 1;

                  return (
                    <div
                      key={trip.id}
                      className="p-3 bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl flex items-center justify-between gap-2.5 transition"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        {trip.coverImage ? (
                          <img
                            src={trip.coverImage}
                            alt={trip.title}
                            className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                            <Plane className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                            {trip.title}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">
                            {trip.destination} · {trip.startDate}
                          </p>
                        </div>
                      </div>

                      {/* Control buttons */}
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveTripToTop(idx)}
                          disabled={isFirst}
                          title="맨 위로 이동"
                          className={`p-1.5 rounded-lg border transition ${
                            isFirst
                              ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-300'
                              : 'border-slate-200 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          <ChevronsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveTrip(idx, 'up')}
                          disabled={isFirst}
                          title="위로 이동"
                          className={`p-1.5 rounded-lg border transition ${
                            isFirst
                              ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-300'
                              : 'border-slate-200 hover:bg-sky-50 hover:border-sky-300 text-slate-700 hover:text-sky-600'
                          }`}
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveTrip(idx, 'down')}
                          disabled={isLast}
                          title="아래로 이동"
                          className={`p-1.5 rounded-lg border transition ${
                            isLast
                              ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-300'
                              : 'border-slate-200 hover:bg-sky-50 hover:border-sky-300 text-slate-700 hover:text-sky-600'
                          }`}
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveTripToBottom(idx)}
                          disabled={isLast}
                          title="맨 아래로 이동"
                          className={`p-1.5 rounded-lg border transition ${
                            isLast
                              ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-300'
                              : 'border-slate-200 hover:bg-slate-200 text-slate-600'
                          }`}
                        >
                          <ChevronsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action Buttons for Trip Order */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setOrderedTrips([...trips])}
                  className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>원래대로 복원</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    닫기
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTrips}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>순서 저장 적용</span>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* TAB ORDER REORDER SECTION */}
          {activeSection === 'tabs' && (
            <div className="space-y-3.5">
              <div className="bg-sky-50/80 p-3 rounded-xl border border-sky-100 flex items-start space-x-2.5">
                <span className="text-base shrink-0">💡</span>
                <p className="text-xs text-sky-900 leading-relaxed">
                  위/아래 버튼(<span className="font-bold">▲ ▼</span>)을 눌러 상단 네비게이션에 표시되는 탭 메뉴의 순서를 자유롭게 변경할 수 있습니다.
                </p>
              </div>

              {/* Tab Reorder List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 px-1">
                  <span>현재 탭 배치 순서 (왼쪽 ➔ 오른쪽)</span>
                  <button
                    type="button"
                    onClick={handleResetTabOrder}
                    className="text-slate-500 hover:text-sky-600 underline font-semibold flex items-center space-x-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>기본 순서로 리셋</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {tabOrder.map((tabKey, index) => {
                    const item = TAB_CONFIG[tabKey];
                    if (!item) return null;
                    const Icon = item.icon;
                    const isFirst = index === 0;
                    const isLast = index === tabOrder.length - 1;

                    return (
                      <div
                        key={tabKey}
                        className="flex items-center justify-between p-3 bg-white border border-slate-200 hover:border-sky-300 rounded-xl shadow-xs transition group"
                      >
                        <div className="flex items-center space-x-3 min-w-0">
                          {/* Order index pill */}
                          <div className="w-6 h-6 rounded-lg bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">
                            {index + 1}
                          </div>

                          {/* Tab Icon & Name */}
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className="p-2 bg-slate-100 text-slate-700 rounded-lg group-hover:bg-sky-50 group-hover:text-sky-600 transition shrink-0">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-800 text-xs sm:text-sm truncate">
                                {item.title}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate">
                                {item.desc}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Up / Down Action Controls */}
                        <div className="flex items-center space-x-1 shrink-0 ml-2">
                          <button
                            type="button"
                            disabled={isFirst}
                            onClick={() => handleMoveTab(index, 'up')}
                            className={`p-1.5 rounded-lg border transition ${
                              isFirst
                                ? 'text-slate-300 bg-slate-50 border-slate-200 cursor-not-allowed'
                                : 'text-slate-700 bg-slate-100 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 border-slate-200'
                            }`}
                            title="위로 이동"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            disabled={isLast}
                            onClick={() => handleMoveTab(index, 'down')}
                            className={`p-1.5 rounded-lg border transition ${
                              isLast
                                ? 'text-slate-300 bg-slate-50 border-slate-200 cursor-not-allowed'
                                : 'text-slate-700 bg-slate-100 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 border-slate-200'
                            }`}
                            title="아래로 이동"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Tab Navigation Live Preview */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-500 block mb-1.5">네비게이션 탭 미리보기</span>
                <div className="p-3 bg-slate-900 rounded-xl overflow-x-auto scrollbar-none flex items-center space-x-2">
                  {tabOrder.map((key, i) => {
                    const cfg = TAB_CONFIG[key];
                    if (!cfg) return null;
                    const Icon = cfg.icon;
                    return (
                      <div
                        key={key}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ${
                          i === 0
                            ? 'bg-sky-500 text-white shadow-xs'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cfg.title}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons for Tab Order */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>기본값 초기화</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>순서 저장 적용</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BRAND TITLE / SUBTITLE SECTION */}
          {activeSection === 'brand' && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-xs text-slate-500 bg-sky-50 p-3 rounded-xl border border-sky-100">
                💡 네비게이션 바 상단에 위치한 메인 브랜드 제목과 로고 옆 서브 타이틀 문구를 원하는 이름으로 자유롭게 수정하실 수 있습니다.
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  메인 타이틀 (기본: J플래너)
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: J플래너, 민우의 트래블로그..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  서브 타이틀 (기본: 스마트 여행 일정 & 예약 보관함)
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="예: 스마트 여행 일정 & 예약 보관함"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-sky-500 focus:bg-white focus:outline-none"
                />
              </div>

              {/* Preview Card */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 block mb-1">헤더 미리보기</span>
                <div className="p-3 bg-slate-900 rounded-xl text-white flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center font-black text-lg">
                    {title.charAt(0) || 'J'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm truncate">{title || 'J플래너'}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{subtitle || '스마트 여행 일정 & 예약 보관함'}</p>
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetDefault}
                  className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>기본값 초기화</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl shadow-sm transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>저장 적용</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* SECURITY / PASSWORD MANAGEMENT SECTION */}
          {activeSection === 'security' && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="bg-amber-50/80 p-3.5 rounded-xl border border-amber-200/80 flex items-start space-x-2.5">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <p className="font-bold">사이트 접속 및 관리자 비밀번호 설정</p>
                  <p className="mt-0.5 text-amber-800">
                    홈페이지 접속 시 및 여행 정보 수정/삭제, 관리자 모드 진입 시 필요한 비밀번호입니다. 여기서 변경하시면 사이트 접속 비밀번호도 함께 변경됩니다.
                  </p>
                </div>
              </div>

              {pwSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-xs font-bold text-emerald-800 animate-in fade-in">
                  <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>비밀번호가 성공적으로 변경 및 저장되었습니다!</span>
                </div>
              )}

              {pwError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-xs font-bold text-rose-700 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{pwError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  현재 비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showPwText ? 'text' : 'password'}
                    required
                    value={oldPw}
                    onChange={(e) => setOldPw(e.target.value)}
                    placeholder="현재 비밀번호 입력"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold tracking-wider focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <button
                    type="button"
                    onClick={() => setShowPwText(!showPwText)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    tabIndex={-1}
                  >
                    {showPwText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  새 비밀번호
                </label>
                <div className="relative">
                  <input
                    type={showPwText ? 'text' : 'password'}
                    required
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="변경할 새 비밀번호"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold tracking-wider focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  새 비밀번호 확인
                </label>
                <div className="relative">
                  <input
                    type={showPwText ? 'text' : 'password'}
                    required
                    value={confirmPw}
                    onChange={(e) => setConfirmPw(e.target.value)}
                    placeholder="새 비밀번호 다시 입력"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold tracking-wider focus:ring-2 focus:ring-amber-500 focus:bg-white focus:outline-none"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Password Section Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleResetPasswordToDefault}
                  className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>기본값으로 재설정</span>
                </button>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                  >
                    닫기
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-sm transition"
                  >
                    <Check className="w-4 h-4" />
                    <span>비밀번호 변경 적용</span>
                  </button>
                </div>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
};
