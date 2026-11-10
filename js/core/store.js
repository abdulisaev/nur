// Настройки и состояние: localStorage + синхронизация через Telegram CloudStorage.
import { cloud } from "./tg.js";

const PREFIX = "nur:";
const SYNCED = ["settings", "bookmarks", "lastRead"];

export const DEFAULTS = {
  v: 2,
  // Оформление
  theme: "auto",
  accent: "auto",
  glass: "normal",
  animatedBg: false,
  fullscreen: true,
  // Текст
  arFont: "amiri-quran",
  arSize: 30,
  arAlign: "right",
  trFont: "system",
  trSize: 16,
  tlSize: 15,
  lineHeight: 1.6,
  showTranslit: true,
  showTranslation: true,
  showSource: true,
  showFadl: true,
  // Счётчик
  hapticTap: true,
  hapticDone: true,
  sound: false,
  tapCard: true,
  autoNext: true,
  dailyReset: true,
  azkarView: "list",
  // Время намаза
  prayerCity: "makhachkala",
  prayerGeo: null,
  prayerMethod: "dumd",
  asrSchool: "standard",
  prayerAdjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
  showTahajjud: false,
  // Коран и аудио
  translation: "ru.kuliev",
  quranMode: "ayah",
  reciter: "Alafasy_128kbps",
  speed: 1,
  repeatAyah: 1,
  autoScroll: true,
  continueNext: true,
};

function readRaw(key) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeRaw(key, rec) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(rec));
  } catch {}
}

// Значения хранятся как { v, t } — t нужен, чтобы при синхронизации брать более свежую версию
export function load(key, fallback) {
  const rec = readRaw(key);
  if (rec && typeof rec === "object" && "v" in rec) return rec.v;
  return fallback;
}

export function save(key, value) {
  const rec = { v: value, t: Date.now() };
  writeRaw(key, rec);
  if (SYNCED.includes(key)) cloud.set(key, JSON.stringify(rec));
}

const savedSettings = load("settings", {});
export const settings = { ...DEFAULTS, ...savedSettings };
// v2: живой фон по умолчанию выключен — на телефонах он заметно нагружает графику
if ((savedSettings.v ?? 1) < 2) {
  settings.v = 2;
  settings.animatedBg = false;
}
const listeners = new Set();

export function set(key, value) {
  if (settings[key] === value) return;
  settings[key] = value;
  save("settings", { ...settings });
  listeners.forEach((fn) => fn(key, value));
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetSettings() {
  Object.assign(settings, DEFAULTS);
  save("settings", { ...settings });
  listeners.forEach((fn) => fn("*", null));
}

// Подтягиваем из облака Telegram то, что новее локального (другое устройство)
export async function syncFromCloud() {
  const remote = await cloud.getMany(SYNCED);
  let changed = false;
  for (const key of SYNCED) {
    if (!remote[key]) continue;
    try {
      const rec = JSON.parse(remote[key]);
      const local = readRaw(key);
      if (rec && rec.t && (!local || !local.t || rec.t > local.t)) {
        writeRaw(key, rec);
        if (key === "settings") Object.assign(settings, DEFAULTS, rec.v);
        changed = true;
      }
    } catch {}
  }
  if (changed) listeners.forEach((fn) => fn("*", null));
  return changed;
}

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ── Прогресс азкаров ──────────────────────────────────────────
export function getProgress(catId) {
  const all = load("progress", {});
  const p = all[catId];
  if (!p) return { date: today(), counts: {} };
  if (settings.dailyReset && p.date !== today()) return { date: today(), counts: {} };
  return p;
}

export function setProgress(catId, progress) {
  const all = load("progress", {});
  all[catId] = { ...progress, date: today() };
  save("progress", all);
}

// ── Закладки и последнее чтение ───────────────────────────────
export const bookmarks = {
  list: () => load("bookmarks", []),
  has: (s, a) => load("bookmarks", []).some((b) => b.s === s && b.a === a),
  toggle(s, a) {
    let list = load("bookmarks", []);
    const exists = list.some((b) => b.s === s && b.a === a);
    list = exists ? list.filter((b) => !(b.s === s && b.a === a)) : [{ s, a, t: Date.now() }, ...list].slice(0, 120);
    save("bookmarks", list);
    return !exists;
  },
};

export const lastRead = {
  get: () => load("lastRead", null),
  set: (s, a) => save("lastRead", { s, a, t: Date.now() }),
};
