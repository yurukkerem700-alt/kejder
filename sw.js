// Börü: Son Kral - servis çalışanı
// Önce ağdan yükler (güncellemeler hemen gelir); internet yoksa ya da ağ çok yavaşsa son kaydedilen sürümü açar.
// HIZLI AÇILIŞ: eskiden her açılışta tüm dosyalar (1.4 MB+) 'no-store' ile sıfırdan indiriliyordu. Artık tarayıcı
// dosyanın değişip değişmediğini sorar (ETag / 304): değişmediyse hiçbir şey indirilmez, oyun anında açılır.
const CACHE = 'boru-v21';
const SLOW_MS = 4000; // ağ bu süreden uzun sürerse kayıtlı sürüm açılır, yenisi arka planda kaydedilir
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'boru-v20').map(k => caches.delete(k))))
    .then(() => caches.open(CACHE)).then(async (c) => {
      // eski önbellekteki dosyaları yeni önbelleğe taşı (çevrimdışı açılış güncelleme sonrası da çalışsın)
      if (!(await caches.has('boru-v20'))) return;
      const old = await caches.open('boru-v20');
      for (const req of await old.keys()) { const r = await old.match(req); if (r && !(await c.match(req))) await c.put(req, r); }
      await caches.delete('boru-v20');
    }).catch(() => {}).then(() => self.clients.claim())
));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const net = fetch(e.request, { cache: 'no-cache' }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
    return res;
  });
  e.waitUntil(net.catch(() => {}));
  const cached = () => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === 'navigate' ? caches.match('./') : undefined));
  e.respondWith(new Promise((resolve, reject) => {
    let done = false;
    const fin = (r) => { if (!done && r) { done = true; resolve(r); } };
    const t = setTimeout(() => cached().then(fin), SLOW_MS);
    net.then(r => { clearTimeout(t); fin(r); }, () => { clearTimeout(t); cached().then(r => r ? fin(r) : (done || (done = true, reject(new Error('offline'))))); });
  }));
});
