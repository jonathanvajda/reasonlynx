const ROOT_SERVICE_WORKER_URL = new URL('../sw.js', import.meta.url);
const ROOT_SERVICE_WORKER_SCOPE = new URL('../', import.meta.url);

export async function registerRootServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const swResponse = await fetch(ROOT_SERVICE_WORKER_URL, {
      method: 'HEAD',
      cache: 'no-store'
    });

    if (!swResponse.ok) {
      console.info(`[PWA] Root service worker not available at ${ROOT_SERVICE_WORKER_URL.pathname}; skipping registration.`);
      return null;
    }

    const reg = await navigator.serviceWorker.register(ROOT_SERVICE_WORKER_URL, {
      scope: ROOT_SERVICE_WORKER_SCOPE.pathname,
      updateViaCache: 'none'
    });

    await reg.update();

    if (reg.waiting) reg.waiting.postMessage('SKIP_WAITING');

    reg.addEventListener('updatefound', () => {
      const nextWorker = reg.installing;
      if (!nextWorker) return;
      nextWorker.addEventListener('statechange', () => {
        if (nextWorker.state === 'installed' && reg.waiting) {
          reg.waiting.postMessage('SKIP_WAITING');
        }
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    return reg;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

window.addEventListener('load', () => {
  registerRootServiceWorker();
});
