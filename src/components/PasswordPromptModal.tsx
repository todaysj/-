import React, { useState, useEffect, useRef } from 'react';
import { Lock, X, Eye, EyeOff, KeyRound, AlertCircle } from 'lucide-react';

interface PasswordPromptModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  correctPassword: string;
  onSuccess: () => void;
  onClose: () => void;
}

export const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({
  isOpen,
  title = '비밀번호 확인',
  description = '보안 작업을 수행하려면 비밀번호를 입력해주세요.',
  correctPassword,
  onSuccess,
  onClose
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMsg('');
      setIsShaking(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const inputVal = password.trim();

    if (!inputVal) {
      setErrorMsg('비밀번호를 입력해주세요.');
      inputRef.current?.focus();
      return;
    }

    if (inputVal === correctPassword) {
      setErrorMsg('');
      onSuccess();
      onClose();
    } else {
      setErrorMsg('비밀번호가 일치하지 않습니다.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      inputRef.current?.select();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-fade-in">
      <div
        className={`bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden transition-transform ${
          isShaking ? 'animate-bounce' : ''
        }`}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-4.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-400/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base">{title}</h3>
              <p className="text-[11px] text-slate-400">보안 인증이 필요합니다</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            {description}
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              관리자 비밀번호
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="비밀번호 입력"
                className={`w-full pl-9 pr-10 py-2.5 bg-slate-50 border rounded-xl text-sm font-bold tracking-wider outline-none transition ${
                  errorMsg
                    ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:ring-2 focus:ring-rose-400'
                    : 'border-slate-300 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:bg-white text-slate-900'
                }`}
                autoComplete="current-password"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {errorMsg && (
              <div className="flex items-center space-x-1 text-xs font-bold text-rose-600 pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition shadow-sm"
            >
              확인
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
