// Настройки: оформление, текст и шрифты, счётчик, Коран и аудио, офлайн, о приложении.
import { h, row, group, toggle, segmented, slider, radioGroup, confirmSheet, toast } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { register, makePage, push } from "../core/nav.js";
import { settings, set, resetSettings } from "../core/store.js";
import { inTG, haptic, fullscreen, homeScreen } from "../core/tg.js";
import { pwa, browserFullscreen } from "../core/pwa.js";
import { THEMES, ACCENTS } from "../core/theme.js";
import { AR_FONTS, TR_FONTS, loadAllFonts } from "../core/fonts.js";
import { TRANSLATIONS, offlineStatus, downloadQuran, clearQuranCache, storageEstimate } from "../core/data.js";
import { reciter, initials } from "../data/reciters.js";
import { openReciterSheet, playbackControls } from "./player-ui.js";
import { prayerSettings } from "./prayer-ui.js";
import { currentPlace } from "../core/prayer.js";

export const APP_VERSION = "1.3.1";

const GLASS = [["high", "Сильное"], ["normal", "Обычное"], ["low", "Лёгкое"], ["off", "Без"]];
const themeName = () => THEMES.find((t) => t.id === settings.theme)?.name || "";

register("settings", () => {
  const page = makePage({ title: "Настройки" });
  const body = h("div");
  page.content.append(body);

  function render() {
    const onFullscreen = (v) => {
      set("fullscreen", v);
      if (inTG) v ? fullscreen.enter() : fullscreen.exit();
      else v ? browserFullscreen.enter() : browserFullscreen.exit();
    };
    const canFullscreen = inTG ? fullscreen.supported() : browserFullscreen.supported();
    const screenGroup = group("Экран",
      canFullscreen ? row({ iconName: "fullscreen", color: "#2aabee", label: "На весь экран", sub: inTG ? "Без шапки Telegram" : "Скрывает панели браузера", right: toggle(settings.fullscreen, onFullscreen) }) : null,
      inTG && homeScreen.supported() ? row({ iconName: "phone", color: "#34c759", label: "Добавить на главный экран", onClick: () => homeScreen.add() }) : null,
      pwa.available() ? row({ iconName: "phone", color: "#34c759", label: "Установить на главный экран", sub: "Открывается как приложение, без адресной строки", onClick: () => pwa.install() }) : null,
    );
    const hasScreenRows = !!screenGroup.querySelector(".row");

    body.replaceChildren(
      h("div", { class: "app-card card" },
        h("img", { src: "icons/icon.svg", alt: "", width: 56, height: 56 }),
        h("div", null, h("div", { class: "app-name" }, "Нур"), h("div", { class: "row-sub" }, "Азкары и Коран · версия " + APP_VERSION)),
      ),
      group(null,
        row({ iconName: "mosque", color: "#12a27e", label: "Время намаза", right: currentPlace().name, onClick: () => push("settings-sub", { id: "prayer" }) }),
        row({ iconName: "palette", color: "#bf5af2", label: "Оформление", right: themeName(), onClick: () => push("settings-sub", { id: "appearance" }) }),
        row({ iconName: "type", color: "#0a84ff", label: "Текст и шрифты", onClick: () => push("settings-sub", { id: "text" }) }),
        row({ iconName: "beads", color: "#ff9f0a", label: "Счётчик", onClick: () => push("settings-sub", { id: "counter" }) }),
        row({ iconName: "headphones", color: "#ff375f", label: "Коран и аудио", right: reciter(settings.reciter).name.split(" ").slice(-1)[0], onClick: () => push("settings-sub", { id: "quran" }) }),
        row({ iconName: "download", color: "#34c759", label: "Офлайн-режим", onClick: () => push("settings-sub", { id: "offline" }) }),
      ),
      hasScreenRows ? screenGroup : null,
      group(null,
        row({ iconName: "info", color: "#8e8e93", label: "О приложении и источниках", onClick: () => push("settings-sub", { id: "about" }) }),
        row({ iconName: "reset", color: "#ff3b30", label: "Сбросить настройки", chevron: false, onClick: async () => {
          if (await confirmSheet({ title: "Сбросить все настройки?", text: "Тема, шрифты и параметры вернутся к стандартным. Прогресс и закладки сохранятся.", okText: "Сбросить", danger: true })) {
            resetSettings();
            toast("Настройки сброшены", "reset");
            render();
          }
        } }),
      ),
    );
  }
  render();
  page.onShow = render;
  return page;
});

register("settings-sub", ({ id }) => {
  const builders = { appearance, text, counter, quran, offline, about, prayer: prayerSettings };
  const titles = { prayer: "Время намаза", appearance: "Оформление", text: "Текст и шрифты", counter: "Счётчик", quran: "Коран и аудио", offline: "Офлайн-режим", about: "О приложении" };
  const page = makePage({ title: titles[id], back: true });
  const result = builders[id](page);
  page.content.append(...[].concat(result.nodes || result));
  if (result.destroy) page.destroy = result.destroy;
  return page;
});

// ── Оформление ───────────────────────────────────────────────
function appearance() {
  const grid = h("div", { class: "theme-grid" });
  const paint = () => grid.querySelectorAll(".theme-card").forEach((el) => el.classList.toggle("selected", el.dataset.id === settings.theme));
  for (const t of THEMES) {
    if (t.id === "telegram" && !inTG) continue;
    const [a, b, c] = t.colors;
    const card = h("button", { class: "theme-card", type: "button", dataset: { id: t.id } },
      h("div", { class: "theme-prev", style: t.id === "auto" ? `background:linear-gradient(135deg, ${a} 50%, ${b} 50%)` : `background:radial-gradient(circle at 20% 15%, ${b} 0, transparent 60%), radial-gradient(circle at 85% 80%, ${c} 0, transparent 55%), ${a}` },
        h("i", { class: "tp-bar" }), h("i", { class: "tp-card" }), h("i", { class: "tp-card short" })),
      h("span", null, t.name),
    );
    card.addEventListener("click", () => { haptic("select"); set("theme", t.id); paint(); });
    grid.append(card);
  }
  paint();

  const dots = h("div", { class: "accent-row" });
  const paintDots = () => dots.querySelectorAll(".accent-dot").forEach((d) => d.classList.toggle("selected", d.dataset.v === settings.accent));
  for (const [v, name] of ACCENTS) {
    const d = h("button", { class: `accent-dot${v === "auto" ? " auto" : ""}`, type: "button", title: name, "aria-label": name, dataset: { v }, style: v === "auto" ? "" : `--c:${v}` }, v === "auto" ? "A" : null);
    d.addEventListener("click", () => { haptic("select"); set("accent", v); paintDots(); });
    dots.append(d);
  }
  paintDots();

  return [
    h("section", { class: "group-wrap" }, h("h4", { class: "group-title" }, "Тема"), grid),
    group("Акцентный цвет", h("div", { class: "row" }, dots)),
    group("Эффект стекла", h("div", { class: "row" }, segmented(GLASS, settings.glass, (v) => set("glass", v), "wide"))),
    group(null,
      row({ iconName: "sparkles", color: "#5e5ce6", label: "Живой фон", sub: "Плавное движение цветных пятен", right: toggle(settings.animatedBg, (v) => set("animatedBg", v)) }),
    ),
    h("p", { class: "footnote" }, "«Без стекла» и выключенный живой фон экономят батарею на слабых устройствах."),
  ];
}

// ── Текст и шрифты ───────────────────────────────────────────
function text() {
  loadAllFonts();
  const preview = h("div", { class: "preview card" },
    h("div", { class: "eyebrow" }, "Предпросмотр"),
    h("div", { class: "ar", lang: "ar", dir: "rtl" }, "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ، سُبْحَانَ اللَّهِ الْعَظِيمِ"),
    h("div", { class: "translit" }, "СубханАллахи ва бихамдих, субханАллахиль-'Азым."),
    h("div", { class: "translation" }, "Пречист Аллах, и хвала Ему; пречист Аллах Великий."),
  );
  const sample = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";
  return [
    preview,
    radioGroup("Арабский шрифт", AR_FONTS.map((f) => ({
      value: f.id, label: f.name, sub: f.note,
      right: h("span", { class: "font-sample", style: `font-family:${f.family}`, dir: "rtl" }, sample),
    })), settings.arFont, (v) => set("arFont", v)),
    group("Размер арабского текста", h("div", { class: "row" }, slider({ min: 20, max: 56, value: settings.arSize, onInput: (v) => set("arSize", v) }))),
    group("Выравнивание арабского в азкарах", h("div", { class: "row" }, segmented([["right", "По правому краю"], ["center", "По центру"]], settings.arAlign, (v) => set("arAlign", v), "wide"))),
    radioGroup("Шрифт перевода и транскрипции", TR_FONTS.map((f) => ({ value: f.id, label: f.name, sub: f.note, labelStyle: `font-family:${f.family}` })), settings.trFont, (v) => set("trFont", v)),
    group("Размер перевода", h("div", { class: "row" }, slider({ min: 12, max: 26, value: settings.trSize, onInput: (v) => set("trSize", v) }))),
    group("Размер транскрипции", h("div", { class: "row" }, slider({ min: 12, max: 24, value: settings.tlSize, onInput: (v) => set("tlSize", v) }))),
    group("Межстрочный интервал", h("div", { class: "row" }, slider({ min: 1.3, max: 2.2, step: 0.05, value: settings.lineHeight, onInput: (v) => set("lineHeight", v), format: (v) => v.toFixed(2) }))),
    group("Показывать в азкарах",
      row({ label: "Транскрипцию", right: toggle(settings.showTranslit, (v) => set("showTranslit", v)) }),
      row({ label: "Перевод", right: toggle(settings.showTranslation, (v) => set("showTranslation", v)) }),
      row({ label: "Источник и достоверность", right: toggle(settings.showSource, (v) => set("showSource", v)) }),
      row({ label: "Достоинство зикра", right: toggle(settings.showFadl, (v) => set("showFadl", v)) }),
    ),
  ];
}

// ── Счётчик ──────────────────────────────────────────────────
function counter() {
  return [
    group("Отклик",
      row({ iconName: "vibrate", color: "#ff9f0a", label: "Вибрация при нажатии", right: toggle(settings.hapticTap, (v) => { set("hapticTap", v); if (v) haptic("light"); }) }),
      row({ iconName: "check", color: "#34c759", label: "Вибрация по завершении", right: toggle(settings.hapticDone, (v) => { set("hapticDone", v); if (v) haptic("success"); }) }),
      row({ iconName: "volume", color: "#0a84ff", label: "Звук нажатия", right: toggle(settings.sound, (v) => set("sound", v)) }),
    ),
    group("Азкары",
      row({ iconName: "hand", color: "#5e5ce6", label: "Считать нажатием на карточку", sub: "Иначе — только кнопкой счётчика", right: toggle(settings.tapCard, (v) => set("tapCard", v)) }),
      row({ iconName: "chevron-down", color: "#30b0c7", label: "Автопереход к следующему", sub: "После завершения зикра", right: toggle(settings.autoNext, (v) => set("autoNext", v)) }),
      row({ iconName: "sun", color: "#ffcc00", label: "Сбрасывать прогресс каждый день", right: toggle(settings.dailyReset, (v) => set("dailyReset", v)) }),
    ),
    group("Вид азкаров", h("div", { class: "row" }, segmented([["list", "Списком"], ["cards", "Карточками"]], settings.azkarView, (v) => set("azkarView", v), "wide"))),
    h("p", { class: "footnote" }, "В тасбихе можно считать и клавишей «Пробел» на компьютере."),
  ];
}

// ── Коран и аудио ────────────────────────────────────────────
function quran() {
  const r = reciter(settings.reciter);
  const reciterRow = row({ label: r.name, sub: r.info, right: h("span", { class: "avatar sm" }, initials(r.name)), onClick: () => openReciterSheet() });
  return [
    radioGroup("Перевод смыслов", TRANSLATIONS.map((t) => ({ value: t.id, label: t.name, sub: t.note })), settings.translation, (v) => set("translation", v)),
    group("Режим чтения", h("div", { class: "row" }, segmented([["ayah", "Аяты с переводом"], ["mushaf", "Мусхаф"]], settings.quranMode, (v) => set("quranMode", v), "wide"))),
    group("Чтец", reciterRow),
    ...playbackControls(),
  ];
}

// ── Офлайн ───────────────────────────────────────────────────
function offline() {
  const status = h("div", { class: "group card" });
  const bar = h("div", { class: "prog-bar big" }, h("i"));
  const barLabel = h("div", { class: "row-sub" });
  const progressBox = h("div", { class: "download-progress", hidden: true }, bar, barLabel);
  const dlBtn = h("button", { class: "btn btn-accent block", type: "button" }, icon("download", 18), "Скачать Коран");
  const clearBtn = h("button", { class: "btn btn-ghost block", type: "button" }, icon("trash", 18), "Удалить офлайн-данные");
  const editions = () => ["ar", ...(settings.translation !== "none" ? [settings.translation] : [])];
  const edName = (e) => (e === "ar" ? "Арабский текст" : TRANSLATIONS.find((t) => t.id === e)?.name || e);
  const controller = new AbortController();

  async function refresh() {
    const swActive = !!navigator.serviceWorker?.controller;
    const st = await offlineStatus(editions());
    const usage = await storageEstimate();
    const rows = [
      row({ iconName: "layers", color: swActive ? "#34c759" : "#8e8e93", label: "Приложение офлайн", sub: swActive ? "Интерфейс и азкары сохранены на устройстве" : "Недоступно в этом окружении (например, Telegram на iOS) — нужен интернет для запуска", chevron: false }),
    ];
    if (st) for (const e of editions()) rows.push(row({ iconName: st[e] === 114 ? "check" : "book", color: st[e] === 114 ? "#34c759" : "#ff9f0a", label: edName(e), right: `${st[e]} / 114`, chevron: false }));
    if (usage != null) rows.push(row({ iconName: "cloud", color: "#0a84ff", label: "Занято на устройстве", right: `${(usage / 1048576).toFixed(1)} МБ`, chevron: false }));
    status.replaceChildren(...rows);
    const complete = st && editions().every((e) => st[e] === 114);
    dlBtn.disabled = !!complete;
    dlBtn.replaceChildren(icon(complete ? "check" : "download", 18), complete ? "Коран скачан" : "Скачать Коран (~3 МБ)");
  }

  dlBtn.addEventListener("click", async () => {
    dlBtn.disabled = true;
    progressBox.hidden = false;
    haptic("medium");
    try {
      const res = await downloadQuran(editions(), (done, total) => {
        bar.firstChild.style.transform = `scaleX(${done / total})`;
        barLabel.textContent = `Загружено ${done} из ${total}`;
      }, controller.signal);
      if (res.failed) toast(`Не загружено файлов: ${res.failed}. Попробуйте ещё раз`, "info");
      else { toast("Коран доступен офлайн", "check"); haptic("success"); }
    } catch (e) {
      toast(e.message || "Ошибка загрузки", "info");
    }
    progressBox.hidden = true;
    refresh();
  });

  clearBtn.addEventListener("click", async () => {
    if (!(await confirmSheet({ title: "Удалить офлайн-данные Корана?", text: "Суры будут снова загружаться из интернета.", okText: "Удалить", danger: true }))) return;
    await clearQuranCache();
    toast("Удалено", "trash");
    refresh();
  });

  refresh();
  return {
    nodes: [
      status,
      h("div", { class: "stack" }, progressBox, dlBtn, clearBtn),
      h("p", { class: "footnote" }, "Азкары, тасбих и настройки работают без интернета всегда. Текст Корана можно скачать целиком — около 3 МБ для арабского текста и выбранного перевода. Аудио чтецов воспроизводится только онлайн."),
    ],
    destroy: () => controller.abort(),
  };
}

// ── О приложении ─────────────────────────────────────────────
function about() {
  const src = (title, text) => h("div", { class: "about-item" }, h("b", null, title), h("p", null, text));
  return [
    h("div", { class: "about card" },
      h("img", { src: "icons/icon.svg", alt: "", width: 72, height: 72 }),
      h("h2", null, "Нур"),
      h("p", { class: "row-sub" }, `Азкары и Коран · ${APP_VERSION}`),
      h("p", { class: "ar about-ar", lang: "ar", dir: "rtl" }, "أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ"),
      h("p", { class: "row-sub" }, "«Разве не поминанием Аллаха утешаются сердца?» (13:28)"),
    ),
    h("div", { class: "card about-sources" },
      src("Азкары", "По книге «Крепость мусульманина» (Са'ид аль-Кахтани), сверены с первоисточниками — аль-Бухари, Муслим, Абу Дауд, ат-Тирмизи, ан-Насаи, Ибн Маджа, Ахмад. Включены только хадисы со степенью «сахих» или «хасан»; у каждого зикра указан источник."),
      src("Текст Корана", "Tanzil Project (tanzil.net), Усманский шрифт. Текст распространяется без изменений с указанием источника."),
      src("Переводы смыслов", "Э. Кулиев, Абу Адель, М.-Н. Османов — через проект Tanzil / alquran.cloud. Переводы предназначены для некоммерческого использования."),
      src("Аудио", "Записи чтецов — everyayah.com, воспроизведение по аятам."),
      src("Шрифты", "Amiri Quran, Scheherazade New, Amiri, Noto Naskh Arabic, Lateef и др. — Google Fonts, лицензия OFL."),
    ),
    h("p", { class: "footnote" }, "Транскрипция приблизительна и не передаёт все звуки арабского языка. Перевод Корана — это перевод смыслов, а не сам Коран."),
  ];
}
