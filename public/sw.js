/* 轻账 Service Worker
   策略：网络优先 + 缓存兜底。
   - 有网时永远拿最新版本（不会出现"改了代码手机上还是旧的"）
   - 断网时用上一次的缓存，至少能打开、能查账
   - 跨域请求（Supabase 的 API / WebSocket）完全不碰，避免缓存脏数据
*/
const CACHE = 'qz-cache-v3';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './apple-touch-icon.png'];

async function warm(cache, url) {
  try {
    const res = await fetch(url, { cache: 'reload' });
    if (res && res.ok) await cache.put(url, res);
  } catch {
    /* 单个资源失败不影响整体 */
  }
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const u of CORE) await warm(cache, new URL(u, self.registration.scope).href);

    /* 首次安装时，把 index.html 里引用的 js / css 一起缓存下来。
       文件名带 hash 没法硬编码，所以现场解析。不预缓存的话，离线
       重载会拿到 HTML 却加载不到 JS —— 白屏。 */
    try {
      const res = await fetch(new URL('./index.html', self.registration.scope).href, { cache: 'reload' });
      const html = await res.text();
      const assets = [...html.matchAll(/(?:src|href)="([^"]*\.(?:js|css))"/g)]
        .map(m => new URL(m[1], self.registration.scope).href);
      for (const a of assets) await warm(cache, a);
    } catch {
      /* ignore */
    }

    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        /* ignoreVary 很关键：服务器给资源带 Vary 头时，默认匹配会因为请求头
           差异而落空，退化成"JS 请求拿到 index.html"→ MIME 错误 → 白屏 */
        const hit = await caches.match(req, { ignoreVary: true, ignoreSearch: true });
        if (hit) return hit;

        /* 只有页面导航才回退到 HTML 外壳，静态资源拿不到就是拿不到 */
        if (req.mode === 'navigate') {
          const shell = await caches.match(new URL('./index.html', self.registration.scope).href, { ignoreVary: true });
          if (shell) return shell;
        }

        return new Response('离线中，且这个资源还没被缓存过', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      })
  );
});
