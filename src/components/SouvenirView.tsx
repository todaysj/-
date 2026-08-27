import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trip, SouvenirItem, SouvenirTabConfig } from '../types';
import { compressImage, resolveTripPhotos } from '../utils/imageUtils';
import {
  Gift,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Circle,
  Image as ImageIcon,
  Tag,
  Search,
  Filter,
  DollarSign,
  MapPin,
  User,
  X,
  Upload,
  Check,
  ShoppingBag,
  Eye,
  Users,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  Camera,
  ShieldCheck,
  History,
  RotateCcw,
  Sparkles,
  RefreshCw,
  Palette
} from 'lucide-react';
import { getTripSouvenirTabs, DEFAULT_SOUVENIR_TAGS, TAG_COLOR_PALETTE, DEFAULT_TAG_COLORS, getTagColorInfo } from '../utils/tabUtils';
import { getPhotoLocal } from '../utils/photoStore';
import {
  getTripBackups,
  autoRecoverTabSouvenirs,
  restoreTabFromBackup,
  getSouvenirItemsForTab,
  TripBackup
} from '../utils/tripIndexedDB';

const AsyncSouvenirImg: React.FC<{
  src: string;
  alt?: string;
  className?: string;
}> = ({ src, alt, className }) => {
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    if (src && !src.startsWith('photo://')) return src;
    return '';
  });
  const [isResolving, setIsResolving] = useState<boolean>(() => Boolean(src && src.startsWith('photo://')));

  useEffect(() => {
    let isMounted = true;
    if (!src) {
      setResolvedSrc('');
      setIsResolving(false);
      return;
    }
    if (src.startsWith('photo://')) {
      setIsResolving(true);
      getPhotoLocal(src).then((dataUrl) => {
        if (isMounted) {
          if (dataUrl) {
            setResolvedSrc(dataUrl);
          }
          setIsResolving(false);
        }
      }).catch(() => {
        if (isMounted) setIsResolving(false);
      });
    } else {
      setResolvedSrc(src);
      setIsResolving(false);
    }
    return () => {
      isMounted = false;
    };
  }, [src]);

  if (isResolving || (!resolvedSrc && src)) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className || ''}`}>
        <div className="w-5 h-5 border-2 border-slate-300 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!resolvedSrc) {
    return <div className={`bg-slate-100 ${className || ''}`} />;
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt || ''}
      referrerPolicy="no-referrer"
      className={className}
    />
  );
};

interface SouvenirViewProps {
  trip: Trip;
  activeSouvenirTabId?: string;
  onSelectSouvenirTab?: (tabId: string) => void;
  onUpdateTrip: (updatedTrip: Trip) => void;
}

export const SouvenirView: React.FC<SouvenirViewProps> = ({
  trip,
  activeSouvenirTabId,
  onSelectSouvenirTab,
  onUpdateTrip
}) => {
  const souvenirTabs = getTripSouvenirTabs(trip);
  const currentTab = souvenirTabs.find((t) => t.id === activeSouvenirTabId) || souvenirTabs[0] || {
    id: 'default-souvenirs',
    title: '기념품',
    items: trip.souvenirs || [],
    tags: trip.souvenirTags || DEFAULT_SOUVENIR_TAGS,
    tagColors: trip.souvenirTagColors || DEFAULT_TAG_COLORS
  };

  const souvenirs = currentTab.items || [];
  const availableTags = currentTab.tags && currentTab.tags.length > 0 ? currentTab.tags : DEFAULT_SOUVENIR_TAGS;
  const tagColors = currentTab.tagColors || trip.souvenirTagColors || DEFAULT_TAG_COLORS;

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPURCHASED' | 'PURCHASED'>('ALL');

  // Modal State for Add / Edit Item
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SouvenirItem | null>(null);

  // Form State (supports up to 2 images)
  const [title, setTitle] = useState('');
  const [tag, setTag] = useState(availableTags[0] || '기념품');
  const [targetPerson, setTargetPerson] = useState('');
  const [location, setLocation] = useState('');
  const [estimatedPrice, setEstimatedPrice] = useState<string>('');
  const [currency, setCurrency] = useState<string>(trip.currency || 'KRW');
  const [images, setImages] = useState<string[]>([]);
  const [directUrlInput, setDirectUrlInput] = useState('');
  const [notes, setNotes] = useState('');
  const [isPurchased, setIsPurchased] = useState(false);

  // Exit Confirmation Dialog State
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Tag Management State
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [newTagColor, setNewTagColor] = useState<string>('pink');
  const [editingTagColorFor, setEditingTagColorFor] = useState<string | null>(null);

  // Tag Deletion Confirmation State
  const [tagToDelete, setTagToDelete] = useState<string | null>(null);
  const [tagErrorMessage, setTagErrorMessage] = useState<string | null>(null);

  // Souvenir Item Deletion Confirmation State ("삭제하시겠습니까?")
  const [itemToDelete, setItemToDelete] = useState<SouvenirItem | null>(null);

  // Backup & Recovery State
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [backupsList, setBackupsList] = useState<TripBackup[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [recoveryBanner, setRecoveryBanner] = useState<string | null>(null);

  // Image Lightbox State (supports multiple images)
  const [lightboxImages, setLightboxImages] = useState<string[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false);

  // Auto-resolve any photo:// references into full HD images
  useEffect(() => {
    let isMounted = true;
    const hasPhotoUris = trip.souvenirTabs?.some((tab) =>
      tab.items?.some(
        (item) =>
          item.images?.some((img) => typeof img === 'string' && img.startsWith('photo://')) ||
          (typeof item.imageUrl === 'string' && item.imageUrl.startsWith('photo://'))
      )
    );

    if (hasPhotoUris) {
      resolveTripPhotos(trip).then((resolved) => {
        if (isMounted && resolved) {
          onUpdateTrip(resolved);
        }
      });
    }

    return () => {
      isMounted = false;
    };
  }, [trip.id, currentTab.id]);

  // Open Backup & History Modal
  const handleOpenBackupModal = async () => {
    setIsLoadingBackups(true);
    setIsBackupModalOpen(true);
    try {
      const list = await getTripBackups(trip.id);
      setBackupsList(list);
    } catch (err) {
      console.warn('Failed to load trip backups:', err);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  // Restore specific backup snapshot for current tab
  const handleRestoreBackup = (backup: TripBackup) => {
    if (!backup.trip) return;
    if (confirm(`'${backup.dateStr}' 시점으로 복원하시겠습니까?`)) {
      const updatedTrip = restoreTabFromBackup(trip, currentTab.id, backup.trip, currentTab.title);
      onUpdateTrip(updatedTrip);
      setIsBackupModalOpen(false);
      setRecoveryBanner(`복원되었습니다.`);
      setTimeout(() => setRecoveryBanner(null), 5000);
    }
  };

  // Run auto-recovery for current tab
  const handleTriggerAutoRecover = async () => {
    setIsLoadingBackups(true);
    try {
      const { trip: recoveredTrip, recoveredCount } = await autoRecoverTabSouvenirs(trip, currentTab.id, currentTab.title);
      if (recoveredCount > 0) {
        onUpdateTrip(recoveredTrip);
        setRecoveryBanner(`누락된 ${recoveredCount}개 항목이 복구되었습니다.`);
      } else {
        alert('모든 항목이 최신 상태입니다.');
      }
      setIsBackupModalOpen(false);
      setTimeout(() => setRecoveryBanner(null), 5000);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  // Helper to commit changes to trip.souvenirTabs
  const updateCurrentSouvenirTab = (updater: (prev: SouvenirTabConfig) => SouvenirTabConfig) => {
    const tabs = getTripSouvenirTabs(trip);
    const updatedTabs = tabs.map((t) => (t.id === currentTab.id ? updater(t) : t));
    const currentUpdated = updatedTabs.find((t) => t.id === currentTab.id) || updatedTabs[0];

    onUpdateTrip({
      ...trip,
      souvenirTabs: updatedTabs,
      souvenirTags: currentUpdated ? currentUpdated.tags : DEFAULT_SOUVENIR_TAGS,
      souvenirTagColors: currentUpdated ? currentUpdated.tagColors : DEFAULT_TAG_COLORS,
      updatedAt: Date.now()
    });
  };

  // Helper to open Add Modal
  const handleOpenAddModal = () => {
    setEditingItem(null);
    setTitle('');
    setTag(availableTags[0] || '기념품');
    setTargetPerson('');
    setLocation('');
    setEstimatedPrice('');
    setCurrency(trip.currency || 'KRW');
    setImages([]);
    setDirectUrlInput('');
    setNotes('');
    setIsPurchased(false);
    setShowExitConfirm(false);
    setIsModalOpen(true);
  };

  // Helper to open Edit Modal
  const handleOpenEditModal = (item: SouvenirItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setTag(item.tag || availableTags[0] || '기념품');
    setTargetPerson(item.targetPerson || '');
    setLocation(item.location || '');
    setEstimatedPrice(item.estimatedPrice !== undefined && item.estimatedPrice > 0 ? String(item.estimatedPrice) : '');
    setCurrency(item.currency || trip.currency || 'KRW');
    
    // Normalize images: if item has images array use it, else if imageUrl use it
    const itemImages: string[] = [];
    if (item.images && Array.isArray(item.images) && item.images.length > 0) {
      itemImages.push(...item.images.slice(0, 2));
    } else if (item.imageUrl) {
      itemImages.push(item.imageUrl);
    }
    const validImages = itemImages.filter(
      (img) =>
        typeof img === 'string' &&
        (img.startsWith('data:image/') || img.startsWith('http://') || img.startsWith('https://') || img.startsWith('blob:') || img.startsWith('photo://'))
    );
    setImages(validImages);
    setDirectUrlInput('');
    setNotes(item.notes || '');
    setIsPurchased(item.isPurchased);
    setShowExitConfirm(false);
    setIsModalOpen(true);
  };

  // Check if form has unsaved modifications
  const hasUnsavedChanges = useCallback(() => {
    if (!isModalOpen) return false;
    if (!editingItem) {
      return (
        title.trim() !== '' ||
        targetPerson.trim() !== '' ||
        location.trim() !== '' ||
        estimatedPrice.trim() !== '' ||
        notes.trim() !== '' ||
        images.length > 0 ||
        directUrlInput.trim() !== ''
      );
    }
    // In edit mode, compare with initial editingItem
    const origImages = editingItem.images && editingItem.images.length > 0 
      ? editingItem.images 
      : editingItem.imageUrl ? [editingItem.imageUrl] : [];
    
    const priceNum = estimatedPrice.trim() ? parseFloat(estimatedPrice.replace(/,/g, '')) || 0 : 0;
    const origPrice = editingItem.estimatedPrice || 0;

    const titleChanged = title.trim() !== (editingItem.title || '');
    const tagChanged = tag !== (editingItem.tag || availableTags[0]);
    const personChanged = targetPerson.trim() !== (editingItem.targetPerson || '');
    const locChanged = location.trim() !== (editingItem.location || '');
    const priceChanged = priceNum !== origPrice;
    const notesChanged = notes.trim() !== (editingItem.notes || '');
    const imagesChanged = JSON.stringify(images) !== JSON.stringify(origImages);
    const purchasedChanged = isPurchased !== editingItem.isPurchased;

    return (
      titleChanged ||
      tagChanged ||
      personChanged ||
      locChanged ||
      priceChanged ||
      notesChanged ||
      imagesChanged ||
      purchasedChanged ||
      directUrlInput.trim() !== ''
    );
  }, [isModalOpen, editingItem, title, tag, targetPerson, location, estimatedPrice, notes, images, isPurchased, directUrlInput, availableTags]);

  // Request close modal: if changes exist, show confirmation modal, otherwise close immediately
  const requestCloseModal = useCallback(() => {
    if (hasUnsavedChanges()) {
      setShowExitConfirm(true);
    } else {
      setIsModalOpen(false);
      setShowExitConfirm(false);
    }
  }, [hasUnsavedChanges]);

  // Confirm discard changes and close modal
  const handleConfirmDiscard = () => {
    setShowExitConfirm(false);
    setIsModalOpen(false);
  };

  // Cancel discard and continue editing
  const handleCancelDiscard = () => {
    setShowExitConfirm(false);
  };

  // Browser back button & ESC key handling for modal
  useEffect(() => {
    if (!isModalOpen) return;

    // Push history state when modal opens
    window.history.pushState({ modalOpen: true }, '');

    const handlePopState = () => {
      if (hasUnsavedChanges()) {
        setShowExitConfirm(true);
        // re-push history state to prevent instant navigation away
        window.history.pushState({ modalOpen: true }, '');
      } else {
        setIsModalOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (itemToDelete) {
          setItemToDelete(null);
        } else if (tagToDelete) {
          setTagToDelete(null);
        } else if (showExitConfirm) {
          setShowExitConfirm(false);
        } else if (lightboxImages) {
          setLightboxImages(null);
        } else {
          requestCloseModal();
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModalOpen, hasUnsavedChanges, requestCloseModal, showExitConfirm, lightboxImages, itemToDelete, tagToDelete]);

  // Multiple Image file upload handler (supports up to 2 photos with ultra-lightweight multi-stage compression)
  const handleImageFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 2 - images.length;
    if (remainingSlots <= 0) {
      alert('사진은 최대 2장까지만 등록할 수 있습니다.');
      if (e.target) e.target.value = '';
      return;
    }

    const filesToProcess = (Array.from(files) as File[]).slice(0, remainingSlots);
    setIsCompressingImage(true);

    try {
      const compressedList: string[] = [];
      for (const file of filesToProcess) {
        if (!file.type.startsWith('image/')) {
          alert(`'${file.name}'은(는) 이미지 파일이 아닙니다.`);
          continue;
        }
        // Compress with optimal HD resolution (max 900px, 0.78 quality) preserving sharp details while keeping file size ultra compact (~25KB)
        const compressed = await compressImage(file, 900, 900, 0.78);
        compressedList.push(compressed);
      }

      if (compressedList.length > 0) {
        setImages((prev) => [...prev, ...compressedList].slice(0, 2));
      }
    } catch (error) {
      console.error('Image compression failed:', error);
      alert('이미지를 처리하는 중 오류가 발생했습니다. 다른 사진을 선택해 주세요.');
    } finally {
      setIsCompressingImage(false);
      if (e.target) e.target.value = '';
    }
  };

  // Add image from direct web URL
  const handleAddDirectUrl = () => {
    const trimmed = directUrlInput.trim();
    if (!trimmed) return;
    if (images.length >= 2) {
      alert('사진은 최대 2장까지만 등록할 수 있습니다.');
      return;
    }
    setImages((prev) => [...prev, trimmed].slice(0, 2));
    setDirectUrlInput('');
  };

  // Remove a specific image slot
  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Save Item (Create or Update)
  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('물품명을 입력해주세요.');
      return;
    }

    const priceNum = estimatedPrice.trim() ? parseFloat(estimatedPrice.replace(/,/g, '')) || 0 : 0;
    const finalImages = images.slice(0, 2);
    const primaryImageUrl = finalImages[0] || undefined;

    if (editingItem) {
      // Edit existing item
      updateCurrentSouvenirTab((tab) => ({
        ...tab,
        items: tab.items.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                title: title.trim(),
                tag: tag.trim() || '기념품',
                targetPerson: targetPerson.trim() || undefined,
                location: location.trim() || undefined,
                estimatedPrice: priceNum,
                currency,
                imageUrl: primaryImageUrl,
                images: finalImages,
                notes: notes.trim() || undefined,
                isPurchased
              }
            : item
        )
      }));
    } else {
      // Create new item
      const newItem: SouvenirItem = {
        id: `souvenir_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: title.trim(),
        tag: tag.trim() || '기념품',
        targetPerson: targetPerson.trim() || undefined,
        location: location.trim() || undefined,
        estimatedPrice: priceNum,
        currency,
        imageUrl: primaryImageUrl,
        images: finalImages,
        notes: notes.trim() || undefined,
        isPurchased,
        createdAt: new Date().toISOString()
      };
      updateCurrentSouvenirTab((tab) => ({
        ...tab,
        items: [newItem, ...tab.items]
      }));
    }

    setShowExitConfirm(false);
    setIsModalOpen(false);
  };

  // Toggle purchased state
  const handleTogglePurchased = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    updateCurrentSouvenirTab((tab) => ({
      ...tab,
      items: tab.items.map((item) =>
        item.id === id ? { ...item, isPurchased: !item.isPurchased } : item
      )
    }));
  };

  // Request delete item (opens '삭제하시겠습니까?' confirmation dialog)
  const handleRequestDeleteItem = (item: SouvenirItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setItemToDelete(item);
  };

  // Confirm delete item
  const handleConfirmDeleteItem = () => {
    if (!itemToDelete) return;
    const targetId = itemToDelete.id;
    updateCurrentSouvenirTab((tab) => ({
      ...tab,
      items: (tab.items || []).filter((item) => item.id !== targetId)
    }));
    if (isModalOpen && editingItem?.id === targetId) {
      setIsModalOpen(false);
      setEditingItem(null);
    }
    setItemToDelete(null);
  };

  // Add a new Tag (말머리)
  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;
    if (availableTags.includes(trimmed)) {
      setTagErrorMessage('이미 존재하는 말머리입니다.');
      setTimeout(() => setTagErrorMessage(null), 2500);
      return;
    }
    const updatedTags = [...availableTags, trimmed];
    const updatedColors = { ...tagColors, [trimmed]: newTagColor };
    updateCurrentSouvenirTab((tab) => ({
      ...tab,
      tags: updatedTags,
      tagColors: updatedColors
    }));
    setNewTagInput('');
    setTagErrorMessage(null);
  };

  // Update an existing Tag's color
  const handleUpdateTagColor = (targetTag: string, colorId: string) => {
    const updatedColors = { ...tagColors, [targetTag]: colorId };
    updateCurrentSouvenirTab((tab) => ({
      ...tab,
      tagColors: updatedColors
    }));
    setEditingTagColorFor(null);
  };

  // Move Tag Up in order
  const handleMoveTagUp = (index: number) => {
    if (index <= 0) return;
    const updatedTags = [...availableTags];
    const temp = updatedTags[index - 1];
    updatedTags[index - 1] = updatedTags[index];
    updatedTags[index] = temp;
    updateCurrentSouvenirTab((tab) => ({
      ...tab,
      tags: updatedTags
    }));
  };

  // Move Tag Down in order
  const handleMoveTagDown = (index: number) => {
    if (index >= availableTags.length - 1) return;
    const updatedTags = [...availableTags];
    const temp = updatedTags[index + 1];
    updatedTags[index + 1] = updatedTags[index];
    updatedTags[index] = temp;
    updateCurrentSouvenirTab((tab) => ({
      ...tab,
      tags: updatedTags
    }));
  };

  // Delete a Tag (말머리)
  const handleRequestDeleteTag = (targetTag: string) => {
    if (availableTags.length <= 1) {
      setTagErrorMessage('최소 하나의 말머리가 있어야 합니다.');
      setTimeout(() => setTagErrorMessage(null), 2500);
      return;
    }
    setTagToDelete(targetTag);
  };

  const handleConfirmDeleteTag = () => {
    if (!tagToDelete) return;
    const updatedTags = availableTags.filter((t) => t !== tagToDelete);
    const updatedColors = { ...tagColors };
    delete updatedColors[tagToDelete];
    updateCurrentSouvenirTab((tab) => ({
      ...tab,
      tags: updatedTags,
      tagColors: updatedColors
    }));
    if (selectedTagFilter === tagToDelete) {
      setSelectedTagFilter('ALL');
    }
    setTagToDelete(null);
  };

  // Tag color mapping helper using designated palette
  const getTagBadgeStyle = (tagLabel: string) => {
    return getTagColorInfo(tagLabel, tagColors).badgeClass;
  };

  // Filtered Souvenirs
  const filteredSouvenirs = souvenirs.filter((item) => {
    if (selectedTagFilter !== 'ALL' && item.tag !== selectedTagFilter) {
      return false;
    }
    if (statusFilter === 'UNPURCHASED' && item.isPurchased) {
      return false;
    }
    if (statusFilter === 'PURCHASED' && !item.isPurchased) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchTag = item.tag.toLowerCase().includes(q);
      const matchPerson = item.targetPerson?.toLowerCase().includes(q) || false;
      const matchLocation = item.location?.toLowerCase().includes(q) || false;
      const matchNotes = item.notes?.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchTag && !matchPerson && !matchLocation && !matchNotes) {
        return false;
      }
    }
    return true;
  });

  // Calculate statistics
  const totalCount = souvenirs.length;
  const purchasedCount = souvenirs.filter((s) => s.isPurchased).length;
  const unpurchasedCount = totalCount - purchasedCount;
  const progressPercent = totalCount > 0 ? Math.round((purchasedCount / totalCount) * 100) : 0;

  // Total estimated price grouped by currency
  const currencyTotals: Record<string, number> = {};
  souvenirs.forEach((s) => {
    if (s.estimatedPrice && s.estimatedPrice > 0) {
      const curr = s.currency || trip.currency || 'KRW';
      currencyTotals[curr] = (currencyTotals[curr] || 0) + s.estimatedPrice;
    }
  });

  // Open Lightbox
  const openLightbox = (itemImages: string[], initialIndex = 0) => {
    if (!itemImages || itemImages.length === 0) return;
    setLightboxImages(itemImages);
    setLightboxIndex(initialIndex);
  };

  return (
    <div className="space-y-6">
      {/* Multiple Souvenir Tabs Selector (if multiple tabs exist) */}
      {souvenirTabs.length > 1 && (
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center space-x-1.5 shrink-0 text-slate-700 font-bold text-xs">
            <Users className="w-4 h-4 text-pink-600" />
            <span>동행인별 기념품 목록:</span>
          </div>
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-0.5">
            {souvenirTabs.map((t) => {
              const isSelected = t.id === currentTab.id;
              const unpurchased = (t.items || []).filter((s) => !s.isPurchased).length;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    if (onSelectSouvenirTab) onSelectSouvenirTab(t.id);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-pink-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <Gift className="w-3.5 h-3.5 text-pink-200" />
                  <span>{t.title}</span>
                  {unpurchased > 0 && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                        isSelected ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {unpurchased}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Banner & Header Summary */}
      {recoveryBanner && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-2xl shadow-sm flex items-center justify-between text-xs sm:text-sm font-bold animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{recoveryBanner}</span>
          </div>
          <button
            onClick={() => setRecoveryBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-5 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-md shadow-pink-500/20 shrink-0">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">{currentTab.title}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-pink-100 text-pink-700 border border-pink-200">
                  {purchasedCount}/{totalCount}개 구입
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                사올 기념품, 선물, 먹거리를 사진(최대 2장)과 함께 기록하고 구입 완료를 체크해보세요.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              type="button"
              onClick={handleOpenBackupModal}
              title="과거에 등록했던 기념품 목록을 확인하고 복구합니다."
              className="inline-flex items-center space-x-1.5 px-3 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs sm:text-sm rounded-xl transition border border-emerald-200/80 cursor-pointer"
            >
              <History className="w-4 h-4 text-emerald-600" />
              <span>백업 & 복구</span>
            </button>

            <button
              type="button"
              onClick={() => setIsTagManagerOpen(true)}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs sm:text-sm rounded-xl transition border border-slate-200/80 cursor-pointer"
            >
              <Tag className="w-4 h-4 text-slate-500" />
              <span>말머리 관리</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAddModal}
              className="inline-flex items-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-md shadow-pink-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>기념품 추가</span>
            </button>
          </div>
        </div>

        {/* Progress Bar & Key Metrics */}
        <div className="mt-5 pt-5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500">구입 진행률</span>
              <div className="text-lg font-black text-slate-800">{progressPercent}%</div>
            </div>
            <div className="w-24 bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-pink-500 to-emerald-500 h-2.5 rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500">미구입 / 완료</span>
              <div className="text-lg font-black text-slate-800">
                <span className="text-amber-600 font-extrabold">{unpurchasedCount}</span> /{' '}
                <span className="text-emerald-600 font-extrabold">{purchasedCount}</span>
                <span className="text-xs text-slate-400 font-normal ml-1">개</span>
              </div>
            </div>
            <div className="p-2 bg-pink-100 text-pink-600 rounded-xl">
              <ShoppingBag className="w-4 h-4" />
            </div>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-slate-500">총 예상 금액</span>
              <div className="text-sm sm:text-base font-black text-slate-800 truncate">
                {Object.keys(currencyTotals).length > 0 ? (
                  Object.entries(currencyTotals).map(([curr, amt]) => (
                    <span key={curr} className="mr-2">
                      {amt.toLocaleString()} {curr}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 text-xs font-normal">금액 미지정</span>
                )}
              </div>
            </div>
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="물품명, 받는 사람, 구매처, 메모 검색..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              전체 ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('UNPURCHASED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'UNPURCHASED'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-700 hover:text-amber-900'
              }`}
            >
              미구입 ({unpurchasedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('PURCHASED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                statusFilter === 'PURCHASED'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:text-emerald-900'
              }`}
            >
              구입완료 ({purchasedCount})
            </button>
          </div>
        </div>

        {/* Tag (말머리) Filter Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedTagFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap cursor-pointer ${
              selectedTagFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            모든 말머리
          </button>
          {availableTags.map((t) => {
            const count = souvenirs.filter((s) => s.tag === t).length;
            const isSelected = selectedTagFilter === t;
            const colorInfo = getTagColorInfo(t, tagColors);
            return (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedTagFilter(t)}
                className={`px-3 py-1.5 rounded-xl font-bold transition whitespace-nowrap flex items-center space-x-1.5 cursor-pointer border ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${colorInfo.dotClass} shrink-0`} />
                <span>{t}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                    isSelected ? 'bg-slate-700 text-white' : 'bg-slate-200/90 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Souvenir Cards Grid */}
      {filteredSouvenirs.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center">
            <Gift className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            {searchQuery || selectedTagFilter !== 'ALL' || statusFilter !== 'ALL'
              ? '조건에 일치하는 기념품이 없습니다.'
              : '등록된 기념품이 아직 없습니다.'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            여행지에서 사올 쇼핑 목록이나 먹거리 리스트를 사진(최대 2장)과 함께 추가해보세요.
          </p>
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold rounded-xl transition shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>첫 기념품 추가하기</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSouvenirs.map((item) => {
            const tagStyle = getTagBadgeStyle(item.tag);
            const rawImages: string[] = [];
            if (item.images && Array.isArray(item.images) && item.images.length > 0) {
              rawImages.push(...item.images);
            } else if (item.imageUrl) {
              rawImages.push(item.imageUrl);
            }
            const itemImages = rawImages.filter(
              (img) =>
                typeof img === 'string' &&
                (img.startsWith('data:image/') || img.startsWith('http://') || img.startsWith('https://') || img.startsWith('blob:') || img.startsWith('photo://'))
            );

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between group ${
                  item.isPurchased
                    ? 'border-emerald-200/80 bg-emerald-50/20'
                    : 'border-slate-200/90'
                }`}
              >
                <div>
                  {/* Card Image Area (supports 1 or 2 photos) */}
                  {itemImages.length > 0 ? (
                    <div className="relative w-full bg-slate-100 overflow-hidden">
                      {itemImages.length === 1 ? (
                        /* Single Photo View */
                        <div className="relative h-44 w-full group/img overflow-hidden">
                          <AsyncSouvenirImg
                            src={itemImages[0]}
                            alt={item.title}
                            className={`w-full h-full object-cover transition duration-300 group-hover/img:scale-105 ${
                              item.isPurchased ? 'grayscale-[30%] opacity-90' : ''
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => openLightbox(itemImages, 0)}
                            className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-white space-x-1 text-xs font-bold cursor-pointer backdrop-blur-[2px]"
                          >
                            <Eye className="w-4 h-4" />
                            <span>사진 크게 보기</span>
                          </button>
                        </div>
                      ) : (
                        /* Dual Photo View (2 Photos Side-by-Side) */
                        <div className="relative h-44 w-full grid grid-cols-2 gap-0.5 bg-slate-200 overflow-hidden">
                          {itemImages.slice(0, 2).map((imgUrl, imgIdx) => (
                            <div key={imgIdx} className="relative h-full w-full group/img overflow-hidden bg-slate-100">
                              <AsyncSouvenirImg
                                src={imgUrl}
                                alt={`${item.title} - ${imgIdx + 1}`}
                                className={`w-full h-full object-cover transition duration-300 group-hover/img:scale-105 ${
                                  item.isPurchased ? 'grayscale-[30%] opacity-90' : ''
                                }`}
                              />
                              <button
                                type="button"
                                onClick={() => openLightbox(itemImages, imgIdx)}
                                className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center text-white space-x-1 text-[11px] font-bold cursor-pointer backdrop-blur-[2px]"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>사진 {imgIdx + 1}</span>
                              </button>
                            </div>
                          ))}
                          {/* 2 Photos Indicator Badge */}
                          <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-slate-900/80 backdrop-blur-xs text-white rounded-md text-[10px] font-bold flex items-center space-x-1 pointer-events-none">
                            <Camera className="w-3 h-3" />
                            <span>사진 2장</span>
                          </div>
                        </div>
                      )}

                      {/* Tag Badge over Image */}
                      <div className="absolute top-2.5 left-2.5 pointer-events-none">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border shadow-xs ${tagStyle}`}
                        >
                          {item.tag}
                        </span>
                      </div>

                      {/* Purchased status overlay badge */}
                      {item.isPurchased && (
                        <div className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-emerald-600 text-white rounded-md text-[11px] font-black flex items-center space-x-1 shadow-sm pointer-events-none">
                          <Check className="w-3.5 h-3.5" />
                          <span>구입완료</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 pb-0 flex items-center justify-between">
                      <span
                        className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border shadow-2xs ${tagStyle}`}
                      >
                        {item.tag}
                      </span>
                      {item.isPurchased && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-black flex items-center space-x-1">
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>구입완료</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Card Content */}
                  <div className="p-4 space-y-2.5">
                    {/* Title */}
                    <h3
                      className={`text-base font-bold text-slate-900 break-words ${
                        item.isPurchased ? 'line-through text-slate-400' : ''
                      }`}
                    >
                      {item.title}
                    </h3>

                    {/* Metadata */}
                    <div className="space-y-1 text-xs text-slate-600">
                      {item.targetPerson && (
                        <div className="flex items-center space-x-1.5 text-pink-700 bg-pink-50 px-2 py-1 rounded-lg w-fit font-semibold">
                          <User className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                          <span>받는 사람: {item.targetPerson}</span>
                        </div>
                      )}

                      {item.location && (
                        <div className="flex items-center space-x-1 text-slate-600">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </div>
                      )}

                      {item.estimatedPrice !== undefined && item.estimatedPrice > 0 && (
                        <div className="flex items-center space-x-1 font-bold text-slate-800">
                          <DollarSign className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            {item.estimatedPrice.toLocaleString()} {item.currency || trip.currency || 'KRW'}
                          </span>
                        </div>
                      )}

                      {item.notes && (
                        <p className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100 leading-relaxed break-words mt-1">
                          {item.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleTogglePurchased(item.id, e)}
                    className={`flex-1 inline-flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                      item.isPurchased
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {item.isPurchased ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-white" />
                        <span>구입완료됨</span>
                      </>
                    ) : (
                      <>
                        <Circle className="w-4 h-4 text-slate-400" />
                        <span>구입 완료 체크</span>
                      </>
                    )}
                  </button>

                  <div className="flex items-center space-x-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(item)}
                      className="p-2 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition border border-transparent hover:border-slate-200 cursor-pointer"
                      title="수정"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleRequestDeleteItem(item, e)}
                      className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                      title="기념품 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 🌟 ADD / EDIT SOUVENIR MODAL (Supports 2 Photos & Exit Confirmation) */}
      {isModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) requestCloseModal();
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg sm:max-w-xl overflow-hidden flex flex-col max-h-[92vh]"
          >
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-gradient-to-tr from-pink-500 to-rose-600 text-white rounded-xl shadow-md">
                  <Gift className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold">
                    {editingItem ? '기념품 수정' : '기념품 추가'}
                  </h3>
                  <p className="text-xs text-slate-400">사올 물건과 사진(최대 2장), 말머리를 입력하세요</p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestCloseModal}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                title="닫기"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleSaveItem} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  물품명 / 이름 <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 도쿄 바나나, 산토리 위스키, 드럭스토어 립밤"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              {/* Tag & Target Person */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">말머리 (분류)</label>
                    <button
                      type="button"
                      onClick={() => setIsTagManagerOpen(true)}
                      className="text-[11px] text-pink-600 hover:text-pink-700 hover:underline font-bold cursor-pointer flex items-center space-x-1"
                    >
                      <Palette className="w-3 h-3" />
                      <span>말머리 & 색상 관리</span>
                    </button>
                  </div>
                  <div className="relative">
                    <select
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none cursor-pointer"
                    >
                      {availableTags.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
                      <span className={`w-3 h-3 rounded-full inline-block ${getTagColorInfo(tag, tagColors).dotClass}`} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">선물 대상 / 받는 사람</label>
                  <input
                    type="text"
                    value={targetPerson}
                    onChange={(e) => setTargetPerson(e.target.value)}
                    placeholder="예: 가족, 회사 동료, 나 자신"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">구매처 / 상점 위치</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="예: 돈키호테, 면세점, 백화점 B1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                />
              </div>

              {/* Price & Currency (Spacious 2-column layout) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">예상 금액 (선택)</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={estimatedPrice}
                    onChange={(e) => setEstimatedPrice(e.target.value)}
                    placeholder="예: 1500"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">통화 단위</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none cursor-pointer"
                  >
                    <option value="KRW">KRW (대한민국 ₩)</option>
                    <option value="JPY">JPY (일본 ¥)</option>
                    <option value="USD">USD (미국 $)</option>
                    <option value="EUR">EUR (유럽 €)</option>
                    <option value="TWD">TWD (대만 NT$)</option>
                    <option value="VND">VND (베트남 ₫)</option>
                    <option value="THB">THB (태국 ฿)</option>
                    <option value="CNY">CNY (중국 ¥)</option>
                    <option value="HKD">HKD (홍콩 HK$)</option>
                    <option value="GBP">GBP (영국 £)</option>
                    <option value="PHP">PHP (필리핀 ₱)</option>
                    <option value="SGD">SGD (싱가포르 S$)</option>
                  </select>
                </div>
              </div>

              {/* 📸 Photos Section (Up to 2 photos supported) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    사진 첨부 <span className="text-pink-600 font-extrabold">({images.length}/2장)</span>
                  </label>
                  <span className="text-[11px] text-slate-400">최대 2장까지 등록 가능</span>
                </div>

                {/* Image Thumbnails List (Slot 1 & Slot 2) */}
                {images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {images.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className="relative h-28 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden group shadow-2xs"
                      >
                        <AsyncSouvenirImg
                          src={imgUrl}
                          alt={`사진 ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/60 text-white rounded text-[10px] font-bold">
                          사진 {idx + 1}
                        </div>
                        <div className="absolute top-1.5 right-1.5 flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => openLightbox(images, idx)}
                            className="p-1 bg-black/60 hover:bg-black/80 text-white rounded-lg transition cursor-pointer"
                            title="크게 보기"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition cursor-pointer"
                            title="사진 삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload Button Box if slots available */}
                {images.length < 2 && (
                  <div
                    onClick={() => {
                      if (!isCompressingImage) fileInputRef.current?.click();
                    }}
                    className="border-2 border-dashed border-slate-300 hover:border-pink-500 hover:bg-pink-50/40 rounded-xl p-4 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-1.5"
                  >
                    <div className="p-2 bg-pink-100 text-pink-600 rounded-full">
                      <Upload className="w-4 h-4" />
                    </div>
                    {isCompressingImage ? (
                      <span className="text-xs font-bold text-pink-600 animate-pulse">사진 최적화 압축 중...</span>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-slate-700">
                          {images.length === 0 ? '기기에서 사진 업로드 (최대 2장)' : '+ 추가 사진 1장 업로드'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          JPG, PNG, WebP 사진 자동 압축 저장
                        </span>
                      </>
                    )}
                  </div>
                )}

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFilesChange}
                  accept="image/*"
                  multiple
                  className="hidden"
                />

                {/* Direct Image URL input if needed */}
                {images.length < 2 && (
                  <div className="mt-2 flex space-x-1.5">
                    <input
                      type="url"
                      value={directUrlInput}
                      onChange={(e) => setDirectUrlInput(e.target.value)}
                      placeholder="또는 이미지 웹 링크(URL) 직접 입력"
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 focus:bg-white focus:ring-1 focus:ring-pink-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddDirectUrl}
                      disabled={!directUrlInput.trim()}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs rounded-lg transition cursor-pointer"
                    >
                      링크 추가
                    </button>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">메모 / 특이사항</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="예: 면세 할인 쿠폰 제시 필수, 유통기한 확인"
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-pink-500 focus:outline-none resize-none"
                />
              </div>

              {/* Purchased Checkbox */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs text-slate-800">구입 완료 여부</div>
                  <div className="text-[11px] text-slate-500">이미 구매했거나 먹은 항목인 경우 체크하세요.</div>
                </div>
                <input
                  type="checkbox"
                  checked={isPurchased}
                  onChange={(e) => setIsPurchased(e.target.checked)}
                  className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500 cursor-pointer"
                />
              </div>

              {/* Modal Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={(e) => handleRequestDeleteItem(editingItem, e)}
                    className="px-3.5 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition flex items-center space-x-1 border border-rose-200/60 cursor-pointer"
                    title="이 기념품 항목 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>항목 삭제</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={requestCloseModal}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition cursor-pointer"
                  >
                    {editingItem ? '수정 저장' : '기념품 추가'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ⚠️ EXIT CONFIRMATION DIALOG MODAL ("입력을 중단하시겠습니까?") */}
      {showExitConfirm && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancelDiscard();
          }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-5 space-y-4"
          >
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-slate-900">입력을 중단하시겠습니까?</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  작성 중인 내용이 저장되지 않고 사라집니다. 입력을 계속 진행하시겠습니까?
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={handleConfirmDiscard}
                className="px-3.5 py-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                입력 중단 (닫기)
              </button>
              <button
                type="button"
                onClick={handleCancelDiscard}
                className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
              >
                계속 작성하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🏷️ TAG & COLOR MANAGEMENT MODAL */}
      {isTagManagerOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsTagManagerOpen(false);
              setEditingTagColorFor(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col"
          >
            <div className="bg-gradient-to-r from-pink-500 to-rose-600 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-white/20 rounded-xl">
                  <Palette className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold">말머리 & 색상 관리</h3>
                  <p className="text-[11px] text-pink-100">말머리를 추가하고 원하는 색상을 지정해보세요</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTagManagerOpen(false);
                  setEditingTagColorFor(null);
                }}
                className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Add Tag Section */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 space-y-3">
                <label className="block text-xs font-bold text-slate-800">
                  새 말머리 추가
                </label>

                {/* Input and Add Button */}
                <div className="flex space-x-1.5">
                  <input
                    type="text"
                    value={newTagInput}
                    onChange={(e) => {
                      setNewTagInput(e.target.value);
                      if (tagErrorMessage) setTagErrorMessage(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="새 말머리 이름 (예: 베이커리, 문구류)"
                    className="flex-1 px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-pink-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2.5 bg-pink-500 hover:bg-pink-600 text-white text-xs sm:text-sm font-bold rounded-xl transition shadow-xs cursor-pointer shrink-0"
                  >
                    추가
                  </button>
                </div>

                {/* Color Selector for New Tag */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-600">지정할 색상:</span>
                    <span className="font-extrabold text-pink-600">
                      {TAG_COLOR_PALETTE.find((c) => c.id === newTagColor)?.name || '핑크'}
                    </span>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5 pt-0.5">
                    {TAG_COLOR_PALETTE.map((colorOpt) => {
                      const isSelected = newTagColor === colorOpt.id;
                      return (
                        <button
                          key={colorOpt.id}
                          type="button"
                          onClick={() => setNewTagColor(colorOpt.id)}
                          title={`${colorOpt.name} 색상`}
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition cursor-pointer ${colorOpt.dotClass} ${
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-slate-900 scale-110 shadow-xs'
                              : 'opacity-80 hover:opacity-100 hover:scale-105'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {tagErrorMessage && (
                  <p className="text-[11px] font-bold text-rose-500 flex items-center space-x-1 pt-0.5">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{tagErrorMessage}</span>
                  </p>
                )}
              </div>

              {/* Current Tag List with Reordering (Up/Down) & Color Edit */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-700">
                    현재 말머리 목록 ({availableTags.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    색상 뱃지 클릭 시 색상 변경
                  </span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {availableTags.map((t, idx) => {
                    const colorInfo = getTagColorInfo(t, tagColors);
                    const isEditingColor = editingTagColorFor === t;
                    const count = souvenirs.filter((s) => s.tag === t).length;

                    return (
                      <div
                        key={t}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-200/80 space-y-2 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2 min-w-0 flex-1">
                            <span className="text-[11px] font-extrabold text-slate-400 w-4 text-center shrink-0">
                              {idx + 1}
                            </span>
                            
                            {/* Color preview badge / trigger button */}
                            <button
                              type="button"
                              onClick={() => setEditingTagColorFor(isEditingColor ? null : t)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold border transition cursor-pointer flex items-center space-x-1.5 ${colorInfo.badgeClass}`}
                              title="클릭하여 말머리 색상 변경"
                            >
                              <span className={`w-2 h-2 rounded-full ${colorInfo.dotClass}`} />
                              <span className="truncate max-w-[120px]">{t}</span>
                              <Palette className="w-3 h-3 opacity-60 ml-0.5 shrink-0" />
                            </button>

                            <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 shrink-0">
                              ({count}개)
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 shrink-0">
                            {/* Move Up */}
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => handleMoveTagUp(idx)}
                              className={`p-1.5 rounded-lg border transition ${
                                idx === 0
                                  ? 'text-slate-300 border-slate-100 cursor-not-allowed'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white border-slate-200 cursor-pointer shadow-2xs'
                              }`}
                              title="위로 순서 변경"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>

                            {/* Move Down */}
                            <button
                              type="button"
                              disabled={idx === availableTags.length - 1}
                              onClick={() => handleMoveTagDown(idx)}
                              className={`p-1.5 rounded-lg border transition ${
                                idx === availableTags.length - 1
                                  ? 'text-slate-300 border-slate-100 cursor-not-allowed'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-white border-slate-200 cursor-pointer shadow-2xs'
                              }`}
                              title="아래로 순서 변경"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Tag */}
                            <button
                              type="button"
                              onClick={() => handleRequestDeleteTag(t)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer border border-transparent hover:border-rose-200 ml-0.5"
                              title="말머리 삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Color Palette Picker for this existing tag */}
                        {isEditingColor && (
                          <div className="pt-2 border-t border-slate-200/60">
                            <div className="flex items-center justify-between text-[11px] mb-1.5">
                              <span className="text-slate-500 font-bold">'{t}'의 색상 선택:</span>
                              <span className="text-pink-600 font-extrabold">{colorInfo.name}</span>
                            </div>
                            <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                              {TAG_COLOR_PALETTE.map((colorOpt) => {
                                const isCurrent = (tagColors[t] || DEFAULT_TAG_COLORS[t] || 'slate') === colorOpt.id;
                                return (
                                  <button
                                    key={colorOpt.id}
                                    type="button"
                                    onClick={() => handleUpdateTagColor(t, colorOpt.id)}
                                    title={`${colorOpt.name} 색상으로 변경`}
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition cursor-pointer ${colorOpt.dotClass} ${
                                      isCurrent
                                        ? 'ring-2 ring-offset-2 ring-slate-900 scale-110 shadow-xs'
                                        : 'opacity-70 hover:opacity-100 hover:scale-105'
                                    }`}
                                  >
                                    {isCurrent && <Check className="w-3 h-3 text-white stroke-[3]" />}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setIsTagManagerOpen(false);
                    setEditingTagColorFor(null);
                  }}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer shadow-xs"
                >
                  완료
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 IMAGE LIGHTBOX MODAL (Supports Single & Multi-image carousel) */}
      {lightboxImages && lightboxImages.length > 0 && (
        <div
          onClick={() => setLightboxImages(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in cursor-zoom-out"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl max-h-[90vh] flex flex-col items-center justify-center"
          >
            {/* Main Lightbox Image */}
            <div className="relative overflow-hidden rounded-2xl max-h-[80vh] flex items-center justify-center bg-black/40">
              <AsyncSouvenirImg
                src={lightboxImages[lightboxIndex]}
                alt={`확대 사진 ${lightboxIndex + 1}`}
                className="w-auto h-auto max-h-[75vh] max-w-[90vw] object-contain rounded-2xl"
              />

              {/* Prev / Next Buttons if multiple images */}
              {lightboxImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) => (prev > 0 ? prev - 1 : lightboxImages.length - 1));
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition cursor-pointer"
                    title="이전 사진"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxIndex((prev) => (prev < lightboxImages.length - 1 ? prev + 1 : 0));
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 hover:bg-black/90 text-white rounded-full transition cursor-pointer"
                    title="다음 사진"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            {/* Bottom thumbnail & counter navigation */}
            {lightboxImages.length > 1 && (
              <div className="mt-3 flex items-center space-x-2 bg-black/60 px-3 py-1.5 rounded-full">
                {lightboxImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxIndex(idx)}
                    className={`w-9 h-9 rounded-lg overflow-hidden border-2 transition cursor-pointer ${
                      idx === lightboxIndex ? 'border-pink-500 scale-105' : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <AsyncSouvenirImg src={img} alt="썸네일" className="w-full h-full object-cover" />
                  </button>
                ))}
                <span className="text-white text-xs font-bold px-2">
                  {lightboxIndex + 1} / {lightboxImages.length}
                </span>
              </div>
            )}

            {/* Close Lightbox Button */}
            <button
              type="button"
              onClick={() => setLightboxImages(null)}
              className="absolute -top-3 -right-3 sm:top-2 sm:right-2 p-2 bg-black/70 hover:bg-black/95 text-white rounded-full transition cursor-pointer shadow-lg z-10"
              title="닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* 🗑️ SOUVENIR ITEM DELETE CONFIRMATION MODAL ("삭제하시겠습니까?") */}
      {itemToDelete && (
        <div
          onClick={() => setItemToDelete(null)}
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-5 space-y-4"
          >
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-slate-900">삭제하시겠습니까?</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  <span className="font-bold text-slate-900">'{itemToDelete.title}'</span> 기념품 항목을 삭제하시겠습니까?
                  <br />
                  삭제된 항목은 복구할 수 없습니다.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteItem}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🗑️ TAG DELETE CONFIRMATION MODAL */}
      {tagToDelete && (
        <div
          onClick={() => setTagToDelete(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden p-5 space-y-4"
          >
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-slate-900">말머리 삭제</h4>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  <span className="font-bold text-slate-900">'{tagToDelete}'</span> 말머리를 삭제하시겠습니까?
                  <br />
                  기존에 이 말머리로 등록된 항목의 말머리는 유지됩니다.
                </p>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setTagToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTag}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow-xs cursor-pointer"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ DATA BACKUP & RESTORE MODAL */}
      {isBackupModalOpen && (
        <div
          onClick={() => setIsBackupModalOpen(false)}
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
          >
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-xl">
                  <History className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-bold text-base">백업 및 복구</h3>
                  <p className="text-xs text-slate-300 mt-0.5">{currentTab.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="p-1.5 hover:bg-white/10 rounded-xl transition text-white/80 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Auto-Restore Missing Items Action */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <RotateCcw className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-700">누락 항목 복구</span>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerAutoRecover}
                  disabled={isLoadingBackups}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition shrink-0 cursor-pointer"
                >
                  복구 실행
                </button>
              </div>

              {/* History Snapshots List */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-slate-700">백업 기록 ({backupsList.length}개)</h4>
                </div>

                {isLoadingBackups ? (
                  <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                    <span className="text-xs font-medium">불러오는 중...</span>
                  </div>
                ) : backupsList.length === 0 ? (
                  <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                    저장된 백업 기록이 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {backupsList.map((backup) => {
                      const tabItemCount = getSouvenirItemsForTab(backup.trip, currentTab.id, currentTab.title).length;
                      return (
                        <div
                          key={backup.id}
                          className="bg-white hover:bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between gap-2 transition"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-bold text-slate-800">{backup.dateStr}</span>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-pink-100 text-pink-700">
                                {tabItemCount}개
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRestoreBackup(backup)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-emerald-600 hover:text-white text-slate-700 font-bold text-xs rounded-lg transition shrink-0 cursor-pointer"
                          >
                            복원
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsBackupModalOpen(false)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
