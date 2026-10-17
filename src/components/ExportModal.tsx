import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Trip, CategoryType } from '../types';
import {
  X,
  FileText,
  FileJson,
  Download,
  Copy,
  Check,
  Upload,
  Sparkles,
  Printer,
  Calendar,
  MapPin,
  Clock,
  Ticket,
  Wallet,
  CheckSquare,
  Gift,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  SlidersHorizontal,
  AlertCircle
} from 'lucide-react';
import {
  exportTripAsMarkdownFile,
  exportTripAsJSONFile,
  exportFullBackupJSONFile,
  generateTripMarkdown,
  ExportSectionOptions
} from '../utils/exportUtils';
import { parseTripBackup } from '../utils/backupUtils';
import { getTripChecklistTabs, getTripSouvenirTabs, getTagColorInfo } from '../utils/tabUtils';
import { resolveTripPhotos } from '../utils/imageUtils';
import html2pdf from 'html2pdf.js';

interface ExportModalProps {
  trip: Trip;
  allTrips?: Trip[];
  brandSettings?: any;
  onClose: () => void;
  onImportTrip?: (importedTrip: Trip) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  trip,
  allTrips,
  brandSettings,
  onClose,
  onImportTrip
}) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isExportingJSON, setIsExportingJSON] = useState(false);
  const [isExportingAllJSON, setIsExportingAllJSON] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'visual' | 'markdown'>('visual');

  // Resolved trip with all IndexedDB photos converted to real base64 data URLs for pristine PDF rendering
  const [resolvedTrip, setResolvedTrip] = useState<Trip>(trip);
  const [isResolvingPhotos, setIsResolvingPhotos] = useState<boolean>(true);

  // PDF Section selection state
  const [exportSections, setExportSections] = useState<ExportSectionOptions>({
    cover: true,
    schedule: true,
    checklist: true,
    souvenirs: true,
    reservations: true,
    expenses: true
  });

  const pdfTemplateRef = useRef<HTMLDivElement>(null);

  // Load photos (cover, souvenirs, vouchers) for pristine offline PDF export
  useEffect(() => {
    let isMounted = true;
    setIsResolvingPhotos(true);
    resolveTripPhotos(trip)
      .then((res) => {
        if (isMounted) {
          setResolvedTrip(res);
        }
      })
      .catch((err) => {
        console.warn('Failed to resolve photos for PDF export:', err);
      })
      .finally(() => {
        if (isMounted) setIsResolvingPhotos(false);
      });
    return () => {
      isMounted = false;
    };
  }, [trip]);

  // Checklist tabs and items
  const checklistTabs = useMemo(() => getTripChecklistTabs(resolvedTrip), [resolvedTrip]);
  const totalChecklistItems = useMemo(
    () => checklistTabs.reduce((sum, tab) => sum + (tab.items?.length || 0), 0),
    [checklistTabs]
  );

  // Souvenir tabs and items
  const souvenirTabs = useMemo(() => getTripSouvenirTabs(resolvedTrip), [resolvedTrip]);
  const totalSouvenirs = useMemo(
    () => souvenirTabs.reduce((sum, tab) => sum + (tab.items?.length || 0), 0),
    [souvenirTabs]
  );

  const totalSchedules = resolvedTrip.schedule?.length || 0;
  const totalReservations = resolvedTrip.reservations?.length || 0;
  const totalExpenses = resolvedTrip.expenses?.length || 0;

  // Selected sections count
  const selectedSectionsCount = useMemo(() => {
    return Object.values(exportSections).filter(Boolean).length;
  }, [exportSections]);

  const hasAnySectionSelected = selectedSectionsCount > 0;

  // Toggle single section
  const handleToggleSection = (key: keyof ExportSectionOptions) => {
    setExportSections((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Section selection presets
  const handleSelectAllSections = () => {
    setExportSections({
      cover: true,
      schedule: true,
      checklist: true,
      souvenirs: true,
      reservations: true,
      expenses: true
    });
  };

  const handleDeselectAllSections = () => {
    setExportSections({
      cover: false,
      schedule: false,
      checklist: false,
      souvenirs: false,
      reservations: false,
      expenses: false
    });
  };

  const handlePresetScheduleOnly = () => {
    setExportSections({
      cover: true,
      schedule: true,
      reservations: true,
      checklist: false,
      souvenirs: false,
      expenses: false
    });
  };

  const handlePresetPrepAndShopping = () => {
    setExportSections({
      cover: true,
      schedule: false,
      reservations: false,
      checklist: true,
      souvenirs: true,
      expenses: false
    });
  };

  // Markdown content dynamically updated based on chosen export sections
  const markdownContent = useMemo(
    () => generateTripMarkdown(resolvedTrip, exportSections),
    [resolvedTrip, exportSections]
  );

  const cleanTitle = (resolvedTrip.title || trip.title).replace(/[/\\?%*:|"<>]/g, '_');

  // Comprehensive cleanup of html2pdf and html2canvas overlay elements so UI never becomes unresponsive
  const cleanupLingeringOverlays = () => {
    try {
      const selectors = [
        '.html2pdf__overlay',
        '.html2pdf__container',
        '.html2canvas-container',
        '#pdf-export-offscreen-wrapper',
        'div[class*="html2pdf"]',
        'div[class*="html2canvas"]',
        'iframe[name^="__html2pdf"]',
        'iframe[id^="__html2pdf"]'
      ];
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          try {
            el.remove();
          } catch {
            // ignore
          }
        });
      });

      // Remove any full-viewport fixed overlay div created outside the root container
      document.querySelectorAll('body > div').forEach((div) => {
        if (div.id === 'root') return;
        const htmlEl = div as HTMLElement;
        if (
          htmlEl.style.position === 'fixed' &&
          (htmlEl.className.includes('html2') || htmlEl.style.zIndex === '2147483647' || htmlEl.style.zIndex === '999999' || !htmlEl.id)
        ) {
          if (!htmlEl.querySelector('[data-modal-container]')) {
            try {
              htmlEl.remove();
            } catch {
              // ignore
            }
          }
        }
      });
    } catch {
      // ignore
    }
  };

  // Robust Modal Close Handler (cleans up any lingering overlays/artifacts)
  const handleModalClose = () => {
    setIsGeneratingPDF(false);
    cleanupLingeringOverlays();
    onClose();
  };

  // Handle ESC key to close modal & unmount cleanup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleModalClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      cleanupLingeringOverlays();
    };
  }, []);

  // Calculate Days
  const getDaysCount = () => {
    const start = new Date(resolvedTrip.startDate);
    const end = new Date(resolvedTrip.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
  };

  const totalDays = getDaysCount();

  // Pure JS OKLCH to RGB/RGBA string converter with native canvas fallback (so html2canvas CSS parser never encounters 'oklch(...)')
  const oklchToRgbString = (oklchStr: string): string => {
    try {
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#010203';
          ctx.fillStyle = oklchStr;
          if (ctx.fillStyle && ctx.fillStyle !== '#010203') {
            return ctx.fillStyle;
          }
        }
      }
    } catch {
      // fallback
    }

    try {
      const match = oklchStr.match(/oklch\(\s*([0-9.%]+)[\s,]+([0-9.%]+)[\s,]+([0-9.%a-zA-Z]+)(?:[\s,/]+([0-9.%]+))?\s*\)/i);
      if (!match) return 'rgb(100, 116, 139)';

      let l = parseFloat(match[1]);
      if (match[1].includes('%')) l = l / 100;

      let c = parseFloat(match[2]);
      if (match[2].includes('%')) c = (c / 100) * 0.4;

      let h = parseFloat(match[3]);

      let alpha = 1;
      if (match[4] !== undefined) {
        alpha = parseFloat(match[4]);
        if (match[4].includes('%')) alpha = alpha / 100;
      }

      const hRad = (h * Math.PI) / 180;
      const aOklab = c * Math.cos(hRad);
      const bOklab = c * Math.sin(hRad);

      const l_ = l + 0.3963377774 * aOklab + 0.2158037573 * bOklab;
      const m_ = l - 0.1055613458 * aOklab - 0.0638541728 * bOklab;
      const s_ = l - 0.0894841775 * aOklab - 1.2914855480 * bOklab;

      const lLinear = l_ * l_ * l_;
      const mLinear = m_ * m_ * m_;
      const sLinear = s_ * s_ * s_;

      const rLin = +4.0767416621 * lLinear - 3.3077115913 * mLinear + 0.2309699292 * sLinear;
      const gLin = -1.2684380046 * lLinear + 2.6097574011 * mLinear - 0.3413193965 * sLinear;
      const bLin = -0.0041960863 * lLinear - 0.7034186147 * mLinear + 1.7076147010 * sLinear;

      const gamma = (val: number) => {
        if (val <= 0.0031308) return 12.92 * val;
        return 1.055 * Math.pow(Math.max(0, val), 1 / 2.4) - 0.055;
      };

      const r = Math.min(255, Math.max(0, Math.round(gamma(rLin) * 255)));
      const g = Math.min(255, Math.max(0, Math.round(gamma(gLin) * 255)));
      const b = Math.min(255, Math.max(0, Math.round(gamma(bLin) * 255)));

      if (alpha < 1) {
        return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
      }
      return `rgb(${r}, ${g}, ${b})`;
    } catch {
      return 'rgb(100, 116, 139)';
    }
  };

  const inlineStylesForPdf = (sourceEl: HTMLElement, targetEl: HTMLElement) => {
    const sourceNodes = [sourceEl, ...Array.from(sourceEl.querySelectorAll('*'))] as HTMLElement[];
    const targetNodes = [targetEl, ...Array.from(targetEl.querySelectorAll('*'))] as HTMLElement[];

    const styleProps = [
      'background-color', 'color', 'border-top-color', 'border-right-color',
      'border-bottom-color', 'border-left-color', 'border-top-width',
      'border-right-width', 'border-bottom-width', 'border-left-width', 'border-style',
      'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius',
      'border-bottom-right-radius', 'font-size', 'font-weight', 'font-family', 'line-height',
      'letter-spacing', 'text-align', 'padding-top', 'padding-right', 'padding-bottom',
      'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
      'display', 'flex-direction', 'justify-content', 'align-items', 'flex-wrap', 'gap',
      'row-gap', 'column-gap', 'width', 'height', 'min-width', 'max-width', 'min-height',
      'max-height', 'box-shadow', 'opacity', 'overflow', 'position'
    ];

    for (let i = 0; i < sourceNodes.length; i++) {
      const s = sourceNodes[i];
      const c = targetNodes[i];
      if (!s || !c) continue;

      const computed = window.getComputedStyle(s);
      styleProps.forEach((prop) => {
        try {
          const val = computed.getPropertyValue(prop);
          if (val && val !== 'none' && val !== 'auto' && val !== 'normal' && val !== '0px' && val !== 'rgba(0, 0, 0, 0)') {
            const safeVal = val.includes('oklch')
              ? val.replace(/oklch\([^)]+\)/gi, (m) => oklchToRgbString(m))
              : val;
            c.style.setProperty(prop, safeVal);
          }
        } catch {
          // ignore
        }
      });

      if (c.tagName === 'IMG') {
        (c as HTMLImageElement).crossOrigin = 'anonymous';
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!hasAnySectionSelected) {
      alert('최소 1개 이상의 내보내기 항목(일정, 체크리스트, 기념품 등)을 선택해주세요.');
      return;
    }

    if (!pdfTemplateRef.current) return;
    if (activePreviewTab !== 'visual') {
      setActivePreviewTab('visual');
    }
    setIsGeneratingPDF(true);

    // Yield execution to allow React to update UI tab and spinner
    await new Promise((resolve) => setTimeout(resolve, 250));

    let wrapper: HTMLDivElement | null = null;
    let origGetComputedStyle: typeof window.getComputedStyle | null = null;
    const disabledStyles: (HTMLStyleElement | HTMLLinkElement)[] = [];

    try {
      const sourceEl = pdfTemplateRef.current;

      // 1. Clone source element and inline computed styles (converting oklch to rgb)
      const clone = sourceEl.cloneNode(true) as HTMLElement;
      inlineStylesForPdf(sourceEl, clone);

      // 2. Attach clone to hidden offscreen container
      wrapper = document.createElement('div');
      wrapper.id = 'pdf-export-offscreen-wrapper';
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-9999px';
      wrapper.style.top = '0';
      wrapper.style.width = '794px';
      wrapper.style.backgroundColor = '#ffffff';
      wrapper.style.zIndex = '-9999';
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);

      // 3. Temporarily proxy window.getComputedStyle to sanitize any remaining oklch values
      origGetComputedStyle = window.getComputedStyle;
      const sanitizeOklchInString = (str: string): string => {
        if (!str || typeof str !== 'string' || !str.includes('oklch')) return str;
        return str.replace(/oklch\([^)]+\)/gi, (m) => oklchToRgbString(m));
      };

      window.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
        const style = origGetComputedStyle!.call(window, elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop, receiver) {
            if (prop === 'getPropertyValue') {
              return (propertyName: string) => {
                const val = target.getPropertyValue(propertyName);
                return sanitizeOklchInString(val);
              };
            }
            const val = Reflect.get(target, prop, target);
            if (typeof val === 'function') {
              return val.bind(target);
            }
            if (typeof val === 'string' && val.includes('oklch')) {
              return sanitizeOklchInString(val);
            }
            return val;
          }
        });
      };

      // 4. Temporarily disable document stylesheets so html2canvas doesn't parse Tailwind v4 oklch rules
      const allStyleNodes = Array.from(document.querySelectorAll<HTMLStyleElement | HTMLLinkElement>('style, link[rel="stylesheet"]'));
      allStyleNodes.forEach((node) => {
        try {
          if (!node.disabled) {
            node.disabled = true;
            disabledStyles.push(node);
          }
        } catch {
          // ignore
        }
      });

      const opt = {
        margin: 8,
        filename: `${cleanTitle}_맞춤_여행일정표.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 1.25,
          useCORS: true,
          allowTaint: true,
          imageTimeout: 2000,
          logging: false,
          windowWidth: 794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      // Bounded race with generous 30s timeout so PDF generation comfortably completes without premature abort
      await Promise.race([
        html2pdf().set(opt).from(clone).save(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PDF generation timeout')), 30000))
      ]);
    } catch (error) {
      console.warn('PDF direct save notice, falling back to print dialog:', error);
      // Fallback to print window
      handlePrint();
    } finally {
      // Restore getComputedStyle
      if (origGetComputedStyle) {
        window.getComputedStyle = origGetComputedStyle;
      }
      // Restore disabled stylesheets
      disabledStyles.forEach((node) => {
        try {
          node.disabled = false;
        } catch {
          // ignore
        }
      });
      // Remove wrapper
      if (wrapper && wrapper.parentNode) {
        wrapper.parentNode.removeChild(wrapper);
      }
      // Clean up any lingering html2pdf overlay containers immediately and with deferred retries
      cleanupLingeringOverlays();
      setTimeout(cleanupLingeringOverlays, 50);
      setTimeout(cleanupLingeringOverlays, 200);
      setTimeout(cleanupLingeringOverlays, 600);
      setTimeout(cleanupLingeringOverlays, 1200);
      setIsGeneratingPDF(false);
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrint = () => {
    if (!pdfTemplateRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${resolvedTrip.title} - 여행 일정표</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { margin: 10mm; size: A4 portrait; }
            }
          </style>
        </head>
        <body class="bg-white p-6 text-slate-800">
          ${pdfTemplateRef.current.innerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const result = parseTripBackup(text);
        if (onImportTrip && result.trips.length > 0) {
          const target = result.trips.find((t) => t.id === result.targetTripId) || result.trips[0];
          onImportTrip(target);
          alert(result.message);
          onClose();
        }
      } catch (err: any) {
        setImportError(err.message || '파일을 읽는 중 오류가 발생했습니다.');
      }
    };
    reader.readAsText(file);
  };

  // Category labels helper for PDF template
  const getCategoryBadge = (cat: CategoryType) => {
    switch (cat) {
      case 'FLIGHT': return { label: '항공', bg: 'bg-indigo-100 text-indigo-800 border-indigo-200' };
      case 'ACCOMMODATION': return { label: '숙소', bg: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'FOOD': return { label: '음식', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'SIGHTSEEING': return { label: '관광/체험', bg: 'bg-sky-100 text-sky-800 border-sky-200' };
      case 'SHOPPING': return { label: '쇼핑', bg: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'TRANSPORT': return { label: '교통', bg: 'bg-orange-100 text-orange-800 border-orange-200' };
      default: return { label: '기타', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleModalClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-sm animate-fade-in"
    >
      <div
        data-modal-container="true"
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh] relative z-10"
      >
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-tr from-sky-500 to-indigo-600 text-white rounded-xl shadow-md">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">완성된 여행 일정 파일 저장</h3>
              <p className="text-xs text-slate-400">PDF(원하는 항목 선택), 마크다운, 데이터 백업 등 자유롭게 저장하세요</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="닫기 (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Main Action Banner: PDF Direct Download */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white shadow-md border border-sky-700/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-400/30 text-xs font-bold rounded-full mb-1">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>선택 항목 맞춤형 PDF 생성</span>
              </div>
              <h4 className="text-base sm:text-lg font-extrabold text-white">
                📄 PDF 디자인 문서 파일로 저장
              </h4>
              <p className="text-xs text-slate-300 max-w-lg">
                아래에서 원하는 항목(일정, 체크리스트, 기념품 등)을 선택한 뒤 [PDF 다운로드]를 누르면 맞춤형 고화질 문서가 저장됩니다.
              </p>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF || !hasAnySectionSelected}
                className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-5 py-3 bg-sky-500 hover:bg-sky-400 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>PDF 생성 중...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>PDF 다운로드 ({selectedSectionsCount}개 항목)</span>
                  </>
                )}
              </button>

              <button
                onClick={handlePrint}
                disabled={!hasAnySectionSelected}
                className="inline-flex items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition disabled:opacity-50 cursor-pointer"
                title="인쇄 또는 PDF 인쇄"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Section Selection Card: User Requested Item Selection */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3.5 shadow-2xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-sky-600" />
                <h4 className="font-extrabold text-sm text-slate-900">
                  PDF 내보내기 항목 선택
                </h4>
                <span className="text-[11px] font-bold px-2.5 py-0.5 bg-sky-100 text-sky-800 rounded-full border border-sky-200">
                  {selectedSectionsCount} / 6개 선택
                </span>
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllSections}
                  className="px-2.5 py-1 text-xs font-bold text-sky-700 bg-white hover:bg-sky-50 rounded-lg border border-sky-200 transition shadow-2xs cursor-pointer"
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllSections}
                  className="px-2.5 py-1 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition shadow-2xs cursor-pointer"
                >
                  전체 해제
                </button>
                <button
                  type="button"
                  onClick={handlePresetScheduleOnly}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition shadow-2xs cursor-pointer"
                  title="일정과 예약 서류만 포함"
                >
                  일정 중심
                </button>
                <button
                  type="button"
                  onClick={handlePresetPrepAndShopping}
                  className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition shadow-2xs cursor-pointer"
                  title="준비물 체크리스트와 기념품 목록만 포함"
                >
                  체크·기념품만
                </button>
              </div>
            </div>

            {/* Checkbox Options Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              
              {/* 1. Cover & Summary */}
              <button
                type="button"
                onClick={() => handleToggleSection('cover')}
                className={`p-3 rounded-xl border text-left transition flex items-start space-x-2.5 cursor-pointer ${
                  exportSections.cover
                    ? 'bg-sky-50/70 border-sky-400 ring-2 ring-sky-200/60 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 opacity-70'
                }`}
              >
                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                  exportSections.cover ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {exportSections.cover && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center space-x-1 font-bold text-xs text-slate-800">
                    <span>🖼️ 표지 및 요약</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 truncate mt-0.5">커버 사진, 기간, 총 예산</p>
                </div>
              </button>

              {/* 2. Schedule */}
              <button
                type="button"
                onClick={() => handleToggleSection('schedule')}
                className={`p-3 rounded-xl border text-left transition flex items-start space-x-2.5 cursor-pointer ${
                  exportSections.schedule
                    ? 'bg-sky-50/70 border-sky-400 ring-2 ring-sky-200/60 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 opacity-70'
                }`}
              >
                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                  exportSections.schedule ? 'bg-sky-500 border-sky-500 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {exportSections.schedule && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">📅 상세 일정</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-sky-100 text-sky-700 rounded-full">
                      {totalSchedules}개
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 truncate mt-0.5">Day별 동선, 시간, 메모</p>
                </div>
              </button>

              {/* 3. Checklist */}
              <button
                type="button"
                onClick={() => handleToggleSection('checklist')}
                className={`p-3 rounded-xl border text-left transition flex items-start space-x-2.5 cursor-pointer ${
                  exportSections.checklist
                    ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-200/60 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 opacity-70'
                }`}
              >
                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                  exportSections.checklist ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {exportSections.checklist && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">🎒 체크리스트</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-100 text-emerald-700 rounded-full">
                      {totalChecklistItems}개
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 truncate mt-0.5">동행인 탭별 준비물, 필수품</p>
                </div>
              </button>

              {/* 4. Souvenirs */}
              <button
                type="button"
                onClick={() => handleToggleSection('souvenirs')}
                className={`p-3 rounded-xl border text-left transition flex items-start space-x-2.5 cursor-pointer ${
                  exportSections.souvenirs
                    ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-200/60 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 opacity-70'
                }`}
              >
                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                  exportSections.souvenirs ? 'bg-purple-600 border-purple-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {exportSections.souvenirs && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">🎁 기념품·쇼핑</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-purple-100 text-purple-700 rounded-full">
                      {totalSouvenirs}개
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 truncate mt-0.5">사진, 말머리, 선물대상, 가격</p>
                </div>
              </button>

              {/* 5. Reservations */}
              <button
                type="button"
                onClick={() => handleToggleSection('reservations')}
                className={`p-3 rounded-xl border text-left transition flex items-start space-x-2.5 cursor-pointer ${
                  exportSections.reservations
                    ? 'bg-indigo-50/70 border-indigo-400 ring-2 ring-indigo-200/60 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 opacity-70'
                }`}
              >
                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                  exportSections.reservations ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {exportSections.reservations && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">🎫 예약 서류함</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full">
                      {totalReservations}건
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 truncate mt-0.5">항공, 호텔, 예약번호 바우처</p>
                </div>
              </button>

              {/* 6. Expenses */}
              <button
                type="button"
                onClick={() => handleToggleSection('expenses')}
                className={`p-3 rounded-xl border text-left transition flex items-start space-x-2.5 cursor-pointer ${
                  exportSections.expenses
                    ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-200/60 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 opacity-70'
                }`}
              >
                <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                  exportSections.expenses ? 'bg-amber-600 border-amber-600 text-white' : 'border-slate-300 bg-white'
                }`}>
                  {exportSections.expenses && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-800">💰 가계부·경비</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-700 rounded-full">
                      {totalExpenses}건
                    </span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 truncate mt-0.5">지출 내역표, 결제 수단</p>
                </div>
              </button>

            </div>

            {!hasAnySectionSelected && (
              <div className="flex items-center space-x-2 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>최소 1개 이상의 항목을 선택해야 PDF를 다운로드할 수 있습니다.</span>
              </div>
            )}
          </div>

          {/* Quick Download Formats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            
            {/* Download Markdown */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white transition flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm mb-1">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span>마크다운 문서 파일 (.md)</span>
                </div>
                <p className="text-xs text-slate-500">
                  선택하신 항목({selectedSectionsCount}개)이 깔끔하게 정리된 텍스트 파일로, 노션이나 옵시디언에 바로 붙여넣을 수 있습니다.
                </p>
              </div>
              <button
                onClick={() => exportTripAsMarkdownFile(resolvedTrip, exportSections)}
                className="w-full inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>선택 항목 .md 다운로드</span>
              </button>
            </div>

            {/* Download JSON Data */}
            <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70 transition flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
                    <FileJson className="w-4 h-4 text-indigo-600" />
                    <span>백업 데이터 파일 (.json)</span>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                    기념품 사진 100% 보존
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  기념품 탭의 고화질 사진을 원본 그대로 포함하여 다른 기기나 브라우저에서 100% 동일하게 복원할 수 있는 완전체 백업 파일입니다.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  onClick={async () => {
                    try {
                      setIsExportingJSON(true);
                      await exportTripAsJSONFile(resolvedTrip);
                    } catch (e: any) {
                      alert('백업 파일 생성 중 오류가 발생했습니다: ' + (e?.message || '알 수 없는 오류'));
                    } finally {
                      setIsExportingJSON(false);
                    }
                  }}
                  disabled={isExportingJSON || isExportingAllJSON}
                  className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                >
                  {isExportingJSON ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>사진 병합 중...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>현재 여행 백업 (.json)</span>
                    </>
                  )}
                </button>

                <button
                  onClick={async () => {
                    try {
                      setIsExportingAllJSON(true);
                      await exportFullBackupJSONFile(allTrips && allTrips.length > 0 ? allTrips : [resolvedTrip], brandSettings);
                    } catch (e: any) {
                      alert('전체 백업 파일 생성 중 오류가 발생했습니다: ' + (e?.message || '알 수 없는 오류'));
                    } finally {
                      setIsExportingAllJSON(false);
                    }
                  }}
                  disabled={isExportingJSON || isExportingAllJSON}
                  className="flex-1 inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg shadow-sm transition disabled:opacity-50 cursor-pointer"
                  title="플래너에 등록된 모든 여행 일정과 기념품 사진 전체를 한 번에 백업합니다"
                >
                  {isExportingAllJSON ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>전체 사진 병합 중...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>전체 여행 통합 백업</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Utilities: Copy Text & Import */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={handleCopyMarkdown}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copied ? '선택 일정 텍스트 복사 완료!' : '선택 일정 텍스트 복사'}</span>
            </button>

            {onImportTrip && (
              <label className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl cursor-pointer transition shadow-sm">
                <Upload className="w-4 h-4 text-slate-500" />
                <span>저장한 .json 일정 불러오기</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {importError && (
            <p className="text-xs text-rose-600 font-semibold bg-rose-50 p-2.5 rounded-lg border border-rose-200">
              ⚠️ {importError}
            </p>
          )}

          {/* Preview Tab Selector */}
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" />
                <span>저장될 파일 실시간 미리보기 ({selectedSectionsCount}개 항목 반영)</span>
              </span>

              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActivePreviewTab('visual')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activePreviewTab === 'visual'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🖼️ 비주얼 PDF 형태
                </button>
                <button
                  onClick={() => setActivePreviewTab('markdown')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                    activePreviewTab === 'markdown'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  📝 마크다운 텍스트
                </button>
              </div>
            </div>

            {/* Markdown Text Preview View */}
            {activePreviewTab === 'markdown' && (
              <pre className="p-4 bg-slate-900 text-slate-200 rounded-xl text-xs font-mono h-80 overflow-y-auto whitespace-pre-wrap leading-relaxed select-all">
                {markdownContent}
              </pre>
            )}

            {/* Visual Formatted PDF Template View */}
            <div className={`border border-slate-200 rounded-xl bg-slate-100 p-3 sm:p-4 max-h-[520px] overflow-y-auto ${activePreviewTab === 'markdown' ? 'hidden' : 'block'}`}>
              <div
                id="pdf-export-template"
                ref={pdfTemplateRef}
                className="bg-white p-6 sm:p-8 rounded-xl shadow-md text-slate-800 max-w-3xl mx-auto space-y-6 font-sans text-xs"
              >
                  {/* PDF Cover Header Banner: Fixed Korean batchim clipping with ample line-height, padding, and break-keep */}
                  {exportSections.cover ? (
                    <div className="relative rounded-xl overflow-hidden bg-slate-900 text-white p-6 shadow-inner" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      {resolvedTrip.coverImage && (
                        <img
                          src={resolvedTrip.coverImage}
                          alt={resolvedTrip.title}
                          crossOrigin="anonymous"
                          referrerPolicy="no-referrer"
                          className="absolute inset-0 w-full h-full object-cover opacity-45"
                        />
                      )}
                      <div className="relative z-10 space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="px-2.5 py-0.5 bg-sky-500 text-white font-bold text-[11px] rounded-full">
                            📍 {resolvedTrip.destination}
                          </span>
                          <span className="px-2.5 py-0.5 bg-slate-800/90 text-slate-200 font-semibold text-[11px] rounded-full border border-slate-700">
                            📅 {resolvedTrip.startDate} ~ {resolvedTrip.endDate}
                          </span>
                        </div>
                        {/* Title with guaranteed Korean batchim preservation */}
                        <h1 className="text-xl sm:text-2xl font-black tracking-normal leading-[1.4] text-white pt-1 pb-2 break-keep korean-title-safe">
                          {resolvedTrip.title}
                        </h1>
                        <div className="flex items-center space-x-4 text-[11px] text-slate-300 pt-0.5 flex-wrap gap-y-1">
                          <span>총 여행 기간: <strong>{totalDays}일</strong></span>
                          {exportSections.schedule && <span>일정 항목: <strong>{totalSchedules}개</strong></span>}
                          {exportSections.reservations && <span>예약 서류: <strong>{totalReservations}건</strong></span>}
                          {exportSections.checklist && <span>준비물: <strong>{totalChecklistItems}개</strong></span>}
                          {exportSections.souvenirs && <span>기념품: <strong>{totalSouvenirs}개</strong></span>}
                          {exportSections.expenses && <span>총 예산: <strong>{resolvedTrip.totalBudget.toLocaleString()} {resolvedTrip.currency}</strong></span>}
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Compact Header when cover banner is omitted */
                    <div className="pb-3 border-b-2 border-slate-800 flex items-center justify-between" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <div>
                        <h1 className="text-lg font-black tracking-normal leading-[1.38] text-slate-900 pb-1 break-keep korean-title-safe">
                          ✈️ {resolvedTrip.title}
                        </h1>
                        <p className="text-[11px] text-slate-600">
                          📍 {resolvedTrip.destination} · 📅 {resolvedTrip.startDate} ~ {resolvedTrip.endDate} ({totalDays}일)
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium">J플래너 여행 일정표</span>
                    </div>
                  )}

                  {/* 1. PDF Itinerary Day-by-Day Section */}
                  {exportSections.schedule && (
                    <div className="space-y-4">
                      <h2 className="text-sm font-bold text-slate-900 pb-1.5 border-b-2 border-sky-500 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <Calendar className="w-4 h-4 text-sky-600" />
                          <span>📅 일자별 상세 일정 (Day-by-Day Itinerary)</span>
                        </div>
                        <span className="text-[11px] font-normal text-slate-500">
                          총 {totalSchedules}개 일정
                        </span>
                      </h2>

                      {totalSchedules === 0 ? (
                        <p className="text-[11px] text-slate-400 italic p-3 bg-slate-50 rounded-lg">등록된 일정이 없습니다.</p>
                      ) : (
                        Array.from({ length: totalDays }, (_, i) => i + 1).map((dayNum) => {
                          const dayDate = new Date(resolvedTrip.startDate);
                          dayDate.setDate(dayDate.getDate() + (dayNum - 1));
                          const dateStr = `${dayDate.getMonth() + 1}월 ${dayDate.getDate()}일 (${['일', '월', '화', '수', '목', '금', '토'][dayDate.getDay()]})`;

                          const daySchedules = (resolvedTrip.schedule || [])
                            .filter((s) => s.day === dayNum)
                            .sort((a, b) => a.time.localeCompare(b.time));

                          return (
                            <div
                              key={dayNum}
                              className="space-y-2 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80"
                              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                            >
                              <div className="flex items-center justify-between font-bold text-slate-800 text-xs">
                                <span className="text-sky-700 font-extrabold">Day {dayNum} ({dateStr})</span>
                                <span className="text-[10px] text-slate-500">{daySchedules.length}개 일정</span>
                              </div>

                              {daySchedules.length === 0 ? (
                                <p className="text-[11px] text-slate-400 italic">등록된 일정 없음</p>
                              ) : (
                                <div className="space-y-2 pt-1">
                                  {daySchedules.map((item) => {
                                    const badge = getCategoryBadge(item.category);
                                    return (
                                      <div
                                        key={item.id}
                                        className="bg-white p-2.5 rounded-md border border-slate-200 flex items-start justify-between gap-2 shadow-2xs"
                                      >
                                        <div className="space-y-1 min-w-0 flex-1">
                                          <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                                            <span className="font-mono font-bold text-[11px] px-1.5 py-0.2 bg-slate-900 text-white rounded">
                                              {item.time}{item.endTime ? ` ~ ${item.endTime}` : ''}
                                            </span>
                                            <span className={`px-1.5 py-0.2 text-[10px] font-semibold rounded ${badge.bg}`}>
                                              {badge.label}
                                            </span>
                                            {item.bookingRef && (
                                              <span className="px-1.5 py-0.2 bg-amber-50 text-amber-800 text-[10px] rounded border border-amber-200">
                                                예약: {item.bookingRef}
                                              </span>
                                            )}
                                          </div>
                                          <h4 className="font-bold text-slate-800 text-xs leading-normal pb-0.5 break-keep">
                                            {item.isDone ? '✅ ' : '📌 '}{item.title}
                                          </h4>
                                          <p className="text-[11px] text-slate-600 flex items-center">
                                            <MapPin className="w-3 h-3 text-rose-500 mr-0.5 shrink-0" />
                                            <span>{item.location}</span>
                                          </p>
                                          {item.notes && (
                                            <p className="text-[10.5px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                                              💡 {item.notes}
                                            </p>
                                          )}
                                        </div>

                                        {item.cost > 0 && (
                                          <div className="text-right font-bold text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200/60 whitespace-nowrap shrink-0">
                                            {item.cost.toLocaleString()} {item.currency}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* 2. PDF Reservations Vouchers Section */}
                  {exportSections.reservations && (
                    <div className="space-y-3 pt-2" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <h2 className="text-sm font-bold text-slate-900 pb-1.5 border-b-2 border-indigo-500 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <Ticket className="w-4 h-4 text-indigo-600" />
                          <span>🎫 예약 서류함 (Reservations)</span>
                        </div>
                        <span className="text-[11px] font-normal text-slate-500">
                          총 {totalReservations}건
                        </span>
                      </h2>

                      {totalReservations === 0 ? (
                        <p className="text-[11px] text-slate-400 italic p-3 bg-slate-50 rounded-lg">등록된 예약 서류가 없습니다.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {(resolvedTrip.reservations || []).map((res) => (
                            <div key={res.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                              <div className="flex items-center justify-between font-bold text-xs text-slate-800">
                                <span className="break-keep">{res.title}</span>
                                <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200 shrink-0">
                                  {res.confirmationNo}
                                </span>
                              </div>
                              <p className="text-[10.5px] text-slate-600">
                                이용일: {res.date} {res.time || ''} | 업체: {res.provider}
                              </p>
                              {res.details && (
                                <p className="text-[10px] text-slate-500 bg-white p-1 rounded border border-slate-200/60">
                                  {res.details}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 3. PDF Checklist Section: Full tabs support */}
                  {exportSections.checklist && (
                    <div className="space-y-3 pt-2">
                      <h2 className="text-sm font-bold text-slate-900 pb-1.5 border-b-2 border-emerald-500 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <CheckSquare className="w-4 h-4 text-emerald-600" />
                          <span>🎒 준비물 체크리스트 (Packing Checklist)</span>
                        </div>
                        <span className="text-[11px] font-normal text-slate-500">
                          총 {totalChecklistItems}개 준비물
                        </span>
                      </h2>

                      {totalChecklistItems === 0 ? (
                        <p className="text-[11px] text-slate-400 italic p-3 bg-slate-50 rounded-lg">등록된 준비물이 없습니다.</p>
                      ) : (
                        checklistTabs.map((tab) => {
                          const items = tab.items || [];
                          if (items.length === 0) return null;

                          return (
                            <div
                              key={tab.id}
                              className="space-y-2 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80"
                              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                            >
                              <div className="flex items-center justify-between font-bold text-slate-800 text-xs pb-1 border-b border-slate-200/60">
                                <span className="text-emerald-700 font-extrabold flex items-center space-x-1">
                                  <span>📁 {tab.title}</span>
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {items.filter((i) => i.isPacked).length}/{items.length}개 준비완료
                                </span>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                                {items.map((p) => (
                                  <div
                                    key={p.id}
                                    className="p-2 bg-white rounded border border-slate-200 text-[11px] flex items-center justify-between gap-1 shadow-2xs"
                                  >
                                    <span className={`break-keep leading-tight ${p.isPacked ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
                                      {p.isPacked ? '☑' : '☐'} {p.title}
                                    </span>
                                    {p.isEssential && (
                                      <span className="text-[9px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded border border-amber-200 font-bold shrink-0">
                                        필수
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* 4. PDF Souvenirs & Shopping Section (Newly Added & Fully Supported) */}
                  {exportSections.souvenirs && (
                    <div className="space-y-3 pt-2">
                      <h2 className="text-sm font-bold text-slate-900 pb-1.5 border-b-2 border-purple-500 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <Gift className="w-4 h-4 text-purple-600" />
                          <span>🎁 기념품 & 쇼핑 리스트 (Souvenirs & Shopping)</span>
                        </div>
                        <span className="text-[11px] font-normal text-slate-500">
                          총 {totalSouvenirs}개 물품
                        </span>
                      </h2>

                      {totalSouvenirs === 0 ? (
                        <p className="text-[11px] text-slate-400 italic p-3 bg-slate-50 rounded-lg">등록된 기념품이나 쇼핑 목록이 없습니다.</p>
                      ) : (
                        souvenirTabs.map((tab) => {
                          const items = tab.items || [];
                          if (items.length === 0) return null;

                          return (
                            <div
                              key={tab.id}
                              className="space-y-2 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80"
                              style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
                            >
                              <div className="flex items-center justify-between font-bold text-slate-800 text-xs pb-1 border-b border-slate-200/60">
                                <span className="text-purple-700 font-extrabold flex items-center space-x-1">
                                  <span>📁 {tab.title}</span>
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {items.filter((i) => i.isPurchased).length}/{items.length}개 구입완료
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {items.map((item) => {
                                  const tagColor = getTagColorInfo(item.tag, tab.tagColors);
                                  const thumb = item.imageUrl || (item.images && item.images[0]);

                                  return (
                                    <div
                                      key={item.id}
                                      className="bg-white p-2.5 rounded-md border border-slate-200 flex items-start space-x-2.5 shadow-2xs"
                                    >
                                      {thumb && (
                                        <img
                                          src={thumb}
                                          alt={item.title}
                                          crossOrigin="anonymous"
                                          className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0 mt-0.5"
                                          onError={(e) => {
                                            (e.target as HTMLElement).style.display = 'none';
                                          }}
                                        />
                                      )}
                                      <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                                          <span className={`px-1.5 py-0.2 text-[10px] font-bold rounded ${tagColor.badgeClass}`}>
                                            {item.tag}
                                          </span>
                                          <span className={`px-1.5 py-0.2 text-[10px] font-semibold rounded ${
                                            item.isPurchased
                                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                                          }`}>
                                            {item.isPurchased ? '✅ 구입완료' : '☐ 미구입'}
                                          </span>
                                        </div>
                                        <h4 className="font-bold text-slate-900 text-xs leading-normal pb-0.5 break-keep">
                                          {item.title}
                                        </h4>
                                        <div className="text-[10.5px] text-slate-600 space-y-0.5">
                                          {item.targetPerson && (
                                            <p className="flex items-center text-slate-700">
                                              <span className="text-slate-400 mr-1">선물:</span>
                                              <span className="font-medium">{item.targetPerson}</span>
                                            </p>
                                          )}
                                          {item.location && (
                                            <p className="flex items-center text-slate-500">
                                              <MapPin className="w-3 h-3 text-rose-500 mr-0.5 shrink-0" />
                                              <span className="truncate">{item.location}</span>
                                            </p>
                                          )}
                                          {item.notes && (
                                            <p className="text-[10px] text-slate-500 bg-slate-50 p-1 rounded border border-slate-100">
                                              💡 {item.notes}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      {item.estimatedPrice && item.estimatedPrice > 0 && (
                                        <div className="text-right font-bold text-[11px] text-purple-800 bg-purple-50 px-2 py-1 rounded border border-purple-200/60 whitespace-nowrap shrink-0">
                                          {item.estimatedPrice.toLocaleString()} {item.currency || resolvedTrip.currency}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* 5. PDF Expenses Section */}
                  {exportSections.expenses && (
                    <div className="space-y-3 pt-2" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                      <h2 className="text-sm font-bold text-slate-900 pb-1.5 border-b-2 border-amber-500 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <Wallet className="w-4 h-4 text-amber-600" />
                          <span>💰 가계부 및 지출 내역 (Expenses)</span>
                        </div>
                        <span className="text-[11px] font-normal text-slate-500">
                          총 {totalExpenses}건
                        </span>
                      </h2>

                      {totalExpenses === 0 ? (
                        <p className="text-[11px] text-slate-400 italic p-3 bg-slate-50 rounded-lg">등록된 지출 내역이 없습니다.</p>
                      ) : (
                        <div className="space-y-2">
                          <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200/80 flex items-center justify-between text-xs">
                            <div>
                              <span className="text-slate-600">총 예산: </span>
                              <span className="font-bold text-slate-900">{resolvedTrip.totalBudget.toLocaleString()} {resolvedTrip.currency}</span>
                            </div>
                            <div>
                              <span className="text-slate-600">총 지출: </span>
                              <span className="font-bold text-amber-800">
                                {(resolvedTrip.expenses || []).reduce((s, e) => s + e.amount, 0).toLocaleString()} {resolvedTrip.currency}
                              </span>
                            </div>
                          </div>

                          <div className="overflow-x-auto border border-slate-200 rounded-lg">
                            <table className="w-full text-[11px] text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                                  <th className="p-2 font-bold">날짜</th>
                                  <th className="p-2 font-bold">항목명</th>
                                  <th className="p-2 font-bold">결제수단</th>
                                  <th className="p-2 font-bold">결제자</th>
                                  <th className="p-2 font-bold text-right">금액</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(resolvedTrip.expenses || []).map((exp) => (
                                  <tr key={exp.id} className="border-b border-slate-100 bg-white hover:bg-slate-50">
                                    <td className="p-2 text-slate-500 whitespace-nowrap">{exp.date}</td>
                                    <td className="p-2 font-medium text-slate-900 break-keep">{exp.title}</td>
                                    <td className="p-2 text-slate-600 whitespace-nowrap">
                                      {exp.paymentMethod === 'CARD' ? '💳 카드' : '💵 현금'}
                                    </td>
                                    <td className="p-2 text-slate-600 whitespace-nowrap">{exp.paidBy}</td>
                                    <td className="p-2 text-right font-bold text-slate-900 whitespace-nowrap">
                                      {exp.amount.toLocaleString()} {exp.currency}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer note in PDF */}
                  <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
                    J플래너(Smart Travel Planner)에서 생성된 여행 문서 파일입니다.
                  </div>
                </div>
              </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-slate-500">
            {selectedSectionsCount}개 항목 선택됨
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs sm:text-sm font-bold rounded-xl transition cursor-pointer shadow-sm"
          >
            닫기
          </button>
        </div>

      </div>
    </div>
  );
};
