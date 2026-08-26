import React, { useState } from 'react';
import { Trip, ScheduleItem, CategoryType } from '../types';
import { Plus, Check, Clock, MapPin, Tag, Trash2, ExternalLink, Download, Edit3, AlertTriangle, AlertCircle, Copy } from 'lucide-react';

interface ItineraryViewProps {
  trip: Trip;
  onToggleDone: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onEditItem?: (item: ScheduleItem) => void;
  onOpenAddModal: (day: number) => void;
  onOpenEditTripModal?: () => void;
  onDeleteTrip?: (tripId: string) => void;
  onDuplicateTrip?: () => void;
  onOpenExportModal?: () => void;
}

export const ItineraryView: React.FC<ItineraryViewProps> = ({
  trip,
  onToggleDone,
  onDeleteItem,
  onEditItem,
  onOpenAddModal,
  onOpenEditTripModal,
  onDeleteTrip,
  onDuplicateTrip,
  onOpenExportModal
}) => {
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [showTripDeleteModal, setShowTripDeleteModal] = useState(false);
  const [scheduleItemToDelete, setScheduleItemToDelete] = useState<ScheduleItem | null>(null);

  // Compute total days from start and end dates
  const getDaysCount = () => {
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
  };

  const totalDays = getDaysCount();
  const dayNumbers = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Filter schedules
  const filteredSchedules = trip.schedule.filter((item) => {
    const matchDay = selectedDay === 0 || item.day === selectedDay;
    const matchCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    return matchDay && matchCategory;
  }).sort((a, b) => a.time.localeCompare(b.time));

  // Category Badge Colors & Labels
  const getCategoryBadge = (cat: CategoryType) => {
    switch (cat) {
      case 'FLIGHT':
        return { label: '항공', bg: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
      case 'ACCOMMODATION':
        return { label: '숙소', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'FOOD':
        return { label: '음식', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'SIGHTSEEING':
        return { label: '관광/체험', bg: 'bg-sky-100 text-sky-800 border-sky-200' };
      case 'SHOPPING':
        return { label: '쇼핑', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'TRANSPORT':
        return { label: '교통', bg: 'bg-orange-100 text-orange-800 border-orange-200' };
      default:
        return { label: '기타', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  // Format Date for Day N
  const getDayDateDayOnly = (dayNum: number) => {
    if (!trip.startDate) return '';
    const parts = trip.startDate.split('-');
    let date: Date;
    if (parts.length === 3) {
      date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      date = new Date(trip.startDate);
    }
    date.setDate(date.getDate() + (dayNum - 1));
    return `${date.getDate()}일`;
  };

  const getDayDateString = (dayNum: number) => {
    if (!trip.startDate) return '';
    const parts = trip.startDate.split('-');
    let date: Date;
    if (parts.length === 3) {
      date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      date = new Date(trip.startDate);
    }
    date.setDate(date.getDate() + (dayNum - 1));
    return `${date.getMonth() + 1}월 ${date.getDate()}일 (${['일', '월', '화', '수', '목', '금', '토'][date.getDay()]})`;
  };

  return (
    <div className="space-y-6">
      {/* Trip Header Banner */}
      <div className="relative rounded-2xl overflow-hidden shadow-xl bg-slate-900 text-white">
        <img
          src={trip.coverImage}
          alt={trip.title}
          className="w-full h-44 sm:h-56 object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent flex flex-col justify-end p-4 sm:p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="px-2.5 sm:px-3 py-1 bg-sky-500/80 text-white text-[11px] sm:text-xs font-bold rounded-full backdrop-blur-md">
                📍 {trip.destination}
              </span>
              <span className="px-2.5 sm:px-3 py-1 bg-slate-800/80 text-slate-200 text-[11px] sm:text-xs font-medium rounded-full backdrop-blur-md border border-slate-700">
                📅 {trip.startDate} ~ {trip.endDate}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              {onDuplicateTrip && (
                <button
                  onClick={onDuplicateTrip}
                  className="inline-flex items-center space-x-1 px-2.5 sm:px-3 py-1 bg-slate-800/90 hover:bg-slate-700/90 text-emerald-300 text-xs font-bold rounded-xl backdrop-blur-md border border-slate-700/80 transition"
                  title="현재 여행 일정 복사하기"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>여행 복사</span>
                </button>
              )}

              {onOpenEditTripModal && (
                <button
                  onClick={onOpenEditTripModal}
                  className="inline-flex items-center space-x-1 px-2.5 sm:px-3 py-1 bg-slate-800/90 hover:bg-slate-700/90 text-sky-300 text-xs font-bold rounded-xl backdrop-blur-md border border-slate-700/80 transition"
                  title="여행명, 날짜, 목적지 등 여행 정보 수정"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>정보 수정</span>
                </button>
              )}

              {onDeleteTrip && (
                <button
                  onClick={() => {
                    onDeleteTrip(trip.id);
                  }}
                  className="inline-flex items-center space-x-1 px-2.5 sm:px-3 py-1 bg-rose-900/60 hover:bg-rose-800/80 text-rose-200 text-xs font-bold rounded-xl backdrop-blur-md border border-rose-700/60 transition"
                  title="현재 여행 일정 삭제"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>삭제</span>
                </button>
              )}

              {onOpenExportModal && (
                <button
                  onClick={onOpenExportModal}
                  className="inline-flex items-center space-x-1 px-2.5 sm:px-3 py-1 bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl backdrop-blur-md border border-indigo-400/40 shadow-sm transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>일정 저장</span>
                </button>
              )}
            </div>
          </div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white mb-2 line-clamp-2">
            {trip.title}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-1 text-xs sm:text-sm text-slate-300">
            <div>
              총 일정 <span className="text-white font-bold">{trip.schedule.length}개</span>
            </div>
            <div>
              완료된 일정 <span className="text-sky-400 font-bold">{trip.schedule.filter(s => s.isDone).length}개</span>
            </div>
            <div>
              예약 서류 <span className="text-amber-300 font-bold">{trip.reservations.length}건</span>
            </div>
          </div>
        </div>
      </div>

      {/* Day Selector Tabs */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none touch-pan-x -mx-1 px-1">
          <button
            onClick={() => setSelectedDay(0)}
            className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap shrink-0 ${
              selectedDay === 0
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 일정 ({trip.schedule.length})
          </button>

          {dayNumbers.map((dayNum) => (
            <button
              key={dayNum}
              onClick={() => setSelectedDay(dayNum)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition whitespace-nowrap flex items-center space-x-1.5 shrink-0 ${
                selectedDay === dayNum
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Day {dayNum}</span>
              <span className="text-[10px] opacity-75">({getDayDateDayOnly(dayNum)})</span>
            </button>
          ))}
        </div>

        {/* Add Event Button for active day */}
        <button
          onClick={() => onOpenAddModal(selectedDay === 0 ? 1 : selectedDay)}
          className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>{selectedDay > 0 ? `Day ${selectedDay} 일정 추가` : '새 일정 추가'}</span>
        </button>
      </div>

      {/* Filter by Category Bar */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto pb-1 text-xs text-slate-600 scrollbar-none touch-pan-x">
        <span className="font-semibold text-slate-400 mr-0.5 flex items-center shrink-0">
          <Tag className="w-3.5 h-3.5 mr-1" /> 카테고리:
        </span>
        {['ALL', 'FLIGHT', 'ACCOMMODATION', 'FOOD', 'SIGHTSEEING', 'SHOPPING', 'TRANSPORT'].map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap shrink-0 ${
              selectedCategory === cat
                ? 'bg-slate-800 text-white font-bold'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {cat === 'ALL' ? '전체' : getCategoryBadge(cat as CategoryType).label}
          </button>
        ))}
      </div>

      {/* Timeline Schedule Items */}
      {filteredSchedules.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 sm:p-12 text-center border border-dashed border-slate-300">
          <AlertCircle className="w-10 h-10 sm:w-12 sm:h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-700 mb-1">등록된 일정이 없습니다</h3>
          <p className="text-xs text-slate-500 mb-4 max-w-md mx-auto">
            MBTI J형의 완벽한 여행을 위해 아래 버튼으로 알찬 세부 일정을 추가해보세요!
          </p>
          <button
            onClick={() => onOpenAddModal(selectedDay === 0 ? 1 : selectedDay)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-sky-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-sky-500"
          >
            <Plus className="w-4 h-4" />
            <span>일정 작성하기</span>
          </button>
        </div>
      ) : (
        <div className="relative border-l-2 border-sky-200 ml-2.5 sm:ml-6 space-y-4 sm:space-y-6">
          {filteredSchedules.map((item) => {
            const badge = getCategoryBadge(item.category);
            return (
              <div
                key={item.id}
                className={`relative pl-4 sm:pl-8 group transition ${
                  item.isDone ? 'opacity-65' : ''
                }`}
              >
                {/* Timeline Dot Indicator */}
                <div
                  className={`absolute -left-[10px] sm:-left-[11px] top-1.5 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center transition shrink-0 ${
                    item.isDone
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                      : 'border-sky-500 text-sky-600'
                  }`}
                >
                  {item.isDone && <Check className="w-3 h-3 stroke-[3]" />}
                </div>

                {/* Event Card */}
                <div className="bg-white rounded-2xl p-3.5 sm:p-5 shadow-sm border border-slate-200 hover:shadow-md transition">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-2">
                    
                    {/* Time & Badges */}
                    <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap gap-y-1">
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-900 text-white text-xs font-bold rounded-lg shrink-0">
                        <Clock className="w-3 h-3 mr-0.5 text-sky-400" />
                        <span>{item.time}{item.endTime ? ` ~ ${item.endTime}` : ''}</span>
                      </span>

                      {selectedDay === 0 && (
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-xs rounded border border-slate-200 shrink-0">
                          Day {item.day}
                        </span>
                      )}

                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-md border shrink-0 ${badge.bg}`}>
                        {badge.label}
                      </span>

                      {item.bookingRef && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium rounded-md break-all">
                          🎫 예약: {item.bookingRef}
                        </span>
                      )}
                    </div>

                    {/* Actions: Edit, Complete & Delete */}
                    <div className="flex items-center space-x-1 self-end sm:self-auto shrink-0">
                      {onEditItem && (
                        <button
                          onClick={() => onEditItem(item)}
                          className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                          title="일정 수정"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => onToggleDone(item.id)}
                        className={`inline-flex items-center space-x-1 px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition ${
                          item.isDone
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{item.isDone ? '완료됨' : '완료 체크'}</span>
                      </button>

                      <button
                        onClick={() => setScheduleItemToDelete(item)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="일정 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Location */}
                  <h3 className={`text-base sm:text-lg font-bold text-slate-800 break-words ${item.isDone ? 'line-through text-slate-500' : ''}`}>
                    {item.title}
                  </h3>

                  {item.location ? (
                    <div className="flex items-center space-x-2 text-xs text-slate-600 mt-1.5 flex-wrap gap-y-1">
                      <span className="flex items-center font-medium text-slate-700 break-words">
                        <MapPin className="w-3.5 h-3.5 text-rose-500 mr-1 shrink-0" />
                        <span>{item.location}</span>
                      </span>

                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-sky-600 hover:text-sky-800 font-semibold text-[11px] hover:underline shrink-0"
                      >
                        지도 보기 <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </div>
                  ) : null}

                  {/* Cost & Notes */}
                  {(item.notes || item.cost > 0) && (
                    <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2">
                      {item.notes ? (
                        <p className="text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200/60 flex-1 break-words">
                          💡 <span className="font-semibold text-slate-700">메모:</span> {item.notes}
                        </p>
                      ) : <div />}

                      {item.cost > 0 && (
                        <div className="text-right font-bold text-slate-800 text-xs sm:text-sm bg-amber-50 text-amber-900 px-3 py-1.5 rounded-lg border border-amber-200/60 whitespace-nowrap self-start sm:self-auto shrink-0 flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-200/70 px-1.5 py-0.5 rounded">가계부 연동</span>
                          <span>금액: {item.cost.toLocaleString()} {item.currency}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Item Delete Modal */}
      {scheduleItemToDelete && (
        <div
          onClick={() => setScheduleItemToDelete(null)}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-base">일정을 삭제하시겠습니까?</h3>
                <span className="text-[11px] font-bold text-slate-400">Day {scheduleItemToDelete.day} · {scheduleItemToDelete.time}</span>
              </div>
            </div>

            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              '<span className="font-bold text-slate-900">{scheduleItemToDelete.title}</span>' 일정을 삭제하시겠습니까?
              {scheduleItemToDelete.cost > 0 && (
                <span className="block mt-1.5 text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-200/60 font-semibold">
                  💡 연동된 가계부 지출 항목({scheduleItemToDelete.cost.toLocaleString()} {scheduleItemToDelete.currency})도 함께 정리됩니다.
                </span>
              )}
            </p>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setScheduleItemToDelete(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (scheduleItemToDelete) {
                    onDeleteItem(scheduleItemToDelete.id);
                  }
                  setScheduleItemToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-sm cursor-pointer"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Delete Modal */}
      {showTripDeleteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">여행 일정 삭제</h3>
            </div>
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              '<span className="font-bold text-slate-900">{trip.title}</span>' 일정을 정말 삭제하시겠습니까?
              <span className="block mt-1 text-slate-400">속해있는 세부 일정, 가계부, 예약 서류가 함께 삭제되며 복구할 수 없습니다.</span>
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowTripDeleteModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteTrip) {
                    onDeleteTrip(trip.id);
                  }
                  setShowTripDeleteModal(false);
                }}
                className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition shadow-sm"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
