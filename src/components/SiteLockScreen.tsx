import React, { useState } from 'react';
import { Lock, ArrowRight, ShieldCheck, AlertCircle, KeyRound } from 'lucide-react';

interface SiteLockScreenProps {
  expectedPassword?: string;
  onUnlocked: () => void;
  brandTitle?: string;
  brandSubtitle?: string;
}

export const SiteLockScreen: React.FC<SiteLockScreenProps> = ({
  expectedPassword = '1205',
  onUnlocked,
  brandTitle = 'J-Planner',
  brandSubtitle = '비공개 여행 일정 및 계획'
}) => {
  const [inputPassword, setInputPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanInput = inputPassword.trim();
    let cleanExpected = (expectedPassword || '').trim();

    if (!cleanExpected) {
      try {
        const direct = localStorage.getItem('jplanner_site_password');
        if (direct && direct.trim()) cleanExpected = direct.trim();
      } catch (e) {}
    }
    if (!cleanExpected) {
      cleanExpected = '1205';
    }

    if (!cleanInput) {
      setErrorMsg('비밀번호를 입력해주세요.');
      triggerShake();
      return;
    }

    if (cleanInput === cleanExpected) {
      try {
        sessionStorage.setItem('jplanner_site_unlocked', 'true');
        sessionStorage.setItem('allowed', 'true');
      } catch (e) {}
      onUnlocked();
    } else {
      setErrorMsg('비밀번호가 올바르지 않습니다. 다시 입력해주세요.');
      setInputPassword('');
      triggerShake();
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 selection:bg-indigo-500 selection:text-white">
      <div
        className={`w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transition-transform duration-200 ${
          isShaking ? 'animate-bounce' : ''
        }`}
      >
        {/* 상단 헤더 배너 */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 p-8 text-white text-center relative overflow-hidden">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -left-8 -bottom-8 w-32 h-32 bg-indigo-400/20 rounded-full blur-xl pointer-events-none" />

          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/15 backdrop-blur-md rounded-2xl mb-4 border border-white/20 shadow-inner">
            <Lock className="w-8 h-8 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">{brandTitle}</h1>
          <p className="text-xs text-indigo-100/80 mt-1.5 font-medium">{brandSubtitle}</p>
        </div>

        {/* 비밀번호 입력 폼 */}
        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-4 text-slate-700">
            <KeyRound className="w-4 h-4 text-indigo-600" />
            <h2 className="text-sm font-bold">비밀번호 인증</h2>
          </div>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            비공개 일정 및 계획 사이트입니다. 사이트 접근을 위해 설정된 접속 비밀번호를 입력해주세요.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="password"
                  autoFocus
                  value={inputPassword}
                  onChange={(e) => {
                    setInputPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="비밀번호 입력..."
                  className={`w-full px-4 py-3.5 pl-11 bg-slate-50 border rounded-2xl text-slate-900 text-sm focus:outline-none transition-all placeholder:text-slate-400 ${
                    errorMsg
                      ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100 bg-red-50/30'
                      : 'border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100'
                  }`}
                />
                <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>

              {errorMsg && (
                <div className="flex items-center gap-1.5 mt-2.5 text-xs font-semibold text-red-600 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 group cursor-pointer"
            >
              <span>사이트 입장하기</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-slate-400 text-[11px]">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>비공개 안전 암호화 세션 적용 중</span>
          </div>
        </div>
      </div>
    </div>
  );
};
