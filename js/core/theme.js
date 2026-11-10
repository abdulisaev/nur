// Темы, акцент, стекло, шрифты и размеры текста — всё через CSS-переменные.
import { settings } from "./store.js";
import { tg, inTG, setChromeColor } from "./tg.js";
import { AR_FONTS, TR_FONTS, loadFont } from "./fonts.js";

export const THEMES = [
  { id: "auto", name: "Системная", colors: ["#eef0f6", "#0b0c10", "#12a27e"] },
  { id: "light", name: "Светлая", colors: ["#f4f5fa", "#9ec5ff", "#f9c6e0"] },
  { id: "dark", name: "Тёмная", colors: ["#0b0c10", "#24346e", "#4c2a7d"] },
  { id: "emerald", name: "Изумруд", colors: ["#05140f", "#0f5c45", "#c9a227"] },
  { id: "sand", name: "Пустыня", colors: ["#f5ede0", "#f0cf96", "#e2a77a"] },
  { id: "midnight", name: "Полночь", colors: ["#070b1f", "#1d2b64", "#3b2a7a"] },
  { id: "rose", name: "Роза", colors: ["#fbf0f3", "#f7c6d9", "#dccdfa"] },
  { id: "amoled", name: "Чёрная", colors: ["#000000", "#111111", "#1c1c1e"] },
  { id: "telegram", name: "Telegram", colors: ["#ffffff", "#2aabee", "#229ed9"] },
];

export const ACCENTS = [
  ["auto", "Авто"],
  ["#0a84ff", "Синий"],
  ["#12a27e", "Изумрудный"],
  ["#c9a227", "Золотой"],
  ["#30b0c7", "Бирюзовый"],
  ["#5e5ce6", "Индиго"],
  ["#bf5af2", "Фиолетовый"],
  ["#ff375f", "Розовый"],
  ["#ff9f0a", "Оранжевый"],
];

const TG_VARS = ["--bg", "--text", "--text-2", "--text-3", "--accent", "--blob1", "--blob2", "--blob3", "--blob4"];
const darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

function resolveTheme() {
  const t = settings.theme;
  if (t === "auto") {
    if (inTG) return tg.colorScheme === "dark" ? "dark" : "light";
    return darkMQ.matches ? "dark" : "light";
  }
  if (t === "telegram") return inTG && tg.colorScheme === "dark" ? "dark" : "light";
  return t;
}

function hexToRgba(hex, a) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  if (!m) return null;
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${a})`;
}

export function applyTheme() {
  const root = document.documentElement;
  TG_VARS.forEach((v) => root.style.removeProperty(v));
  root.dataset.theme = resolveTheme();
  root.dataset.glass = settings.glass;
  root.dataset.motion = settings.animatedBg ? "on" : "off";

  if (settings.theme === "telegram" && inTG && tg.themeParams) {
    const p = tg.themeParams;
    const bg = p.secondary_bg_color || p.bg_color;
    if (bg) root.style.setProperty("--bg", bg);
    if (p.text_color) root.style.setProperty("--text", p.text_color);
    if (p.hint_color) {
      root.style.setProperty("--text-2", p.hint_color);
      root.style.setProperty("--text-3", hexToRgba(p.hint_color, 0.6) || p.hint_color);
    }
    const acc = p.button_color || p.accent_text_color;
    if (acc) {
      root.style.setProperty("--accent", acc);
      root.style.setProperty("--blob1", hexToRgba(acc, 0.55));
      root.style.setProperty("--blob2", hexToRgba(p.accent_text_color || acc, 0.35));
      root.style.setProperty("--blob3", hexToRgba(p.link_color || acc, 0.3));
      root.style.setProperty("--blob4", hexToRgba(acc, 0.2));
    }
  }
  if (settings.accent !== "auto") root.style.setProperty("--accent", settings.accent);

  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  setChromeColor(bg);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", bg);
}

export function applyText() {
  const root = document.documentElement;
  const ar = AR_FONTS.find((f) => f.id === settings.arFont) || AR_FONTS[0];
  const tr = TR_FONTS.find((f) => f.id === settings.trFont) || TR_FONTS[0];
  loadFont(ar);
  loadFont(tr);
  root.style.setProperty("--ar-font", `${ar.family}, "Amiri Quran", "Scheherazade New", serif`);
  root.style.setProperty("--ar-lh", String(ar.lh * (settings.lineHeight / 1.6)));
  root.style.setProperty("--tr-font", tr.family);
  root.style.setProperty("--ar-size", `${settings.arSize}px`);
  root.style.setProperty("--tr-size", `${settings.trSize}px`);
  root.style.setProperty("--tl-size", `${settings.tlSize}px`);
  root.style.setProperty("--lh", String(settings.lineHeight));
  root.dataset.arAlign = settings.arAlign;
  root.classList.toggle("hide-translit", !settings.showTranslit);
  root.classList.toggle("hide-translation", !settings.showTranslation);
  root.classList.toggle("hide-source", !settings.showSource);
  root.classList.toggle("hide-fadl", !settings.showFadl);
  root.classList.toggle("tap-card", settings.tapCard);
}

export function watchSystemTheme() {
  darkMQ.addEventListener?.("change", () => settings.theme === "auto" && applyTheme());
  if (inTG) tg.onEvent("themeChanged", () => (settings.theme === "auto" || settings.theme === "telegram") && applyTheme());
}
