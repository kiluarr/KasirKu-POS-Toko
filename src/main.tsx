/// <reference types="vite/client" />
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register Service Worker for PWA Offline Capability ONLY in production to prevent caching issues during development
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('KasirPro Service Worker registered successfully:', reg.scope);
        })
        .catch((err) => {
          console.error('KasirPro Service Worker registration failed:', err);
        });
    });
  } else {
    // In development mode, automatically unregister active service workers and clear cache
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister().then(() => {
          console.log('Unregistered active service worker to force fresh developer rebuild');
        });
      }
    });

    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key).then(() => {
            console.log('Cleared active SW cache:', key);
          });
        }
      });
    }
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

