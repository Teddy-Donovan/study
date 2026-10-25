/* sw.js: offline support for the Study app.
 * - App shell: cached on install (versioned; mkdata.py stamps VERSION on every sync).
 * - Packs, PDFs, question bank, fonts, MathJax: stale-while-revalidate, cached on first visit.
 * - The page can pre-cache everything (Settings > Offline) into the same caches.
 */
const VERSION = '20261024-171542';
const SHELL = 'study-shell-' + VERSION;
const C_PACKS = 'study-packs-v1', C_PDF = 'study-pdf-v1', C_RT = 'study-rt-v1';
const SHELL_FILES = ['./', 'index.html', 'app.css', 'app.js', 'sr-store.js', 'data.json', 'cards.json', 'search-index.json',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES.map((u) => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('study-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

function bucket(url) {
  if (url.origin !== self.location.origin) {
    if (/fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host)) return C_RT;
    return null;
  }
  const p = url.pathname;
  const base = self.registration.scope.replace(location.origin, '');
  const rel = p.startsWith(base) ? p.slice(base.length) : p;
  if (rel.startsWith('packs/')) return C_PACKS;
  if (rel.startsWith('pdf/')) return C_PDF;
  if (rel.startsWith('qb/')) return C_RT;
  return SHELL;
}

async function rangeFrom(resp, range) {
  const buf = await resp.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range || '');
  const size = buf.byteLength;
  let start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : size - 1;
  if (m && !m[1] && m[2]) { start = size - +m[2]; end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), {
    status: 206, statusText: 'Partial Content',
    headers: { 'Content-Type': resp.headers.get('Content-Type') || 'application/pdf', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes' }
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const b = bucket(url);
  if (!b) return;
  const ignoreSearch = b !== C_RT || url.origin === self.location.origin; // ?pm=q shares the cached pack
  const key = ignoreSearch ? url.origin + url.pathname : req.url;
  e.respondWith((async () => {
    const cache = await caches.open(b);
    let hit = await cache.match(key, { ignoreSearch: true });
    if (!hit && b === SHELL && (url.pathname.endsWith('/') || req.mode === 'navigate')) hit = await cache.match('index.html', { ignoreSearch: true });
    const net = fetch(req.headers.get('range') ? new Request(req.url, { credentials: 'same-origin' }) : req).then(async (r) => {
      if (r && (r.ok || r.type === 'opaque') && r.status !== 206) { try { await cache.put(key, r.clone()); } catch (x) {} }
      return r;
    }).catch(() => null);
    if (hit) {
      e.waitUntil(net);
      if (req.headers.get('range')) return rangeFrom(hit.clone(), req.headers.get('range'));
      return hit;
    }
    const r = await net;
    if (r) {
      if (req.headers.get('range') && r.status === 200) return rangeFrom(r.clone(), req.headers.get('range'));
      return r;
    }
    return new Response('Offline, and this file is not saved on this device yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
  })());
});
