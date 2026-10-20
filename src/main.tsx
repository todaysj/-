import { Component, ErrorInfo, ReactNode, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RootErrorBoundary] Caught unhandled rendering error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetStorage = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400 text-2xl font-bold">
              !
            </div>
            <div>
              <h1 className="text-xl font-bold text-white mb-2">화면 로딩 중 오류가 발생했습니다</h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-3">
                일시적인 캐시 또는 렌더링 오류일 수 있습니다. 아래 버튼을 눌러 새로고침해 주세요.
              </p>
              {this.state.error?.message && (
                <div className="p-3 bg-slate-950/70 rounded-xl text-left font-mono text-xs text-rose-300 break-all border border-slate-800">
                  {this.state.error.message}
                </div>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 py-3 px-4 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm rounded-xl transition cursor-pointer shadow-lg shadow-sky-600/20"
              >
                페이지 새로고침
              </button>
              <button
                onClick={this.handleResetStorage}
                className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                캐시 초기화
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Safely register Service Worker without throwing ReferenceError for process
try {
  if (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.PROD
  ) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.log('SW registration error:', err);
      });
    });
  }
} catch (swErr) {
  console.warn('[SW] Registration notice:', swErr);
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </StrictMode>
  );
}
