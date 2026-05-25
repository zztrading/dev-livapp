import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { BUILD_FINGERPRINT } from './lib/runtimeSignature';

// 🔄 PWA DESABILITADO: Removido para evitar problemas de cache com Service Worker

// ============================================================
// Fase 1: Invalidação determinística por BUILD_FINGERPRINT
// Cada build gera um fingerprint único (via Vite define).
// Se o fingerprint mudar em relação ao anterior salvo em localStorage,
// limpamos SWs + Cache API e forçamos reload único (anti-loop via sessionStorage).
// ============================================================
const PREVIOUS_FP_KEY = 'ailiv_build_fp';
const RELOAD_GUARD_KEY = `ailiv_reload_${BUILD_FINGERPRINT}`;

// 🚫 Cache-purge automático desabilitado em preview/dev (Lovable rebuilda com frequência,
// causando reload+flicker a cada navegação). Mantemos apenas em produção publicada.
const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
const isProductionHost =
  hostname.endsWith('.lovable.app') && !hostname.includes('preview--') && !hostname.startsWith('id-preview');
const CACHE_PURGE_ENABLED = isProductionHost;

const previousFP = localStorage.getItem(PREVIOUS_FP_KEY);
const isNewBuild = CACHE_PURGE_ENABLED && previousFP !== null && previousFP !== BUILD_FINGERPRINT;

// Sempre persiste o fingerprint atual
localStorage.setItem(PREVIOUS_FP_KEY, BUILD_FINGERPRINT);

if (isNewBuild) {
  console.warn(`[AIliv:CachePurge] Build mudou: ${previousFP} → ${BUILD_FINGERPRINT}. Limpando caches...`);

  // Limpar SWs APENAS quando o build mudou (antes rodava em todo boot e destruía o cache do navegador)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
        console.log('[AIliv:SW] Removido:', registration.scope);
      });
      if (registrations.length > 0 && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        console.warn('[AIliv:CachePurge] Reload forçado por novo build.');
        window.location.reload();
      }
    });
  }

  // Limpar Cache API APENAS quando o build mudou
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => {
        caches.delete(name);
        console.log('[AIliv:Cache] Removido:', name);
      });
      if (names.length > 0 && !sessionStorage.getItem(RELOAD_GUARD_KEY)) {
        sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
        console.warn('[AIliv:CachePurge] Reload forçado por novo build (cache).');
        window.location.reload();
      }
    });
  }
}

console.log(`[AIliv] Boot | build=${BUILD_FINGERPRINT} | prev=${previousFP ?? 'first-run'} | new=${isNewBuild}`);

// Auto-recovery: se um chunk antigo falhar (após deploy), recarrega 1x
const CHUNK_RELOAD_KEY = `ailiv_chunk_reload_${BUILD_FINGERPRINT}`;
const isChunkLoadError = (msg: string) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|ChunkLoadError|Loading chunk \d+ failed/i.test(msg);

window.addEventListener('error', (e) => {
  if (e?.message && isChunkLoadError(e.message) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    console.warn('[AIliv:ChunkError] Recarregando para buscar assets atualizados.');
    window.location.reload();
  }
});
window.addEventListener('unhandledrejection', (e) => {
  const msg = String(e?.reason?.message ?? e?.reason ?? '');
  if (isChunkLoadError(msg) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
    console.warn('[AIliv:ChunkError] Recarregando (promise) para buscar assets atualizados.');
    window.location.reload();
  }
});

// Runtime signature no boot
import('./lib/runtimeSignature').then(({ logRuntimeSignature }) => {
  logRuntimeSignature({ route: window.location.pathname });
});

// 🧪 Disponibilizar testes no console (desenvolvimento)
if (import.meta.env.DEV) {
  import('./lib/exerciseValidator.manual').catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
