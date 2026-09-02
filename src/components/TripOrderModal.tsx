import React, { useState } from 'react';
import { Trip } from '../types';
import { cleanTripTitle } from '../utils/dateUtils';
import {
  X,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Plane,
  Calendar,
  MapPin,
  Check,
  RotateCcw,
  ListOrdered
} from 'lucide-react';

interface TripOrderModalProps {
  trips: Trip[];
  onClose: () => void;
  onSaveTripOrder: (newOrderedTrips: Trip[]) => void;
}

export const TripOrderModal: React.FC<TripOrderModalProps> = ({
  trips,
  onClose,
  onSaveTripOrder
}) => {
  const [orderedTrips, setOrderedTrips] = useState<Trip[]>([...trips]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newItems = [...orderedTrips];
    const temp = newItems[index];
    newItems[index] = newItems[index - 1];
    newItems[index - 1] = temp;
    setOrderedTrips(newItems);
  };

  const handleMoveDown = (index: number) => {
    if (index >= orderedTrips.length - 1) return;
    const newItems = [...orderedTrips];
    const temp = newItems[index];
    newItems[index] = newItems[index + 1];
    newItems[index + 1] = temp;
    setOrderedTrips(newItems);
  };

  const handleMoveToTop = (index: number) => {
    if (index <= 0) return;
    const newItems = [...orderedTrips];
    const [item] = newItems.splice(index, 1);
    newItems.unshift(item);
    setOrderedTrips(newItems);
  };

  const handleMoveToBottom = (index: number) => {
    if (index >= orderedTrips.length - 1) return;
    const newItems = [...orderedTrips];
    const [item] = newItems.splice(index, 1);
    newItems.push(item);
    setOrderedTrips(newItems);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const newItems = [...orderedTrips];
    const [removed] = newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, removed);
    setOrderedTrips(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleReset = () => {
    setOrderedTrips([...trips]);
  };

  const handleSave = () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      onSaveTripOrder(orderedTrips);
      onClose();
    } catch (err) {
      console.error('상세 에러 (TripOrderModal handleSave):', err);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-400">
              <ListOrdered className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                <span>여행 순서 변경</span>
                <span className="text-xs px-2 py-0.5 bg-sky-500/20 text-sky-300 font-semibold rounded-full border border-sky-400/20">
                  총 {orderedTrips.length}개
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                화살표 버튼을 클릭하거나 카드를 드래그하여 원하는 순서로 배치하세요.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body - Trip Items List */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-2.5 flex-1 bg-slate-50">
          {orderedTrips.map((trip, index) => {
            const isFirst = index === 0;
            const isLast = index === orderedTrips.length - 1;
            const isDragging = draggedIndex === index;
            const isOver = dragOverIndex === index;

            return (
              <div
                key={trip.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                className={`p-3.5 bg-white rounded-2xl border transition-all duration-150 flex items-center justify-between gap-3 shadow-xs cursor-grab active:cursor-grabbing ${
                  isDragging
                    ? 'opacity-40 border-dashed border-sky-500 bg-sky-50/50'
                    : isOver
                    ? 'border-sky-500 ring-2 ring-sky-300 shadow-md transform -translate-y-0.5'
                    : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                }`}
              >
                {/* Index badge and thumbnail */}
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  <div className="w-7 h-7 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-black text-xs flex items-center justify-center shrink-0">
                    {index + 1}
                  </div>

                  {trip.coverImage ? (
                    <img
                      src={trip.coverImage}
                      alt={trip.title}
                      className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-500 shrink-0">
                      <Plane className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm text-slate-900 truncate flex items-center space-x-1.5">
                      <span>{cleanTripTitle(trip.title)}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                      <span className="flex items-center space-x-1 truncate">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{trip.destination}</span>
                      </span>
                      <span>·</span>
                      <span className="flex items-center space-x-1 shrink-0">
                        <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{trip.startDate}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Ordering Action Buttons */}
                <div className="flex items-center space-x-1 shrink-0">
                  {/* Move to Top */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveToTop(index);
                    }}
                    disabled={isFirst}
                    title="맨 위로 이동"
                    className={`p-1.5 rounded-lg border transition ${
                      isFirst
                        ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-300'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-600 active:scale-95'
                    }`}
                  >
                    <ChevronsUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Move Up */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveUp(index);
                    }}
                    disabled={isFirst}
                    title="위로 이동"
                    className={`p-1.5 rounded-lg border transition ${
                      isFirst
                        ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-300'
                        : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-700 hover:text-sky-600 active:scale-95'
                    }`}
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>

                  {/* Move Down */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveDown(index);
                    }}
                    disabled={isLast}
                    title="아래로 이동"
                    className={`p-1.5 rounded-lg border transition ${
                      isLast
                        ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-300'
                        : 'border-slate-200 hover:border-sky-300 hover:bg-sky-50 text-slate-700 hover:text-sky-600 active:scale-95'
                    }`}
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>

                  {/* Move to Bottom */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveToBottom(index);
                    }}
                    disabled={isLast}
                    title="맨 아래로 이동"
                    className={`p-1.5 rounded-lg border transition ${
                      isLast
                        ? 'opacity-30 cursor-not-allowed border-slate-200 text-slate-300'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-600 active:scale-95'
                    }`}
                  >
                    <ChevronsDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-white flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center space-x-1.5 px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
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
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-5 py-2 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-xl transition shadow-sm active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{isSaving ? '저장 중...' : '순서 저장하기'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
