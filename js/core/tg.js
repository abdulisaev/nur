// Обёртка над Telegram Mini Apps API. Вне Telegram всё деградирует до браузерных аналогов.
export const tg = window.Telegram?.WebApp;
export const inTG = !!(tg && tg.initData);
export const ver = (v) => inTG && typeof tg.isVersionAtLeast === "function" && tg.isVersionAtLeast(v);

export function initTelegram() {
  if (!inTG) return;
  document.documentElement.classList.add("tg");
  try {
    tg.ready();
    tg.expand();
    if (ver("7.7")) tg.disableVerticalSwipes();
  } catch {}
}

export function haptic(kind = "light") {
  if (inTG && ver("6.1") && tg.HapticFeedback) {
    try {
      if (kind === "success" || kind === "warning" || kind === "error") tg.HapticFeedback.notificationOccurred(kind);
      else if (kind === "select") tg.HapticFeedback.selectionChanged();
      else tg.HapticFeedback.impactOccurred(kind);
    } catch {}
    return;
  }
  if (typeof navigator.vibrate === "function") {
    // Браузер разрешает вибрацию только после первого касания страницы
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    // Короче ~15 мс многие вибромоторы Android просто не отрабатывают
    const pattern = { success: [30, 70, 30], warning: [40, 50, 40], error: [60, 40, 60], select: 12, heavy: 45, medium: 30 }[kind] ?? 20;
    try { navigator.vibrate(pattern); } catch {}
    return;
  }
  if (isIOS) {
    iosTap();
    if (kind === "success" || kind === "warning" || kind === "error") setTimeout(iosTap, 120);
  }
}

// Safari на iPhone не умеет navigator.vibrate, но с iOS 18 переключатель
// <input type="checkbox" switch> даёт системный тактильный отклик — используем его.
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
function iosTap() {
  try {
    const label = document.createElement("label");
    label.ariaHidden = "true";
    label.style.display = "none";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.append(input);
    document.head.append(label);
    label.click();
    label.remove();
  } catch {}
}

export function setChromeColor(color) {
  if (!inTG || !/^#[0-9a-f]{6}$/i.test(color)) return;
  try {
    if (ver("6.9")) {
      tg.setHeaderColor(color);
      tg.setBackgroundColor(color);
    }
    if (ver("7.10")) tg.setBottomBarColor(color);
  } catch {}
}

export const backButton = {
  visible: false,
  handler: null,
  bind(fn) {
    this.handler = fn;
    if (inTG && ver("6.1")) tg.BackButton.onClick(() => this.handler && this.handler());
  },
  set(show) {
    if (!inTG || !ver("6.1") || show === this.visible) return;
    this.visible = show;
    show ? tg.BackButton.show() : tg.BackButton.hide();
  },
};

export const fullscreen = {
  supported: () => ver("8.0") && typeof tg.requestFullscreen === "function",
  active: () => !!(inTG && tg.isFullscreen),
  // На компьютере полноэкранный режим занял бы весь монитор — включаем автоматически только на телефонах
  mobile: () => inTG && ["ios", "android", "android_x"].includes(tg.platform),
  enter() {
    if (!this.supported() || tg.isFullscreen) return;
    try { tg.requestFullscreen(); } catch {}
  },
  exit() {
    if (!this.supported() || !tg.isFullscreen) return;
    try { tg.exitFullscreen(); } catch {}
  },
};

export const homeScreen = {
  supported: () => ver("8.0") && typeof tg.addToHomeScreen === "function",
  add() { try { tg.addToHomeScreen(); } catch {} },
};

// CloudStorage: до 1024 ключей по 4096 символов — достаточно для настроек и закладок
export const cloud = {
  ok: () => ver("6.9") && !!tg.CloudStorage,
  timers: {},
  set(key, value) {
    if (!this.ok() || value.length > 4000) return;
    clearTimeout(this.timers[key]);
    this.timers[key] = setTimeout(() => {
      try { tg.CloudStorage.setItem(key, value); } catch {}
    }, 800);
  },
  getMany(keys) {
    return new Promise((resolve) => {
      if (!this.ok()) return resolve({});
      const timer = setTimeout(() => resolve({}), 3000);
      try {
        tg.CloudStorage.getItems(keys, (err, values) => {
          clearTimeout(timer);
          resolve(err ? {} : values || {});
        });
      } catch {
        clearTimeout(timer);
        resolve({});
      }
    });
  },
};

export function shareText(text) {
  if (inTG && ver("6.1")) {
    const url = `https://t.me/share/url?url=${encodeURIComponent(" ")}&text=${encodeURIComponent(text)}`;
    try { tg.openTelegramLink(url); return true; } catch {}
  }
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
    return true;
  }
  return false;
}

export const startParam = () => (inTG && tg.initDataUnsafe?.start_param) || new URLSearchParams(location.search).get("startapp") || "";
