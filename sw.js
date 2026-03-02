const CACHE_NAME = 'sheets-pwa-v1.0.0';
// 注意：這裡只預先快取「同網域」資源。
// 避免 CDN / 第三方資源暫時不可用時，導致 SW 安裝失敗而卡住更新流程（進而引發白畫面問題）。
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // cache: 'reload' 讓瀏覽器盡量繞過 HTTP cache，避免拿到舊檔
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
  );
  // 不在這裡自動 skipWaiting：讓頁面能顯示「有新版可用」提示，等使用者點擊後再更新
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(
      names.map((name) => (name !== CACHE_NAME ? caches.delete(name) : Promise.resolve(false)))
    )).then(() => self.clients.claim())
  );
});

// 讓頁面可以主動要求 SW 立即套用更新（搭配「強制更新」按鈕）
self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // 讓頁面查詢目前使用中的 cache 版本名稱
  if (event?.data?.type === 'GET_CACHE_NAME') {
    try {
      const port = event.ports && event.ports[0];
      if (port) {
        port.postMessage({ cacheName: CACHE_NAME });
        return;
      }
      if (event.source && event.source.postMessage) {
        event.source.postMessage({ type: 'CACHE_NAME', cacheName: CACHE_NAME });
      }
    } catch (_) {
      // ignore
    }
  }
});

// 重建 Response 物件以移除 Safari 的重定向標記
function rebuildResponse(response) {
  const status = response.status;
  if (status < 200 || status > 599) {
    console.warn('Invalid response status:', status, 'using 200 instead');
    return new Response(response.body, {
      status: 200,
      statusText: 'OK',
      headers: response.headers,
    });
  }
  return new Response(response.body, {
    status: status,
    statusText: response.statusText || 'OK',
    headers: response.headers,
  });
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const isNavigationRequest = request.mode === 'navigate';
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const acceptHeader = request.headers.get('accept') || '';
  const isHtmlRequest = request.destination === 'document' || acceptHeader.includes('text/html');

  // Apps Script (GAS) URL 及 POST/PUT/DELETE 請求完全略過 SW（避免 CORS preflight 失敗）
  if (
    url.hostname === 'script.google.com' ||
    request.method === 'POST' ||
    request.method === 'PUT' ||
    request.method === 'DELETE'
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 導航請求：Network-first，但不把新版 HTML 寫回快取
      // 避免快取到新版 index.html 卻沒有對應新版資源（離線時白畫面）
      if (isNavigationRequest) {
        const cachedIndex =
          (await cache.match('./index.html')) ||
          (await cache.match('index.html')) ||
          (await caches.match('./index.html')) ||
          (await caches.match('index.html'));
        try {
          const networkResponse = await fetch(request, { cache: 'no-store' });
          if (networkResponse && networkResponse.ok) {
            return rebuildResponse(networkResponse);
          }
          if (cachedIndex) return rebuildResponse(cachedIndex);
          const fallback = await caches.match(request);
          if (fallback) return rebuildResponse(fallback);
          return rebuildResponse(networkResponse);
        } catch (error) {
          console.warn('Network request failed:', error);
          if (cachedIndex) return rebuildResponse(cachedIndex);
          const fallback = await caches.match(request);
          if (fallback) return rebuildResponse(fallback);
          return new Response('無法連線到網路，且沒有快取資料。', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }
      }

      // 其他資源：Same-origin 用 stale-while-revalidate
      if (isSameOrigin) {
        // HTML fetch（非導航）：優先拿最新內容
        if (isHtmlRequest) {
          const cachedResponse = await caches.match(request);
          try {
            const networkResponse = await fetch(request, { cache: 'no-store' });
            if (networkResponse && networkResponse.ok) {
              try { await cache.put(request, networkResponse.clone()); } catch (_) { /* ignore */ }
              return rebuildResponse(networkResponse);
            }
            if (cachedResponse) return rebuildResponse(cachedResponse);
            return rebuildResponse(networkResponse);
          } catch (error) {
            if (cachedResponse) return rebuildResponse(cachedResponse);
            throw error;
          }
        }

        // JS/CSS：network-first，避免部署後仍用舊版
        if (request.destination === 'script' || request.destination === 'style') {
          const cachedResponse = await caches.match(request);
          try {
            const networkResponse = await fetch(request, { cache: 'no-store' });
            if (networkResponse && networkResponse.ok) {
              try { await cache.put(request, networkResponse.clone()); } catch (_) { /* ignore */ }
              return networkResponse;
            }
            if (cachedResponse) return cachedResponse;
            return networkResponse;
          } catch (error) {
            if (cachedResponse) return cachedResponse;
            throw error;
          }
        }

        // 其他同源資源：stale-while-revalidate（先回快取，背景更新）
        const cachedResponse = await caches.match(request);
        const networkPromise = fetch(request)
          .then(async (networkResponse) => {
            if (networkResponse && networkResponse.ok) {
              try { await cache.put(request, networkResponse.clone()); } catch (_) { /* ignore */ }
            }
            return networkResponse;
          })
          .catch(() => null);

        if (cachedResponse) return cachedResponse;

        const networkResponse = await networkPromise;
        if (networkResponse) return networkResponse;

        throw new Error('No cached response and network failed');
      }

      // Cross-origin：cache-first
      const cachedResponse = await caches.match(request);
      if (cachedResponse) return cachedResponse;
      return fetch(request);
    })().catch((error) => {
      console.error('Service Worker fetch error:', error);
      if (isNavigationRequest) {
        return new Response('服務發生錯誤。', {
          status: 500,
          statusText: 'Internal Server Error',
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      throw error;
    })
  );
});

// 推播通知
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : { title: '排程提醒', body: '列數不足，請確認 Google Sheet 空間' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png'
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
