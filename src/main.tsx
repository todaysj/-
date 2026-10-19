import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for offline viewing
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration error:', err);
    });
  });
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.log('SW registration error:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
// Netlify 뱃지 강제 제거 스크립트
if (typeof window !== 'undefined') {
  const removeNetlifyBadge = () => {
    const badge = document.querySelector('net-lify-drawer') || 
                  document.querySelector('[data-netlify-deploy-id]') ||
                  document.getElementById('netlify-modal-root');
    if (badge) {
      badge.remove();
    }
  };
  setInterval(removeNetlifyBadge, 300);
}

