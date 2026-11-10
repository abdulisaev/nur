// Плеер Корана: аудио по аятам, подсветка текущего аята, повтор, скорость, переход к следующей суре.
import { settings, onChange } from "./store.js";
import { surah } from "../data/surahs.js";
import { reciter, ayahUrl } from "../data/reciters.js";
import { toast } from "./ui.js";

const listeners = new Set();
const audio = new Audio();
const preload = new Audio();
audio.preload = "auto";
preload.preload = "auto";

export const player = {
  active: false,
  playing: false,
  loading: false,
  s: 0,
  a: 0,
  basmala: false,
  progress: 0,
};

let repeatLeft = 1;

const emit = () => listeners.forEach((fn) => fn(player));
export const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// Басмалу перед 1-м аятом читаем для всех сур, кроме 1-й (там она — 1-й аят) и 9-й
const needsBasmala = (s, a) => a === 1 && s !== 1 && s !== 9;

function itemUrl(it) {
  return it.basmala ? ayahUrl(settings.reciter, 1, 1) : ayahUrl(settings.reciter, it.s, it.a);
}

function nextItem(it) {
  if (it.basmala) return { s: it.s, a: 1, basmala: false };
  if (it.a < surah(it.s).ayahs) return { s: it.s, a: it.a + 1, basmala: false };
  if (settings.continueNext && it.s < 114) return { s: it.s + 1, a: 1, basmala: needsBasmala(it.s + 1, 1) };
  return null;
}

function preloadNext() {
  const nxt = nextItem(player);
  if (nxt) preload.src = itemUrl(nxt);
}

function load(it, autoplay = true) {
  Object.assign(player, { s: it.s, a: it.a, basmala: !!it.basmala, active: true, loading: true, progress: 0 });
  repeatLeft = settings.repeatAyah;
  audio.src = itemUrl(it);
  audio.playbackRate = settings.speed;
  if (autoplay) {
    audio.play().catch(() => {});
  }
  updateMediaSession();
  emit();
  preloadNext();
}

export function playFrom(s, a = 1) {
  load({ s, a, basmala: needsBasmala(s, a) });
}

export function toggle() {
  if (!player.active) return;
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
}

export function next() {
  const nxt = nextItem({ ...player, basmala: false });
  if (nxt) load(nxt);
}

export function prev() {
  if (audio.currentTime > 2.5 && !player.basmala) {
    audio.currentTime = 0;
    return;
  }
  if (player.a > 1) load({ s: player.s, a: player.a - 1, basmala: false });
  else if (player.s > 1) load({ s: player.s - 1, a: surah(player.s - 1).ayahs, basmala: false });
  else audio.currentTime = 0;
}

export function stop() {
  audio.pause();
  audio.removeAttribute("src");
  audio.load();
  Object.assign(player, { active: false, playing: false, loading: false, progress: 0 });
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
  emit();
}

audio.addEventListener("playing", () => { player.playing = true; player.loading = false; emit(); });
// Перед «ended» браузер шлёт «pause» — это не пауза пользователя, переход к следующему аяту
audio.addEventListener("pause", () => { if (audio.ended) return; player.playing = false; emit(); });
audio.addEventListener("waiting", () => { player.loading = true; emit(); });
audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  player.progress = audio.currentTime / audio.duration;
  listeners.forEach((fn) => fn(player, "time"));
});
audio.addEventListener("ended", () => {
  if (!player.basmala && (settings.repeatAyah === 0 || repeatLeft > 1)) {
    if (settings.repeatAyah !== 0) repeatLeft--;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    return;
  }
  const nxt = nextItem(player);
  if (nxt) load(nxt);
  else {
    player.playing = false;
    emit();
    toast("Чтение суры завершено", "check");
  }
});
audio.addEventListener("error", () => {
  if (!audio.getAttribute("src")) return;
  player.loading = false;
  player.playing = false;
  emit();
  toast(navigator.onLine ? "Не удалось загрузить аудио" : "Нет интернета — аудио недоступно", "info");
});

onChange((key) => {
  if (key === "speed" || key === "*") audio.playbackRate = settings.speed;
  if (key === "reciter" && player.active) {
    const wasPlaying = !audio.paused;
    load({ s: player.s, a: player.a, basmala: player.basmala }, wasPlaying);
  }
  if (key === "continueNext") preloadNext();
});

function updateMediaSession() {
  if (!("mediaSession" in navigator)) return;
  const sr = surah(player.s);
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: player.basmala ? `${sr.name} — басмала` : `${sr.name} — аят ${player.a}`,
      artist: reciter(settings.reciter).name,
      album: "Коран",
      artwork: [{ src: "icons/icon-512.png", sizes: "512x512", type: "image/png" }],
    });
    navigator.mediaSession.setActionHandler("play", () => audio.play());
    navigator.mediaSession.setActionHandler("pause", () => audio.pause());
    navigator.mediaSession.setActionHandler("previoustrack", prev);
    navigator.mediaSession.setActionHandler("nexttrack", next);
  } catch {}
}
