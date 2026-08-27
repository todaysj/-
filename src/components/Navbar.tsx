import React, { useState } from 'react';
import { Trip, TabType } from '../types';
import { Compass, Calendar, Plus, MapPin, CheckSquare, Ticket, Wallet, Edit3, Download, Trash2, AlertTriangle, Settings, Sliders, Copy, ListOrdered, Gift, Lock, Share2 } from 'lucide-react';
import { getTripChecklistTabs, getTripSouvenirTabs } from '../utils/tabUtils';

interface NavbarProps {
  trips: Trip[];
  activeTrip: Trip;
  onSelectTrip: (tripId: string) => void;
  onOpenNewTripModal: () => void;
  onOpenEditTripModal?: () => void;
  onDeleteTrip?: (tripId: string) => void;
  onDuplicateTrip?: () => void;
  onOpenTripOrderModal?: () => void;
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  brandTitle: string;
  brandSubtitle: string;
  brandBadge: string;
  tabOrder?: TabType[];
  onOpenBrandModal: () => void;
  onOpenExportModal: () => void;
  onLockSite?: () => void;
}

const DEFAULT_NAV_TABS: TabType[] = ['itinerary', 'map', 'reservations', 'budget', 'checklist', 'souvenirs'];

export const Navbar: React.FC<NavbarProps> = ({
  trips,
  activeTrip,
  onSelectTrip,
  onOpenNewTripModal,
  onOpenEditTripModal,
  onDeleteTrip,
  onDuplicateTrip,
  onOpenTripOrderModal,
  activeTab,
  onChangeTab,
  brandTitle,
  brandSubtitle,
  brandBadge,
  tabOrder = DEFAULT_NAV_TABS,
  onOpenBrandModal,
  onOpenExportModal,
  onLockSite
}) => {
  const checklistTabs = getTripChecklistTabs(activeTrip);
  const souvenirTabs = getTripSouvenirTabs(activeTrip);

  // Calculate D-day
  const calculateDDay = (startDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    const diffTime = start.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'D-Day!';
    if (diffDays > 0) return `D-${diffDays}`;
    return `D+${Math.abs(diffDays)}`;
  };

  const dDayText = calculateDDay(activeTrip.startDate);

  // Render Tab Item Helper
  const renderTabButton = (tabKey: TabType) => {
    const isActive = activeTab === tabKey;

    switch (tabKey) {
      case 'itinerary':
        return (
          <button
            key="itinerary"
            onClick={() => onChangeTab('itinerary')}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
              isActive
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Compass className="w-4 h-4 shrink-0" />
            <span>일자별 일정</span>
            <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${
              isActive ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300'
            }`}>
              {activeTrip.schedule.length}
            </span>
          </button>
        );

      case 'map':
        return (
          <button
            key="map"
            onClick={() => onChangeTab('map')}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
              isActive
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span>동선 지도</span>
          </button>
        );

      case 'reservations':
        return (
          <button
            key="reservations"
            onClick={() => onChangeTab('reservations')}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
              isActive
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Ticket className="w-4 h-4 shrink-0" />
            <span>예약 서류함</span>
            <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${
              isActive ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300'
            }`}>
              {activeTrip.reservations.length}
            </span>
          </button>
        );

      case 'budget':
        return (
          <button
            key="budget"
            onClick={() => onChangeTab('budget')}
            className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
              isActive
                ? 'bg-sky-500 text-white shadow-md'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Wallet className="w-4 h-4 shrink-0" />
            <span>예산 & 가계부</span>
          </button>
        );

      case 'checklist':
        if (checklistTabs.length === 0) return null;

        if (checklistTabs.length === 1) {
          const singleTab = checklistTabs[0];
          const isChecklistActive = activeTab === 'checklist' || activeTab === `checklist:${singleTab.id}`;
          const unPackedCount = (singleTab.items || []).filter((p) => !p.isPacked).length;
          return (
            <button
              key={`checklist-${singleTab.id}`}
              onClick={() => onChangeTab(`checklist:${singleTab.id}`)}
              className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                isChecklistActive
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              <span>{singleTab.title || '체크리스트'}</span>
              {unPackedCount > 0 && (
                <span className="text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black shrink-0">
                  {unPackedCount}
                </span>
              )}
            </button>
          );
        }

        // Multiple Checklist Tabs -> render each person/category tab
        return (
          <React.Fragment key="checklist-group">
            {checklistTabs.map((cTab, idx) => {
              const isTabActive = activeTab === `checklist:${cTab.id}` || (activeTab === 'checklist' && idx === 0);
              const unPacked = (cTab.items || []).filter((p) => !p.isPacked).length;
              return (
                <button
                  key={`checklist-${cTab.id}`}
                  onClick={() => onChangeTab(`checklist:${cTab.id}`)}
                  className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    isTabActive
                      ? 'bg-sky-500 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                  title={cTab.subtitle || cTab.title}
                >
                  <CheckSquare className="w-4 h-4 shrink-0" />
                  <span>{cTab.title}</span>
                  {unPacked > 0 && (
                    <span className="text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full bg-rose-500 text-white font-black shrink-0">
                      {unPacked}
                    </span>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        );

      case 'souvenirs':
        if (souvenirTabs.length === 0) return null;

        if (souvenirTabs.length === 1) {
          const singleTab = souvenirTabs[0];
          const isSouvenirActive = activeTab === 'souvenirs' || activeTab === `souvenirs:${singleTab.id}`;
          const unpurchasedCount = (singleTab.items || []).filter((s) => !s.isPurchased).length;
          const totalCount = (singleTab.items || []).length;
          return (
            <button
              key={`souvenirs-${singleTab.id}`}
              onClick={() => onChangeTab(`souvenirs:${singleTab.id}`)}
              className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                isSouvenirActive
                  ? 'bg-sky-500 text-white shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Gift className="w-4 h-4 shrink-0 text-pink-400" />
              <span>{singleTab.title || '기념품'}</span>
              {totalCount > 0 && (
                <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${
                  unpurchasedCount > 0
                    ? (isSouvenirActive ? 'bg-amber-400 text-slate-950 font-black' : 'bg-amber-500 text-white font-black')
                    : (isSouvenirActive ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300')
                }`}>
                  {unpurchasedCount > 0 ? `${unpurchasedCount}` : '완료'}
                </span>
              )}
            </button>
          );
        }

        // Multiple Souvenir Tabs -> render each person/category tab
        return (
          <React.Fragment key="souvenirs-group">
            {souvenirTabs.map((sTab, idx) => {
              const isTabActive = activeTab === `souvenirs:${sTab.id}` || (activeTab === 'souvenirs' && idx === 0);
              const unpurchased = (sTab.items || []).filter((s) => !s.isPurchased).length;
              const total = (sTab.items || []).length;
              return (
                <button
                  key={`souvenirs-${sTab.id}`}
                  onClick={() => onChangeTab(`souvenirs:${sTab.id}`)}
                  className={`flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                    isTabActive
                      ? 'bg-sky-500 text-white shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <Gift className="w-4 h-4 shrink-0 text-pink-400" />
                  <span>{sTab.title}</span>
                  {total > 0 && (
                    <span className={`text-[10px] sm:text-xs px-1.5 py-0.2 rounded-full font-bold ${
                      unpurchased > 0
                        ? (isTabActive ? 'bg-amber-400 text-slate-950 font-black' : 'bg-amber-500 text-white font-black')
                        : (isTabActive ? 'bg-sky-700 text-white' : 'bg-slate-800 text-slate-300')
                    }`}>
                      {unpurchased > 0 ? `${unpurchased}` : '완료'}
                    </span>
                  )}
                </button>
              );
            })}
          </React.Fragment>
        );

      default:
        return null;
    }
  };

  return (
    <header className="bg-slate-900 text-white shadow-lg sticky top-0 z-30">
      {/* Top Banner & Trip Switcher */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between py-2.5 sm:py-3 border-b border-slate-800 gap-2.5 sm:gap-3 lg:gap-0">
          
          {/* Logo & Brand Title */}
          <div className="flex items-center justify-between lg:justify-start space-x-3 w-full lg:w-auto">
            <div className="flex items-center space-x-2.5 group cursor-pointer" onClick={onOpenBrandModal} title="관리자 설정 (탭 순서 및 사이트 타이틀 수정)">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-black text-lg sm:text-xl shadow-md tracking-wider shrink-0">
                {brandTitle.charAt(0) || 'J'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-white group-hover:text-sky-300 transition truncate">
                    <span className="truncate">{brandTitle}</span>
                  </h1>
                </div>
                <p className="text-[11px] text-slate-400 group-hover:text-slate-300 transition hidden sm:block truncate">
                  {brandSubtitle}
                </p>
              </div>
            </div>

            {/* D-Day badge for mobile */}
            <div className="flex items-center space-x-1.5 lg:hidden">
              <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold rounded-full shrink-0">
                {dDayText}
              </span>
            </div>
          </div>

          {/* Trip Selector Dropdown & Actions */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 w-full lg:w-auto justify-between lg:justify-end flex-wrap gap-y-2">
            
            {/* Trip selector with Quick Edit & Delete */}
            <div className="flex items-center space-x-1 flex-1 sm:flex-initial min-w-[150px] max-w-full sm:max-w-xs">
              <div className="relative flex-1 sm:min-w-[170px]">
                <select
                  value={activeTrip.id}
                  onChange={(e) => onSelectTrip(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm rounded-xl px-2.5 sm:px-3 py-2 pr-7 sm:pr-8 font-semibold focus:ring-2 focus:ring-sky-500 focus:outline-none cursor-pointer appearance-none truncate"
                >
                  {trips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      ✈️ {trip.title}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-xs">
                  ▼
                </div>
              </div>

              {onOpenTripOrderModal && (
                <button
                  onClick={onOpenTripOrderModal}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-sky-300 rounded-xl border border-slate-700 transition shrink-0"
                  title="여행 순서 변경 (목록 표시 순서 조정)"
                >
                  <ListOrdered className="w-4 h-4" />
                </button>
              )}

              {onOpenEditTripModal && (
                <button
                  onClick={onOpenEditTripModal}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-sky-300 rounded-xl border border-slate-700 transition shrink-0"
                  title="현재 여행 정보 수정 (여행명, 일자, 장소 등)"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              {onDeleteTrip && (
                <button
                  onClick={() => onDeleteTrip(activeTrip.id)}
                  className="p-2 bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded-xl border border-slate-700 hover:border-rose-700 transition shrink-0"
                  title="현재 여행 삭제 (비밀번호 확인 필요)"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Action Buttons Group */}
            <div className="flex items-center space-x-1.5 shrink-0">
              {/* New Trip Button */}
              <button
                onClick={onOpenNewTripModal}
                className="inline-flex items-center space-x-1 px-2.5 sm:px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition shadow-sm whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>새 여행</span>
              </button>

              {/* Copy Trip Button */}
              {onDuplicateTrip && (
                <button
                  onClick={onDuplicateTrip}
                  className="hidden sm:inline-flex items-center space-x-1 px-2.5 sm:px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition border border-slate-700 whitespace-nowrap shrink-0"
                  title="현재 여행 일정을 복사하여 새 여행 생성"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>여행 복사</span>
                </button>
              )}

              {/* Export Trip File Button */}
              <button
                onClick={onOpenExportModal}
                className="inline-flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow-sm whitespace-nowrap shrink-0"
                title="완성된 일정을 파일로 저장"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">일정</span><span>파일 저장</span>
              </button>

              {/* Admin / Brand & Tab Order Edit Button */}
              <button
                onClick={onOpenBrandModal}
                className="hidden md:inline-flex items-center space-x-1.5 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-xl transition border border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                title="관리자 설정 (탭 순서 및 문구 변경, 비밀번호 확인 필요)"
              >
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>관리자 설정</span>
              </button>

              {/* Lock Site Button */}
              {onLockSite && (
                <button
                  onClick={onLockSite}
                  className="inline-flex items-center space-x-1 px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-300 text-xs font-semibold rounded-xl transition border border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
                  title="사이트 화면 잠금 (비밀번호 입력 화면으로 전환)"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">잠금</span>
                </button>
              )}

              {/* D-Day Badge for Desktop */}
              <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold rounded-full shrink-0">
                <Calendar className="w-3.5 h-3.5" />
                <span>{dDayText}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Multi-Trip Quick Selector Bar (When 2 or more trips exist) */}
        {trips.length > 1 && (
          <div className="flex items-center space-x-2 py-2 overflow-x-auto scrollbar-none border-b border-slate-800/80 -mx-3 px-3 sm:mx-0 sm:px-0">
            <span className="text-[11px] text-slate-400 font-bold shrink-0 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              여행 선택:
            </span>
            {trips.map((trip) => {
              const isSelected = trip.id === activeTrip.id;
              const schedCount = trip.schedule?.length || 0;
              return (
                <button
                  key={`quick-trip-${trip.id}`}
                  onClick={() => onSelectTrip(trip.id)}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-bold transition shrink-0 whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-md ring-1 ring-sky-400/80'
                      : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                  }`}
                >
                  <span>✈️ {trip.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-sky-900/80 text-sky-100' : 'bg-slate-900/80 text-slate-300'
                  }`}>
                    일정 {schedCount}개
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Tab Navigation Menu (Touch & Scroll-friendly for mobile, customizable order) */}
        <nav className="flex space-x-1.5 sm:space-x-2 overflow-x-auto py-2 scrollbar-none touch-pan-x -mx-3 px-3 sm:mx-0 sm:px-0">
          {tabOrder.map((tabKey) => renderTabButton(tabKey))}
        </nav>
      </div>
    </header>
  );
};
