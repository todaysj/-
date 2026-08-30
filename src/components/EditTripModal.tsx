import React, { useState, useRef } from 'react';
import { Trip, ChecklistTabConfig, SouvenirTabConfig } from '../types';
import { compressImage } from '../utils/imageUtils';
import {
  X,
  MapPin,
  Calendar,
  DollarSign,
  Image as ImageIcon,
  Trash2,
  AlertTriangle,
  Upload,
  RefreshCw,
  Check,
  Copy,
  CheckSquare,
  Gift,
  Plus,
  Minus,
  Users,
  Layers
} from 'lucide-react';
import {
  getTripChecklistTabs,
  getTripSouvenirTabs,
  DEFAULT_PACKING_CATEGORIES,
  DEFAULT_SOUVENIR_TAGS
} from '../utils/tabUtils';
import {
  calculateTripDays,
  formatTripNightsAndDays,
  parseLocalDate,
  formatDateToISO
} from '../utils/dateUtils';

interface EditTripModalProps {
  trip: Trip;
  onClose: () => void;
  onSave: (updatedTrip: Trip) => void;
  onDeleteTrip?: (tripId: string) => void;
  onDuplicateTrip?: (trip: Trip) => void;
}

const PRESET_WALLPAPERS = [
  { name: '도쿄 야경', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80' },
  { name: '휴양지 바다', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80' },
  { name: '유럽 도시', url: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1200&q=80' },
  { name: '산 & 자연', url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80' },
  { name: '비행기 창가', url: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80' }
];

export const EditTripModal: React.FC<EditTripModalProps> = ({
  trip,
  onClose,
  onSave,
  onDeleteTrip,
  onDuplicateTrip
}) => {
  const [title, setTitle] = useState(trip.title);
  const [destination, setDestination] = useState(trip.destination);
  const [startDate, setStartDate] = useState(trip.startDate);
  const [endDate, setEndDate] = useState(trip.endDate);
  const [totalBudget, setTotalBudget] = useState(trip.totalBudget.toString());
  const [coverImage, setCoverImage] = useState(trip.coverImage);
  const [isUploading, setIsUploading] = useState(false);

  // Dynamic Tabs Management State
  const [checklistTabs, setChecklistTabs] = useState<ChecklistTabConfig[]>(() => getTripChecklistTabs(trip));
  const [souvenirTabs, setSouvenirTabs] = useState<SouvenirTabConfig[]>(() => getTripSouvenirTabs(trip));

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add new Checklist Tab
  const handleAddChecklistTab = () => {
    const newIndex = checklistTabs.length + 1;
    const newTab: ChecklistTabConfig = {
      id: `cl-${Date.now()}`,
      title: `체크리스트 ${newIndex}`,
      subtitle: '동행인 짐싸기 준비물 목록',
      items: [],
      categories: DEFAULT_PACKING_CATEGORIES
    };
    setChecklistTabs([...checklistTabs, newTab]);
  };

  const handleUpdateChecklistTabTitle = (id: string, newTitle: string) => {
    setChecklistTabs(checklistTabs.map((t) => (t.id === id ? { ...t, title: newTitle } : t)));
  };

  const handleDeleteChecklistTab = (id: string) => {
    setChecklistTabs(checklistTabs.filter((t) => t.id !== id));
  };

  // Add new Souvenir Tab
  const handleAddSouvenirTab = () => {
    const newIndex = souvenirTabs.length + 1;
    const newTab: SouvenirTabConfig = {
      id: `sv-${Date.now()}`,
      title: `기념품 ${newIndex}`,
      items: [],
      tags: DEFAULT_SOUVENIR_TAGS
    };
    setSouvenirTabs([...souvenirTabs, newTab]);
  };

  const handleUpdateSouvenirTabTitle = (id: string, newTitle: string) => {
    setSouvenirTabs(souvenirTabs.map((t) => (t.id === id ? { ...t, title: newTitle } : t)));
  };

  const handleDeleteSouvenirTab = (id: string) => {
    setSouvenirTabs(souvenirTabs.filter((t) => t.id !== id));
  };

  // Date adjustment helpers
  const handleAddDay = () => {
    const end = parseLocalDate(endDate);
    end.setDate(end.getDate() + 1);
    setEndDate(formatDateToISO(end));
  };

  const handleRemoveDay = () => {
    const days = calculateTripDays(startDate, endDate);
    if (days <= 1) return;
    const end = parseLocalDate(endDate);
    end.setDate(end.getDate() - 1);
    setEndDate(formatDateToISO(end));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일(JPG, PNG, WEBP 등)만 업로드할 수 있습니다.');
      return;
    }

    setIsUploading(true);
    try {
      const compressed = await compressImage(file, 1600, 1000, 0.86);
      setCoverImage(compressed);
    } catch (err) {
      alert('이미지 처리 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !destination.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const newTotalDays = calculateTripDays(startDate, endDate);
      const updatedSchedule = (trip.schedule || []).map((item) => ({
        ...item,
        day: Math.max(1, Math.min(item.day, newTotalDays))
      }));

      const updated: Trip = {
        ...trip,
        title: title.trim(),
        destination: destination.trim(),
        startDate,
        endDate,
        schedule: updatedSchedule,
        totalBudget: Number(totalBudget) || 0,
        coverImage: coverImage.trim() || 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
        checklistTabs,
        souvenirTabs,
        // Backward compatibility sync
        packingList: checklistTabs[0]?.items || [],
        checklistTitle: checklistTabs[0]?.title || '',
        checklistSubtitle: checklistTabs[0]?.subtitle || '',
        packingCategories: checklistTabs[0]?.categories || DEFAULT_PACKING_CATEGORIES,
        souvenirs: souvenirTabs[0]?.items || [],
        souvenirTags: souvenirTabs[0]?.tags || DEFAULT_SOUVENIR_TAGS
      };

      onSave(updated);
      onClose();
    } catch (err) {
      console.error('상세 에러 (EditTripModal handleSubmit):', err);
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (onDeleteTrip) {
      onDeleteTrip(trip.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150 border border-slate-100 max-h-[90vh] flex flex-col">
        <div className="p-5 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-xl">✈️</span>
            <h3 className="font-extrabold text-base">여행 정보 수정</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-lg transition text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {showDeleteConfirm ? (
          <div className="p-6 space-y-4 overflow-y-auto">
            <div className="flex items-start space-x-3 text-rose-600 bg-rose-50 p-4 rounded-xl border border-rose-100">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold text-slate-900 text-sm">여행 일정을 정말 삭제하시겠습니까?</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  '<span className="font-bold text-slate-900">{trip.title}</span>' 일정을 삭제하면 등록된 세부 일정, 예약 서류, 가계부 내역이 모두 삭제되며 복구할 수 없습니다.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition"
              >
                삭제 진행
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
            {/* Cover Image Preview & Upload */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">커버 이미지</label>
              
              <div className="relative group rounded-2xl overflow-hidden border border-slate-200 h-36 bg-slate-100 mb-2.5 shadow-xs">
                {coverImage ? (
                  <img
                    src={coverImage}
                    alt="Cover Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="w-8 h-8 mb-1" />
                    <span className="text-xs font-semibold">이미지가 설정되지 않음</span>
                  </div>
                )}

                {/* Upload overlay */}
                <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs opacity-0 group-hover:opacity-100 transition flex items-center justify-center space-x-2 p-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 bg-white text-slate-900 font-bold text-xs rounded-xl shadow-md hover:bg-slate-100 transition flex items-center space-x-1"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>내 사진 업로드</span>
                  </button>
                </div>

                {isUploading && (
                  <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center text-white text-xs font-bold space-x-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>업로드 중...</span>
                  </div>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />

              {/* Upload Button + URL Input toggle */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-3 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs rounded-xl border border-sky-200/80 transition flex items-center justify-center space-x-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-sky-600" />
                  <span>내 컴퓨터 사진 업로드</span>
                </button>
              </div>

              {/* Preset Wallpapers */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500">추천 여행 배경 이미지</span>
                <div className="grid grid-cols-5 gap-1.5">
                  {PRESET_WALLPAPERS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setCoverImage(preset.url)}
                      className={`relative rounded-lg overflow-hidden h-12 border-2 transition ${
                        coverImage === preset.url ? 'border-sky-500 ring-2 ring-sky-200' : 'border-transparent opacity-70 hover:opacity-100'
                      }`}
                      title={preset.name}
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      {coverImage === preset.url && (
                        <div className="absolute inset-0 bg-sky-500/30 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white drop-shadow-md" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Direct URL Input */}
              <div className="relative mt-2">
                <input
                  type="url"
                  placeholder="또는 이미지 Web URL 입력 (https://...)"
                  value={coverImage.startsWith('data:') ? '업로드된 파일 이미지 적용 중' : coverImage}
                  onChange={(e) => setCoverImage(e.target.value)}
                  disabled={coverImage.startsWith('data:')}
                  className="w-full pl-8 pr-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-medium text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none disabled:opacity-60"
                />
                <ImageIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                {coverImage.startsWith('data:') && (
                  <button
                    type="button"
                    onClick={() => setCoverImage('')}
                    className="absolute right-2 top-1.5 text-[10px] font-bold text-rose-600 hover:underline bg-white px-1.5 py-0.5 rounded-md border border-slate-200"
                  >
                    업로드 취소
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">여행 제목 *</label>
              <input
                type="text"
                placeholder="예: 도쿄 3박 4일, 제주도 힐링 여행"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">여행지 / 목적지 *</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="예: 도쿄, 일본"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
                  required
                />
                <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">시작일</label>
                <div className="relative">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full pl-8 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                    required
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">종료일</label>
                <div className="relative">
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full pl-8 pr-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                    required
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
                </div>
              </div>
            </div>

            {/* Travel Date Duration & Quick Adjust */}
            <div className="bg-sky-50/80 border border-sky-200/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
                <span className="text-xs font-bold text-sky-900">
                  {formatTripNightsAndDays(startDate, endDate)} (총 {calculateTripDays(startDate, endDate)}일간)
                </span>
              </div>
              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={handleRemoveDay}
                  disabled={calculateTripDays(startDate, endDate) <= 1}
                  className="px-2.5 py-1 bg-white hover:bg-slate-100 disabled:opacity-40 text-slate-700 text-[11px] font-bold rounded-lg border border-slate-200 shadow-2xs transition flex items-center space-x-1 cursor-pointer disabled:cursor-not-allowed"
                  title="종료일을 하루 줄여 일정을 1일 단축합니다"
                >
                  <Minus className="w-3 h-3 text-rose-500" />
                  <span>-1일 단축</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddDay}
                  className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold rounded-lg shadow-2xs transition flex items-center space-x-1 cursor-pointer"
                  title="종료일을 하루 늘려 일정을 1일 연장합니다"
                >
                  <Plus className="w-3 h-3" />
                  <span>+1일 연장</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">총 예산 (원화 KRW)</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="1500000"
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-sky-500 outline-none"
                />
                <span className="text-xs font-bold text-slate-400 absolute left-3 top-3">₩</span>
              </div>
            </div>

            {/* 🌟 Specific Trip Tab Customization: Checklist & Souvenirs */}
            <div className="pt-3 border-t border-slate-200 space-y-4">
              <div className="flex items-center space-x-2 text-slate-800">
                <Layers className="w-4 h-4 text-sky-600" />
                <div>
                  <h4 className="text-xs font-extrabold text-slate-900">체크리스트 & 기념품 탭 관리</h4>
                  <p className="text-[11px] text-slate-500">
                    동행인별로 준비물과 기념품 탭을 추가하거나 필요없는 탭을 삭제할 수 있습니다.
                  </p>
                </div>
              </div>

              {/* 1. Checklist Tabs Management */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <CheckSquare className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-bold text-slate-800">체크리스트 탭 목록</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-sky-100 text-sky-700 font-bold rounded-full">
                      {checklistTabs.length}개
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddChecklistTab}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white font-bold text-[11px] rounded-lg shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>체크리스트 탭 추가</span>
                  </button>
                </div>

                {checklistTabs.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-1 italic">
                    등록된 체크리스트 탭이 없습니다. (+ 추가 버튼을 눌러보세요)
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {checklistTabs.map((tab, idx) => (
                      <div
                        key={tab.id}
                        className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 shadow-2xs"
                      >
                        <span className="text-[11px] font-extrabold text-slate-400 w-4">{idx + 1}</span>
                        <input
                          type="text"
                          value={tab.title}
                          onChange={(e) => handleUpdateChecklistTabTitle(tab.id, e.target.value)}
                          placeholder="탭 이름 (예: 민지 체크리스트)"
                          className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-sky-500 outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                          {tab.items?.length || 0}개 항목
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteChecklistTab(tab.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                          title="이 체크리스트 탭 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Souvenir Tabs Management */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Gift className="w-4 h-4 text-pink-500" />
                    <span className="text-xs font-bold text-slate-800">기념품 탭 목록</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-pink-100 text-pink-700 font-bold rounded-full">
                      {souvenirTabs.length}개
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddSouvenirTab}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-pink-600 hover:bg-pink-500 text-white font-bold text-[11px] rounded-lg shadow-xs transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>기념품 탭 추가</span>
                  </button>
                </div>

                {souvenirTabs.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-1 italic">
                    등록된 기념품 탭이 없습니다. (+ 추가 버튼을 눌러보세요)
                  </p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {souvenirTabs.map((tab, idx) => (
                      <div
                        key={tab.id}
                        className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 shadow-2xs"
                      >
                        <span className="text-[11px] font-extrabold text-slate-400 w-4">{idx + 1}</span>
                        <input
                          type="text"
                          value={tab.title}
                          onChange={(e) => handleUpdateSouvenirTabTitle(tab.id, e.target.value)}
                          placeholder="탭 이름 (예: 철수 선물 목록)"
                          className="flex-1 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-pink-500 outline-none"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                          {tab.items?.length || 0}개 항목
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSouvenirTab(tab.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                          title="이 기념품 탭 삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-1.5">
                {onDeleteTrip && (
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>삭제</span>
                  </button>
                )}

                {onDuplicateTrip && (
                  <button
                    type="button"
                    onClick={() => {
                      onDuplicateTrip(trip);
                      onClose();
                    }}
                    className="inline-flex items-center space-x-1 px-3 py-2 text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition"
                    title="현재 여행 일정 전체를 복사하여 새 여행으로 만듭니다"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>여행 복사</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
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
                  <span>{isSaving ? '저장 중...' : '수정 저장'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

