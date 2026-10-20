import React, { useState, useEffect } from 'react';
import {
  Database,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  X,
  Sparkles
} from 'lucide-react';
import {
  checkSupabaseTablesExist,
  getSupabaseCredentials,
  getSupabaseProjectRef,
  SUPABASE_SQL_SCHEMA,
  isSupabaseConfigured
} from '../lib/supabase';

interface SupabaseSetupBannerProps {
  onStatusChange?: (isReady: boolean) => void;
}

export const SupabaseSetupBanner: React.FC<SupabaseSetupBannerProps> = ({ onStatusChange }) => {
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [tablesMissing, setTablesMissing] = useState<boolean>(false);
  const [missingList, setMissingList] = useState<string[]>([]);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [showSqlPreview, setShowSqlPreview] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [justVerifiedSuccess, setJustVerifiedSuccess] = useState<boolean>(false);

  const projectRef = getSupabaseProjectRef();
  const { url } = getSupabaseCredentials();

  const sqlEditorUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}/sql/new`
    : 'https://supabase.com/dashboard';

  const verifyConnection = async (manual = false) => {
    if (!isSupabaseConfigured()) {
      setIsChecking(false);
      setTablesMissing(false);
      return;
    }

    if (manual) setIsChecking(true);

    try {
      const res = await checkSupabaseTablesExist();
      if (!res.ok && res.missingTables && res.missingTables.length > 0) {
        setTablesMissing(true);
        setMissingList(res.missingTables);
        onStatusChange?.(false);
      } else if (res.ok) {
        if (tablesMissing) {
          setJustVerifiedSuccess(true);
          setTimeout(() => setJustVerifiedSuccess(false), 5000);
        }
        setTablesMissing(false);
        setMissingList([]);
        onStatusChange?.(true);
      }
    } catch (e) {
      console.warn('[SupabaseBanner] Check error:', e);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    verifyConnection();
    // Auto re-check every 15 seconds
    const interval = setInterval(() => {
      verifyConnection();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleCopySql = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 3500);
      });
    }
  };

  const handleCopyAndOpen = () => {
    handleCopySql();
    if (typeof window !== 'undefined') {
      window.open(sqlEditorUrl, '_blank', 'noopener,noreferrer');
    }
  };

  if (justVerifiedSuccess) {
    return (
      <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-md transition-all">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-200" />
          <span>Supabase 테이블 연동 확인 완료! 모든 기기에서 실시간 동기화가 활성화되었습니다.</span>
        </div>
        <button
          onClick={() => setJustVerifiedSuccess(false)}
          className="text-white/80 hover:text-white p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  if (isChecking || !tablesMissing || isDismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 text-white shadow-lg border-b border-amber-700/40 relative z-30 transition-all">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-3.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main Info */}
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-white/20 rounded-xl shrink-0 mt-0.5 shadow-inner">
              <Database className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <span className="font-black text-sm tracking-tight text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-yellow-200" />
                  실시간 연동을 위한 Supabase 1회 설정 안내
                </span>
                <span className="bg-black/25 text-yellow-200 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  누락 테이블: {missingList.join(', ')}
                </span>
              </div>
              <p className="text-xs text-amber-50 mt-1 leading-relaxed max-w-3xl">
                내가 수정한 일정이 다른 사람 스마트폰/기기에 실시간으로 보이려면, Supabase에{' '}
                <span className="font-bold underline decoration-yellow-300">trips</span> 테이블이 1회 생성되어야 합니다.
                아래 버튼을 눌러 SQL을 복사하고 Supabase SQL Editor에서 실행해 주세요.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
            <button
              onClick={handleCopyAndOpen}
              className="px-3.5 py-2 bg-white text-amber-900 hover:bg-amber-50 active:scale-95 font-bold text-xs rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer"
              title="SQL 복사 후 Supabase SQL Editor 새 탭 열기"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>복사됨! 새 탭으로 이동</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-amber-700" />
                  <span>1클릭 SQL 복사 & SQL Editor 열기</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </>
              )}
            </button>

            <button
              onClick={() => verifyConnection(true)}
              className="px-3 py-2 bg-black/20 hover:bg-black/30 text-white font-bold text-xs rounded-xl transition flex items-center space-x-1 cursor-pointer"
              title="테이블 생성 여부 재확인"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
              <span>연결 확인</span>
            </button>

            <button
              onClick={() => setShowSqlPreview(!showSqlPreview)}
              className="p-2 bg-black/10 hover:bg-black/20 text-white rounded-xl transition text-xs flex items-center gap-1 cursor-pointer"
              title="SQL 스키마 내용 보기"
            >
              {showSqlPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setIsDismissed(true)}
              className="p-1.5 text-white/70 hover:text-white rounded-lg hover:bg-white/10 transition"
              title="배너 닫기"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Expandable SQL Preview */}
        {showSqlPreview && (
          <div className="mt-3 pt-3 border-t border-white/20 animate-in fade-in">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-100 font-mono">
                Supabase SQL Editor 실행 쿼리 (trips, settings, RLS, Storage 버킷 설정 포함)
              </span>
              <button
                onClick={handleCopySql}
                className="text-[11px] bg-white/20 hover:bg-white/30 text-white font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition"
              >
                {isCopied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                <span>{isCopied ? '복사 완료' : '전체 복사'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950/90 text-amber-200 text-[11px] font-mono rounded-xl max-h-52 overflow-y-auto whitespace-pre selection:bg-amber-500 selection:text-white border border-amber-900/50">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
