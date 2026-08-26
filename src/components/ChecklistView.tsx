import React, { useState } from 'react';
import { Trip, PackingItem, ChecklistTabConfig } from '../types';
import { CheckSquare, Plus, Check, Trash2, Pencil, X, FolderPlus, Users, SlidersHorizontal, ChevronUp, ChevronDown } from 'lucide-react';
import { getTripChecklistTabs, DEFAULT_PACKING_CATEGORIES } from '../utils/tabUtils';

interface ChecklistViewProps {
  trip: Trip;
  activeChecklistTabId?: string;
  onSelectChecklistTab?: (tabId: string) => void;
  onUpdateTrip: (updatedTrip: Trip) => void;
}

export const ChecklistView: React.FC<ChecklistViewProps> = ({
  trip,
  activeChecklistTabId,
  onSelectChecklistTab,
  onUpdateTrip
}) => {
  const checklistTabs = getTripChecklistTabs(trip);
  const currentTab = checklistTabs.find((t) => t.id === activeChecklistTabId) || checklistTabs[0] || {
    id: 'default-checklist',
    title: '체크리스트',
    subtitle: '빠트린 물품이 없는지 출발 전 최종 점검하세요!',
    items: [],
    categories: DEFAULT_PACKING_CATEGORIES
  };

  // Header Edit State
  const [isEditingHeader, setIsEditingHeader] = useState(false);
  const [editTitleInput, setEditTitleInput] = useState(currentTab.title);
  const [editSubtitleInput, setEditSubtitleInput] = useState(currentTab.subtitle || '');

  // Category Delete Modal State
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  // Category Manager Modal State (Order Reordering)
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [managerCategoryInput, setManagerCategoryInput] = useState('');
  const [categoryErrorMessage, setCategoryErrorMessage] = useState<string | null>(null);

  // Category Tab & Add State
  const baseCategories = currentTab.categories && currentTab.categories.length > 0
    ? currentTab.categories
    : DEFAULT_PACKING_CATEGORIES;
  const usedCategories = Array.from(new Set(currentTab.items.map((p) => p.category)));
  const allCategories = [
    ...baseCategories,
    ...usedCategories.filter((c) => !baseCategories.includes(c))
  ];

  const [selectedTab, setSelectedTab] = useState<string>('ALL');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // New Item State
  const [newItemTitle, setNewItemTitle] = useState('');
  const [category, setCategory] = useState(allCategories[0] || '필수 서류');
  const [isEssential, setIsEssential] = useState(false);

  const totalCount = currentTab.items.length;
  const packedCount = currentTab.items.filter((p) => p.isPacked).length;
  const packedPercent = totalCount > 0 ? Math.round((packedCount / totalCount) * 100) : 0;

  // Helper to commit changes to trip.checklistTabs
  const updateCurrentChecklistTab = (updater: (prev: ChecklistTabConfig) => ChecklistTabConfig) => {
    const tabs = getTripChecklistTabs(trip);
    const updatedTabs = tabs.map((t) => (t.id === currentTab.id ? updater(t) : t));
    const currentUpdated = updatedTabs.find((t) => t.id === currentTab.id) || updatedTabs[0];

    onUpdateTrip({
      ...trip,
      checklistTabs: updatedTabs,
      packingList: currentUpdated ? currentUpdated.items : [],
      checklistTitle: currentUpdated ? currentUpdated.title : '',
      checklistSubtitle: currentUpdated ? currentUpdated.subtitle : '',
      packingCategories: currentUpdated ? (currentUpdated.categories || DEFAULT_PACKING_CATEGORIES) : DEFAULT_PACKING_CATEGORIES
    });
  };

  const handleTogglePacked = (itemId: string) => {
    updateCurrentChecklistTab((tab) => ({
      ...tab,
      items: tab.items.map((p) => (p.id === itemId ? { ...p, isPacked: !p.isPacked } : p))
    }));
  };

  const handleAddPackingItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemTitle.trim()) return;

    const newItem: PackingItem = {
      id: `pack-${Date.now()}`,
      title: newItemTitle.trim(),
      category: category || allCategories[0] || '기타',
      isPacked: false,
      isEssential
    };

    updateCurrentChecklistTab((tab) => ({
      ...tab,
      items: [...tab.items, newItem]
    }));

    setNewItemTitle('');
  };

  const handleDeletePackingItem = (itemId: string) => {
    updateCurrentChecklistTab((tab) => ({
      ...tab,
      items: tab.items.filter((p) => p.id !== itemId)
    }));
  };

  const handleSaveHeader = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTitleInput.trim()) return;

    updateCurrentChecklistTab((tab) => ({
      ...tab,
      title: editTitleInput.trim(),
      subtitle: editSubtitleInput.trim()
    }));
    setIsEditingHeader(false);
  };

  const handleAddCategory = (catName: string) => {
    if (!catName.trim()) return;
    const trimmed = catName.trim();
    if (allCategories.includes(trimmed)) {
      setCategoryErrorMessage('이미 존재하는 카테고리 탭입니다.');
      setTimeout(() => setCategoryErrorMessage(null), 2500);
      return;
    }

    const updatedCategories = [...allCategories, trimmed];
    updateCurrentChecklistTab((tab) => ({
      ...tab,
      categories: updatedCategories
    }));
    setSelectedTab(trimmed);
    setCategory(trimmed);
    setCategoryErrorMessage(null);
  };

  // Move category Up in order
  const handleMoveCategoryUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...allCategories];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    updateCurrentChecklistTab((tab) => ({
      ...tab,
      categories: updated
    }));
  };

  // Move category Down in order
  const handleMoveCategoryDown = (index: number) => {
    if (index >= allCategories.length - 1) return;
    const updated = [...allCategories];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    updateCurrentChecklistTab((tab) => ({
      ...tab,
      categories: updated
    }));
  };

  const handleDeleteCategory = (catName: string) => {
    updateCurrentChecklistTab((tab) => ({
      ...tab,
      categories: allCategories.filter((c) => c !== catName),
      items: tab.items.filter((p) => p.category !== catName)
    }));
    if (selectedTab === catName) setSelectedTab('ALL');
  };

  const displayCategories = selectedTab === 'ALL'
    ? allCategories
    : allCategories.filter((c) => c === selectedTab);

  return (
    <div className="space-y-6">
      {/* If there are multiple checklist tabs in this trip, show a switch selector */}
      {checklistTabs.length > 1 && (
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center space-x-1.5 shrink-0 text-slate-700 font-bold text-xs">
            <Users className="w-4 h-4 text-sky-600" />
            <span>동행인별 체크리스트:</span>
          </div>
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5">
            {checklistTabs.map((t) => {
              const isSelected = t.id === currentTab.id;
              const unPacked = (t.items || []).filter((p) => !p.isPacked).length;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (onSelectChecklistTab) onSelectChecklistTab(t.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>{t.title}</span>
                  {unPacked > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                      isSelected ? 'bg-rose-500 text-white' : 'bg-rose-100 text-rose-700'
                    }`}>
                      {unPacked}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Progress & Header Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            {isEditingHeader ? (
              <form onSubmit={handleSaveHeader} className="space-y-2 max-w-xl">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">체크리스트 제목</label>
                  <input
                    type="text"
                    value={editTitleInput}
                    onChange={(e) => setEditTitleInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-extrabold text-slate-800 focus:ring-2 focus:ring-sky-500 outline-none"
                    placeholder="예: MBTI J의 꼼꼼 짐싸기 체크리스트"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">부제목 / 설명 문구</label>
                  <input
                    type="text"
                    value={editSubtitleInput}
                    onChange={(e) => setEditSubtitleInput(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-600 focus:ring-2 focus:ring-sky-500 outline-none"
                    placeholder="예: 빠트린 물품이 없는지 출발 전 최종 점검하세요!"
                  />
                </div>
                <div className="flex space-x-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingHeader(false)}
                    className="px-2.5 py-1 text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-1 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg flex items-center space-x-1 shadow-sm transition"
                  >
                    <Check className="w-3 h-3" />
                    <span>저장</span>
                  </button>
                </div>
              </form>
            ) : (
              <div>
                <div className="flex items-center space-x-2">
                  <CheckSquare className="w-6 h-6 text-sky-600 flex-shrink-0" />
                  <h2 className="text-lg font-extrabold text-slate-800">{currentTab.title}</h2>
                  <button
                    onClick={() => {
                      setEditTitleInput(currentTab.title);
                      setEditSubtitleInput(currentTab.subtitle || '');
                      setIsEditingHeader(true);
                    }}
                    className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition"
                    title="제목/설명 문구 수정"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                {currentTab.subtitle && (
                  <p className="text-xs text-slate-500 mt-1">
                    {currentTab.subtitle}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <span className="text-2xl font-black text-sky-600">{packedPercent}%</span>
            <span className="text-xs text-slate-500 block">
              ({packedCount} / {totalCount} 완료)
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-sky-500 to-indigo-600 h-3 rounded-full transition-all duration-300"
            style={{ width: `${packedPercent}%` }}
          />
        </div>
      </div>

      {/* Category Tab Bar & Add/Delete Tab Controls */}
      <div className="bg-white p-3.5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            onClick={() => setSelectedTab('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              selectedTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            전체 ({totalCount})
          </button>

          {allCategories.map((cat) => {
            const count = currentTab.items.filter((p) => p.category === cat).length;
            const isSelected = selectedTab === cat;
            return (
              <div
                key={cat}
                className={`flex items-center rounded-xl text-xs font-bold transition whitespace-nowrap pl-3 pr-1 py-1 border ${
                  isSelected
                    ? 'bg-sky-500 border-sky-500 text-white shadow-sm'
                    : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <button
                  onClick={() => setSelectedTab(cat)}
                  className="mr-1 hover:underline cursor-pointer"
                >
                  {cat} ({count})
                </button>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCategoryToDelete(cat);
                  }}
                  className={`p-0.5 rounded-md transition ml-1 cursor-pointer ${
                    isSelected
                      ? 'text-white/80 hover:text-white hover:bg-white/20'
                      : 'text-slate-400 hover:text-rose-600 hover:bg-slate-200'
                  }`}
                  title="카테고리 탭 삭제"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center space-x-1.5 flex-shrink-0">
          <button
            onClick={() => {
              setIsCategoryManagerOpen(true);
              setManagerCategoryInput('');
              setCategoryErrorMessage(null);
            }}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-200 shadow-2xs cursor-pointer"
            title="카테고리 탭 순서 변경 및 관리"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
            <span>순서 관리</span>
          </button>

          {!isAddingCategory ? (
            <button
              onClick={() => {
                setNewCategoryInput('');
                setIsAddingCategory(true);
              }}
              className="flex items-center space-x-1 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs rounded-xl transition border border-sky-200 shadow-xs cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>카테고리 탭 추가</span>
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddCategory(newCategoryInput);
                setIsAddingCategory(false);
                setNewCategoryInput('');
              }}
              className="flex items-center space-x-1 bg-slate-50 p-1 border border-slate-200 rounded-xl"
            >
              <input
                type="text"
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                placeholder="새 탭 이름 (예: 보조 서류)"
                className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg outline-none font-medium focus:ring-2 focus:ring-sky-500 w-36 sm:w-44"
                autoFocus
                required
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-sky-600 text-white text-xs font-bold rounded-lg hover:bg-sky-500 transition cursor-pointer"
              >
                추가
              </button>
              <button
                type="button"
                onClick={() => setIsAddingCategory(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Add New Item Form */}
      <form onSubmit={handleAddPackingItem} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-3 items-center">
        <input
          type="text"
          placeholder="추가할 준비물 입력 (예: 보조배터리, 여권복사본)"
          value={newItemTitle}
          onChange={(e) => setNewItemTitle(e.target.value)}
          className="flex-1 w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-sky-500 outline-none"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full sm:w-auto px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
        >
          {allCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <label className="flex items-center space-x-1.5 text-xs text-slate-600 font-bold whitespace-nowrap cursor-pointer">
          <input
            type="checkbox"
            checked={isEssential}
            onChange={(e) => setIsEssential(e.target.checked)}
            className="rounded text-sky-600 focus:ring-sky-500 w-4 h-4"
          />
          <span>🚨 필수 품목</span>
        </label>

        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs rounded-xl shadow-sm transition whitespace-nowrap cursor-pointer"
        >
          준비물 추가
        </button>
      </form>

      {/* Grouped Lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {displayCategories.map((cat) => {
          const catItems = currentTab.items.filter((p) => p.category === cat);
          return (
            <div key={cat} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="font-extrabold text-slate-800 text-sm mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="flex items-center space-x-1.5">
                  <span>📌 {cat}</span>
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-normal">
                    {catItems.filter((i) => i.isPacked).length}/{catItems.length}
                  </span>
                  <button
                    onClick={() => setCategoryToDelete(cat)}
                    className="p-1 text-slate-300 hover:text-rose-600 transition cursor-pointer"
                    title="카테고리 탭 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </h3>

              {catItems.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-100 rounded-xl">
                  이 카테고리에 준비물이 없습니다.
                </div>
              ) : (
                <div className="space-y-2">
                  {catItems.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleTogglePacked(item.id)}
                      className={`p-2.5 rounded-xl border transition flex items-center justify-between cursor-pointer ${
                        item.isPacked
                          ? 'bg-emerald-50/50 border-emerald-200/60 text-slate-400'
                          : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                            item.isPacked
                              ? 'bg-emerald-500 border-emerald-500 text-white'
                              : 'bg-white border-slate-300'
                          }`}
                        >
                          {item.isPacked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>

                        <span className={`text-xs font-semibold truncate ${item.isPacked ? 'line-through' : ''}`}>
                          {item.title}
                        </span>

                        {item.isEssential && (
                          <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[10px] font-bold rounded flex-shrink-0">
                            필수
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePackingItem(item.id);
                        }}
                        className="p-1 text-slate-300 hover:text-rose-600 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 🏷️ CATEGORY ORDER & MANAGEMENT MODAL */}
      {isCategoryManagerOpen && (
        <div
          onClick={() => setIsCategoryManagerOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800">체크리스트 카테고리 탭 순서 관리</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">화살표(▲/▼)를 눌러 카테고리 순서를 위아래로 변경할 수 있습니다.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryManagerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
              {/* Add New Category inside Modal */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>새 카테고리 탭 추가</span>
                  <span className="text-[10px] text-slate-400 font-normal">엔터 또는 [추가] 클릭</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={managerCategoryInput}
                    onChange={(e) => setManagerCategoryInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (managerCategoryInput.trim()) {
                          handleAddCategory(managerCategoryInput);
                          setManagerCategoryInput('');
                        }
                      }
                    }}
                    placeholder="새 카테고리 이름 입력 (예: 비상약품, 액티비티)"
                    className="flex-1 px-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:bg-white outline-none font-medium transition"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (managerCategoryInput.trim()) {
                        handleAddCategory(managerCategoryInput);
                        setManagerCategoryInput('');
                      }
                    }}
                    className="px-3.5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition shadow-xs cursor-pointer shrink-0"
                  >
                    추가
                  </button>
                </div>
                {categoryErrorMessage && (
                  <p className="text-[11px] font-bold text-rose-500 mt-1">{categoryErrorMessage}</p>
                )}
              </div>

              {/* Categories Reordering List */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>등록된 카테고리 탭 ({allCategories.length}개)</span>
                  <span className="text-[11px] text-slate-400 font-medium">위치 변경</span>
                </div>

                <div className="space-y-1.5">
                  {allCategories.map((cat, idx) => {
                    const count = currentTab.items.filter((p) => p.category === cat).length;
                    const isFirst = idx === 0;
                    const isLast = idx === allCategories.length - 1;

                    return (
                      <div
                        key={cat}
                        className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/80 rounded-xl transition gap-2"
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate">{cat}</span>
                          <span className="text-[11px] text-slate-500 shrink-0 font-medium">({count}개)</span>
                        </div>

                        {/* Actions: Move Up, Move Down, Delete */}
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleMoveCategoryUp(idx)}
                            disabled={isFirst}
                            className={`p-1.5 rounded-lg border transition ${
                              isFirst
                                ? 'text-slate-300 border-slate-200/40 cursor-not-allowed bg-slate-100/50'
                                : 'text-slate-700 border-slate-200 bg-white hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 cursor-pointer shadow-2xs'
                            }`}
                            title="위로 이동"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleMoveCategoryDown(idx)}
                            disabled={isLast}
                            className={`p-1.5 rounded-lg border transition ${
                              isLast
                                ? 'text-slate-300 border-slate-200/40 cursor-not-allowed bg-slate-100/50'
                                : 'text-slate-700 border-slate-200 bg-white hover:bg-sky-50 hover:text-sky-600 hover:border-sky-300 cursor-pointer shadow-2xs'
                            }`}
                            title="아래로 이동"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setCategoryToDelete(cat);
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition ml-1 cursor-pointer"
                            title="카테고리 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setIsCategoryManagerOpen(false)}
                className="px-5 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Delete Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-50 rounded-xl">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">카테고리 삭제</h3>
            </div>
            <p className="text-xs font-medium text-slate-600 leading-relaxed">
              '<span className="font-bold text-slate-900">{categoryToDelete}</span>' 카테고리 탭을 삭제하시겠습니까?
              <span className="block mt-1 text-slate-400">속해있는 준비물 품목들도 함께 삭제됩니다.</span>
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  if (categoryToDelete) {
                    handleDeleteCategory(categoryToDelete);
                  }
                  setCategoryToDelete(null);
                }}
                className="px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl transition shadow-sm cursor-pointer"
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
