// Режим «на весь экран» в обычном браузере: установка на главный экран (PWA)
// и Fullscreen API на Android. В Telegram используется его собственный полноэкранный режим.
import { inTG } from "./tg.js";
import { h, openSheet, toast } from "./ui.js";

let deferredPrompt = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  notify();
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  toast("«Нур» установлен на главный экран", "check");
  notify();
});

export const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: fullscreen)").matches || navigator.standalone === true;
const isTouch = () => matchMedia("(pointer: coarse)").matches;

const DISMISS_KEY = "nur:installHidden";

export const pwa = {
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  // Предлагать установку имеет смысл только в мобильном браузере
  available: () => !inTG && !isStandalone(),
  suggest() {
    let hidden = false;
    try { hidden = !!localStorage.getItem(DISMISS_KEY); } catch {}
    return this.available() && isTouch() && !hidden;
  },
  dismiss() {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch {}
    notify();
  },
  async install() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch {}
      deferredPrompt = null;
      notify();
      return;
    }
    showInstructions();
  },
};

function showInstructions() {
  const ios = isIOS();
  const steps = ios
    ? ["Откройте сайт в Safari", "Нажмите «Поделиться» — квадрат со стрелкой вверх", "Выберите «На экран „Домой“» и нажмите «Добавить»", "Запускайте «Нур» с иконки — он откроется на весь экран"]
    : ["Откройте меню браузера — три точки ⋮", "Выберите «Установить приложение» или «Добавить на главный экран»", "Запускайте «Нур» с иконки — он откроется на весь экран"];
  openSheet({
    title: "На весь экран",
    content: [
      h("p", { class: "sheet-text" }, "Браузер не даёт сайту скрыть адресную строку. Установите «Нур» на главный экран — он будет открываться как обычное приложение, без панелей браузера."),
      h("ol", { class: "steps card" }, steps.map((s) => h("li", null, s))),
    ],
  });
}

// Fullscreen API: работает в Chrome и других браузерах на Android, но не на iPhone
export const browserFullscreen = {
  supported: () => !inTG && !isStandalone() && !!document.fullscreenEnabled && !!document.documentElement.requestFullscreen,
  active: () => !!document.fullscreenElement,
  enter() {
    if (!this.supported() || document.fullscreenElement) return;
    document.documentElement.requestFullscreen({ navigationUI: "hide" }).catch(() => {});
  },
  exit() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  },
  // Браузер разрешает войти в полноэкранный режим только по нажатию — делаем это при первом касании
  enterOnFirstTap() {
    if (!this.supported() || !isTouch()) return;
    document.addEventListener("click", () => this.enter(), { once: true, capture: true });
  },
};
