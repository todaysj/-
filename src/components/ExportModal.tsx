import React, { useState, useRef } from 'react';
import { Trip, CategoryType } from '../types';
import {
  X,
  FileText,
  FileJson,
  FileSpreadsheet,
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
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import {
  exportTripAsMarkdownFile,
  exportTripAsJSONFile,
  generateTripMarkdown
} from '../utils/exportUtils';
import html2pdf from 'html2pdf.js';

interface ExportModalProps {
  trip: Trip;
  onClose: () => void;
  onImportTrip?: (importedTrip: Trip) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  trip,
  onClose,
  onImportTrip
}) => {
  const [copied, setCopied] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [activePreviewTab, setActivePreviewTab] = useState<'visual' | 'markdown'>('visual');

  const pdfTemplateRef = useRef<HTMLDivElement>(null);
  const markdownContent = generateTripMarkdown(trip);

  const cleanTitle = trip.title.replace(/[/\\?%*:|"<>]/g, '_');

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
          // If it is not part of our React modal
          if (!htmlEl.querySelector('[data-modal-container]')) {
            try {
              htmlEl.remove();
            } catch {
              // ignore
            }
          }
        }
      });
    } catch (e) {
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
  React.useEffect(() => {
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
    const start = new Date(trip.startDate);
    const end = new Date(trip.endDate);
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
        filename: `${cleanTitle}_여행일정표.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          allowTaint: true,
          imageTimeout: 4000,
          logging: false,
          windowWidth: 794
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      // Bounded race to guarantee it resolves within 7 seconds
      await Promise.race([
        html2pdf().set(opt).from(clone).save(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('PDF generation timeout')), 7000))
      ]);
    } catch (error) {
      console.error('PDF export fallback:', error);
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
          <title>${trip.title} - 일정표</title>
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
        const json = JSON.parse(event.target?.result as string);
        if (!json.title || !json.schedule || !Array.isArray(json.schedule)) {
          throw new Error('올바른 J플래너 일정 데이터 형식이 아닙니다.');
        }
        const imported: Trip = {
          ...json,
          id: json.id || `imported-${Date.now()}`
        };
        if (onImportTrip) {
          onImportTrip(imported);
          alert(`'${imported.title}' 여행 일정을 성공적으로 불러왔습니다!`);
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
              <p className="text-xs text-slate-400">PDF(그림·서식 포함), 마크다운, 데이터 백업 등 원하시는 형태로 저장하세요</p>
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
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1">
          
          {/* Main Action Banner: PDF Direct Download */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-sky-900 via-indigo-900 to-slate-900 text-white shadow-md border border-sky-700/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-400/30 text-xs font-bold rounded-full mb-1">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>이미지·디자인 형태 완벽 보존</span>
              </div>
              <h4 className="text-base sm:text-lg font-extrabold text-white">
                📄 PDF 디자인 문서 파일로 저장
              </h4>
              <p className="text-xs text-slate-300 max-w-lg">
                커버 사진, 동선 타임라인, 색상 뱃지, 예약 서류 및 가계부 서식이 깔끔하게 적용된 고화질 PDF 파일을 생성하여 다운로드합니다.
              </p>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <button
                onClick={handleDownloadPDF}
                disabled={isGeneratingPDF}
                className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-2 px-5 py-3 bg-sky-500 hover:bg-sky-400 text-white text-xs sm:text-sm font-bold rounded-xl shadow-lg transition disabled:opacity-50"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>PDF 생성 중...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>PDF 다운로드</span>
                  </>
                )}
              </button>

              <button
                onClick={handlePrint}
                className="inline-flex items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl border border-slate-700 transition"
                title="인쇄 또는 PDF 인쇄"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>
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
                  노션, 옵시디언 또는 가벼운 텍스트 에디터에 그대로 붙여넣고 편집할 수 있는 마크다운 문구 파일입니다.
                </p>
              </div>
              <button
                onClick={() => exportTripAsMarkdownFile(trip)}
                className="w-full inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.md 파일 다운로드</span>
              </button>
            </div>

            {/* Download JSON Data */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-white transition flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center space-x-2 text-slate-800 font-bold text-sm mb-1">
                  <FileJson className="w-4 h-4 text-indigo-600" />
                  <span>백업 데이터 파일 (.json)</span>
                </div>
                <p className="text-xs text-slate-500">
                  나중에 다른 기기나 친구의 플래너로 그대로 복원 및 동기화할 수 있는 원본 JSON 데이터 파일입니다.
                </p>
              </div>
              <button
                onClick={() => exportTripAsJSONFile(trip)}
                className="w-full inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg shadow-sm transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>.json 데이터 백업</span>
              </button>
            </div>
          </div>

          {/* Secondary Utilities: Copy Text & Import */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button
              onClick={handleCopyMarkdown}
              className="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-500" />}
              <span>{copied ? '전체 일정 텍스트 복사 완료!' : '클립보드로 일정 텍스트 복사'}</span>
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
                <span>저장될 파일 미리보기</span>
              </span>

              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setActivePreviewTab('visual')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                    activePreviewTab === 'visual'
                      ? 'bg-white text-slate-800 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  🖼️ 비주얼 PDF 형태 (그림·서식 포함)
                </button>
                <button
                  onClick={() => setActivePreviewTab('markdown')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
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
            <div className={`border border-slate-200 rounded-xl bg-slate-100 p-3 sm:p-4 max-h-[500px] overflow-y-auto ${activePreviewTab === 'markdown' ? 'hidden' : 'block'}`}>
              <div
                id="pdf-export-template"
                ref={pdfTemplateRef}
                className="bg-white p-6 sm:p-8 rounded-xl shadow-md text-slate-800 max-w-3xl mx-auto space-y-6 font-sans text-xs"
              >
                  {/* PDF Cover Header Banner */}
                  <div className="relative rounded-xl overflow-hidden bg-slate-900 text-white p-6 shadow-inner">
                    <img
                      src={trip.coverImage}
                      alt={trip.title}
                      crossOrigin="anonymous"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 w-full h-full object-cover opacity-45"
                    />
                    <div className="relative z-10 space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="px-2.5 py-0.5 bg-sky-500 text-white font-bold text-[11px] rounded-full">
                          📍 {trip.destination}
                        </span>
                        <span className="px-2.5 py-0.5 bg-slate-800/90 text-slate-200 font-semibold text-[11px] rounded-full border border-slate-700">
                          📅 {trip.startDate} ~ {trip.endDate}
                        </span>
                      </div>
                      <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white pt-1">
                        {trip.title}
                      </h1>
                      <div className="flex items-center space-x-4 text-[11px] text-slate-300 pt-1">
                        <span>총 여행 기간: <strong>{totalDays}일</strong></span>
                        <span>일정 항목: <strong>{trip.schedule.length}개</strong></span>
                        <span>예약 서류: <strong>{trip.reservations.length}건</strong></span>
                        <span>예산: <strong>{trip.totalBudget.toLocaleString()} {trip.currency}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* PDF Itinerary Day-by-Day Section */}
                  <div className="space-y-4">
                    <h2 className="text-sm font-bold text-slate-900 pb-1.5 border-b-2 border-sky-500 flex items-center space-x-1.5">
                      <Calendar className="w-4 h-4 text-sky-600" />
                      <span>📅 일자별 상세 일정 (Day-by-Day Itinerary)</span>
                    </h2>

                    {Array.from({ length: totalDays }, (_, i) => i + 1).map((dayNum) => {
                      const dayDate = new Date(trip.startDate);
                      dayDate.setDate(dayDate.getDate() + (dayNum - 1));
                      const dateStr = `${dayDate.getMonth() + 1}월 ${dayDate.getDate()}일 (${['일', '월', '화', '수', '목', '금', '토'][dayDate.getDay()]})`;

                      const daySchedules = trip.schedule
                        .filter((s) => s.day === dayNum)
                        .sort((a, b) => a.time.localeCompare(b.time));

                      return (
                        <div key={dayNum} className="space-y-2 bg-slate-50/70 p-3 rounded-lg border border-slate-200/80">
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
                                      <h4 className="font-bold text-slate-800 text-xs">
                                        {item.isDone ? '✅ ' : '📌 '}{item.title}
                                      </h4>
                                      <p className="text-[11px] text-slate-600 flex items-center">
                                        <MapPin className="w-3 h-3 text-rose-500 mr-0.5" />
                                        {item.location}
                                      </p>
                                      {item.notes && (
                                        <p className="text-[10.5px] text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100">
                                          💡 {item.notes}
                                        </p>
                                      )}
                                    </div>

                                    {item.cost > 0 && (
                                      <div className="text-right font-bold text-[11px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200/60 whitespace-nowrap">
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
                    })}
                  </div>

                  {/* PDF Reservations Vouchers Section */}
                  {trip.reservations.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h2 className="text-sm font-bold text-slate-900 pb-1.5 border-b-2 border-indigo-500 flex items-center space-x-1.5">
                        <Ticket className="w-4 h-4 text-indigo-600" />
                        <span>🎫 예약 서류함 (Reservations)</span>
                      </h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {trip.reservations.map((res) => (
                          <div key={res.id} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                            <div className="flex items-center justify-between font-bold text-xs text-slate-800">
                              <span>{res.title}</span>
                              <span className="font-mono text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
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
                    </div>
                  )}

                  {/* PDF Checklist Section */}
                  {trip.packingList.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <h2 className="text-sm font-bold text-slate-900 pb-1.5 border-b-2 border-emerald-500 flex items-center space-x-1.5">
                        <CheckSquare className="w-4 h-4 text-emerald-600" />
                        <span>🎒 준비물 체크리스트 (Packing Checklist)</span>
                      </h2>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {trip.packingList.map((p) => (
                          <div key={p.id} className="p-1.5 bg-slate-50 rounded border border-slate-200 text-[11px] flex items-center justify-between">
                            <span className={p.isPacked ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}>
                              {p.isPacked ? '☑' : '☐'} {p.title}
                            </span>
                            {p.isEssential && <span className="text-[9px] text-amber-600 font-bold">필수</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer note in PDF */}
                  <div className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400">
                    J플래너(Smart Travel Planner)에서 내보낸 일정표 파일입니다.
                  </div>
                </div>
              </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-3 flex justify-end flex-shrink-0">
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

