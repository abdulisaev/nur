// Загрузка текста Корана с кэшированием для офлайн-чтения.
// Работает и без Service Worker (например, в Telegram на iOS) — через CacheStorage напрямую.
import { settings } from "./store.js";

export const DATA_CACHE = "nur-quran-v1";
export const TRANSLATIONS = [
  { id: "ru.kuliev", name: "Эльмир Кулиев", note: "Самый распространённый смысловой перевод" },
  { id: "ru.abuadel", name: "Абу Адель", note: "С пояснениями в скобках" },
  { id: "ru.osmanov", name: "Магомед-Нури Османов", note: "Литературный перевод" },
  { id: "none", name: "Без перевода", note: "Только арабский текст" },
];

const mem = new Map();
const pad3 = (n) => String(n).padStart(3, "0");
export const surahUrl = (edition, n) => `data/quran/${edition}/${pad3(n)}.json`;

export function getJSON(url) {
  if (mem.has(url)) return mem.get(url);
  const p = (async () => {
    const hasCaches = "caches" in window;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (hasCaches && !navigator.serviceWorker?.controller) {
        caches.open(DATA_CACHE).then((c) => c.put(url, res.clone())).catch(() => {});
      }
      return await res.clone().json();
    } catch (err) {
      if (hasCaches) {
        const hit = await caches.match(url).catch(() => null);
        if (hit) return hit.json();
      }
      throw err;
    }
  })();
  mem.set(url, p);
  p.catch(() => mem.delete(url));
  return p;
}

export async function loadSurah(n, translation = settings.translation) {
  const [ar, tr] = await Promise.all([
    getJSON(surahUrl("ar", n)),
    translation && translation !== "none" ? getJSON(surahUrl(translation, n)).catch(() => null) : null,
  ]);
  return { ar, tr };
}

// ── Офлайн ────────────────────────────────────────────────────
export async function offlineStatus(editions) {
  if (!("caches" in window)) return null;
  const cache = await caches.open(DATA_CACHE);
  const keys = await cache.keys();
  const have = new Set(keys.map((r) => new URL(r.url).pathname.replace(/^.*?data\/quran\//, "data/quran/")));
  const result = {};
  for (const ed of editions) {
    let count = 0;
    for (let n = 1; n <= 114; n++) if (have.has(surahUrl(ed, n))) count++;
    result[ed] = count;
  }
  return result;
}

export async function downloadQuran(editions, onProgress, signal) {
  if (!("caches" in window)) throw new Error("Кэш недоступен в этом браузере");
  const cache = await caches.open(DATA_CACHE);
  const urls = [];
  for (const ed of editions) for (let n = 1; n <= 114; n++) urls.push(surahUrl(ed, n));
  let done = 0;
  let failed = 0;
  const queue = [...urls];
  async function worker() {
    while (queue.length) {
      if (signal?.aborted) return;
      const url = queue.shift();
      try {
        if (!(await cache.match(url))) {
          const res = await fetch(url, { cache: "no-cache" });
          if (!res.ok) throw new Error(res.status);
          await cache.put(url, res);
        }
      } catch {
        failed++;
      }
      done++;
      onProgress?.(done, urls.length);
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  return { total: urls.length, failed };
}

export async function clearQuranCache() {
  mem.clear();
  if ("caches" in window) await caches.delete(DATA_CACHE);
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.();
    return e ? e.usage : null;
  } catch {
    return null;
  }
}
