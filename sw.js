// Service Worker: интерфейс и азкары доступны офлайн сразу, суры Корана — по мере чтения
// или после «Скачать Коран» в настройках. Аудио не кэшируется (большой объём, Range-запросы).
const VERSION = "nur-v1.3.1";
const SHELL = `${VERSION}-shell`;
const DATA = "nur-quran-v1";
const FONTS = "nur-fonts-v1";

const SHELL_FILES = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/app.css",
  "js/app.js",
  "js/core/audio.js",
  "js/core/data.js",
  "js/core/fonts.js",
  "js/core/icons.js",
  "js/core/nav.js",
  "js/core/prayer.js",
  "js/core/pwa.js",
  "js/core/sound.js",
  "js/core/store.js",
  "js/core/tg.js",
  "js/core/theme.js",
  "js/core/ui.js",
  "js/data/azkar.js",
  "js/data/quran-meta.js",
  "js/data/reciters.js",
  "js/data/surahs.js",
  "js/views/azkar.js",
  "js/views/home.js",
  "js/views/mushaf.js",
  "js/views/player-ui.js",
  "js/views/prayer-ui.js",
  "js/views/quran.js",
  "js/views/settings.js",
  "js/views/tasbih.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.endsWith("-shell") && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === "opaque") cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req, { ignoreSearch: true });
  const network = fetch(req)
    .then((res) => {
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || network;
}

// Интерфейс: сначала сеть (обновления видны сразу), без сети или при долгом ответе — кэш
async function networkFirst(req, key = req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000)),
    ]);
    if (res.ok) cache.put(key, res.clone());
    return res;
  } catch {
    const hit = await cache.match(key, { ignoreSearch: true });
    if (hit) return hit;
    return (key === "index.html" && (await cache.match("./"))) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") return event.respondWith(networkFirst(req, "index.html"));
    if (url.pathname.includes("/data/quran/")) return event.respondWith(cacheFirst(req, DATA));
    return event.respondWith(networkFirst(req));
  }
  if (url.hostname === "fonts.googleapis.com") return event.respondWith(staleWhileRevalidate(req, FONTS));
  if (url.hostname === "fonts.gstatic.com") return event.respondWith(cacheFirst(req, FONTS));
  if (url.hostname === "telegram.org" && url.pathname.startsWith("/js/")) return event.respondWith(staleWhileRevalidate(req, SHELL));
  // Остальное (аудио everyayah.com и т.п.) — напрямую в сеть
});
