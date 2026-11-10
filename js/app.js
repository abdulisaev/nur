// Точка входа: Telegram, тема, навигация, плеер, Service Worker.
import { initTelegram, startParam, inTG, fullscreen } from "./core/tg.js";
import { settings, onChange, syncFromCloud } from "./core/store.js";
import { browserFullscreen } from "./core/pwa.js";
import { applyTheme, applyText, watchSystemTheme } from "./core/theme.js";
import { initNav, switchTab, open, back } from "./core/nav.js";
import { $ } from "./core/ui.js";
import { mountMiniPlayer } from "./views/player-ui.js";
import { findCategory } from "./data/azkar.js";
import "./views/home.js";
import "./views/azkar.js";
import "./views/quran.js";
import "./views/tasbih.js";
import "./views/settings.js";

const THEME_KEYS = ["theme", "accent", "glass", "animatedBg"];
const TEXT_KEYS = ["arFont", "arSize", "arAlign", "trFont", "trSize", "tlSize", "lineHeight", "showTranslit", "showTranslation", "showSource", "showFadl", "tapCard"];

initTelegram();
if (settings.fullscreen) {
  if (inTG) fullscreen.mobile() && fullscreen.enter();
  else browserFullscreen.enterOnFirstTap();
}
applyTheme();
applyText();
watchSystemTheme();
onChange((key) => {
  if (key === "*" || THEME_KEYS.includes(key)) applyTheme();
  if (key === "*" || TEXT_KEYS.includes(key)) applyText();
});

initNav($("#pages"), $("#tabbar"));
mountMiniPlayer($("#player-slot"));
switchTab("home");

// Диплинки: t.me/<бот>/<app>?startapp=quran_2_255 | azkar_morning | tasbih
const param = startParam();
if (param) {
  const [kind, a, b] = param.split("_");
  if (kind === "quran" && +a >= 1 && +a <= 114) open("quran", "surah", { n: +a, a: +b || undefined });
  else if (kind === "azkar" && findCategory(a)) open("azkar", "azkar-cat", { id: a });
  else if (kind === "azkar") open("azkar");
  else if (kind === "tasbih") open("tasbih");
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") back();
});

syncFromCloud();

// На localhost SW выключен, чтобы правки были видны сразу (включить: ?sw)
const devHost = ["localhost", "127.0.0.1"].includes(location.hostname) && !new URLSearchParams(location.search).has("sw");
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  if (devHost) navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
  else window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}

document.documentElement.classList.add("ready");
