// Главная — время намаза: следующий намаз с обратным отсчётом, расписание на день, азкары по времени.
import { h } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { register, makePage, open, push } from "../core/nav.js";
import { settings, onChange } from "../core/store.js";
import { haptic } from "../core/tg.js";
import { pwa } from "../core/pwa.js";
import { PRAYERS, currentPlace, currentMethod, currentSchool, prayerTimes, prayerState, todayIn, addDays, formatTime, countdown } from "../core/prayer.js";
import { findCategory } from "../data/azkar.js";
import { catStats } from "./azkar.js";
import { openAdjustSheet, PRAYER_COLORS, prayerName } from "./prayer-ui.js";

const PRAYER_KEYS = ["prayerCity", "prayerGeo", "prayerMethod", "asrSchool", "prayerAdjust", "showTahajjud", "*"];

function hijriDate(date, tz) {
  try {
    const parts = new Intl.DateTimeFormat("ru-RU-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric", timeZone: tz }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return get("day") && get("month") && get("year") ? `${get("day")} ${get("month")} ${get("year")} г. х.` : "";
  } catch {
    return "";
  }
}

const dayDate = ({ y, m, d }) => new Date(Date.UTC(y, m - 1, d, 12));

register("home", () => {
  const settingsBtn = h("button", { class: "icon-btn glass-btn", "aria-label": "Настройки времени намаза" }, icon("sliders", 19));
  const page = makePage({ title: "", subtitle: "", actions: [settingsBtn] });
  const installSlot = h("div");
  const hero = h("button", { class: "prayer-hero card", type: "button" });
  const placeChip = h("button", { class: "place-chip", type: "button" });
  const dayLabel = h("div", { class: "day-label" });
  const prevDay = h("button", { class: "icon-btn day-arrow", type: "button", "aria-label": "Предыдущий день" }, icon("chevron-left", 20));
  const nextDay = h("button", { class: "icon-btn day-arrow", type: "button", "aria-label": "Следующий день" }, icon("chevron-right", 20));
  const times = h("div", { class: "group card prayer-list" });
  const azkarSlot = h("div");
 page.content.append(
    installSlot, hero, placeChip,
    h("div", { class: "day-switch" }, prevDay, dayLabel, nextDay),
    times, azkarSlot,
  );

  let offset = 0; // 0 — сегодня, ±n — другие дни
  let lastDay = "";

  const openSettings = () => { haptic("light"); push("settings-sub", { id: "prayer" }); };
  settingsBtn.addEventListener("click", openSettings);
  placeChip.addEventListener("click", openSettings);
  prevDay.addEventListener("click", () => { offset--; haptic("select"); renderTimes(); });
  nextDay.addEventListener("click", () => { offset++; haptic("select"); renderTimes(); });
  dayLabel.addEventListener("click", () => { if (offset) { offset = 0; haptic("select"); renderTimes(); } });

  function renderHeader() {
    const place = currentPlace();
    const now = new Date();
    // Заголовок — дата; город виден в строке с источником расчёта
    const date = now.toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: place.tz });
    const weekday = now.toLocaleDateString("ru-RU", { weekday: "long", timeZone: place.tz });
    const hijri = hijriDate(now, place.tz);
    page.setTitle(date);
    const sub = page.head.querySelector(".large-sub") || page.head.appendChild(h("p", { class: "large-sub" }));
    sub.textContent = `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}${hijri ? ` · ${hijri}` : ""}`;
    const city = settings.prayerCity === "makhachkala" ? "" : `${place.name} · `;
    placeChip.replaceChildren(icon("target", 15), h("span", null, `${city}${currentMethod().name} · Аср: ${currentSchool().name.toLowerCase()}`), icon("chevron-right", 14));
  }

  function renderHero() {
    const place = currentPlace();
    const now = new Date();
    const st = prayerState(place, now);
    const span = st.currentTime ? st.nextTime - st.currentTime : 0;
    const pct = span > 0 ? Math.min(1, (now - st.currentTime) / span) : 0;
    hero.style.setProperty("--tint", PRAYER_COLORS[st.next]);
    hero.replaceChildren(
      h("div", { class: "hero-glow" }),
      h("div", { class: "eyebrow" }, icon("mosque", 15), "Следующий намаз"),
      h("div", { class: "ph-main" },
        h("div", null, h("div", { class: "ph-name" }, prayerName(st.next)), h("div", { class: "ph-ar" }, PRAYERS.find((p) => p.id === st.next)?.ar || "")),
        h("div", { class: "ph-time" }, formatTime(st.nextTime, place.tz))),
      h("div", { class: "ph-count" }, countdown(st.nextTime - now)),
      h("div", { class: "prog-bar" }, h("i", { style: `transform:scaleX(${pct})` })),
      st.current ? h("div", { class: "ph-now" }, `Сейчас время намаза ${prayerName(st.current)} — с ${formatTime(st.currentTime, place.tz)}`) : h("div", { class: "ph-now" }, "Время духа — намаз Зухр ещё не наступил"),
    );
    hero.onclick = () => openAdjustSheet(st.next, renderAll);
    return st;
  }

  function renderTimes() {
    const place = currentPlace();
    const now = new Date();
    const today = todayIn(place.tz, now);
    const day = addDays(today, offset);
    const t = prayerTimes(day, place);
    const st = offset === 0 ? prayerState(place, now) : null;
    const label = dayDate(day).toLocaleDateString("ru-RU", { day: "numeric", month: "long", weekday: "short", timeZone: "UTC" });
    dayLabel.replaceChildren(
      h("b", null, offset === 0 ? "Сегодня" : offset === 1 ? "Завтра" : offset === -1 ? "Вчера" : label.split(",")[0]),
      h("span", null, offset === 0 || Math.abs(offset) === 1 ? label : hijriDate(dayDate(day), "UTC")),
    );
    const rows = PRAYERS.map((p) => ({ id: p.id, name: p.name, ar: p.ar, icon: p.icon, time: t[p.id] }));
    if (settings.showTahajjud) rows.push({ id: "lastThird", name: "Тахаджуд", ar: "ثلث الليل الأخير", icon: "moon", time: t.lastThird, note: "последняя треть ночи" });
    times.replaceChildren(...rows.map((r) => {
      const adj = settings.prayerAdjust?.[r.id] || 0;
      const passed = offset < 0 || (offset === 0 && r.time < now && r.id !== st?.current);
      const cls = ["row", "prayer-row", passed ? "passed" : "", st?.current === r.id ? "current" : "", st?.next === r.id && r.time > now ? "next" : ""].filter(Boolean).join(" ");
      const el = h("button", { class: cls, type: "button" },
        h("span", { class: "tile", style: `--tile:${PRAYER_COLORS[r.id]}` }, icon(r.icon, 17)),
        h("div", { class: "row-main" },
          h("div", { class: "row-label" }, r.name, st?.current === r.id ? h("span", { class: "now-pill" }, "сейчас") : null),
          h("div", { class: "row-sub" }, r.note || r.ar)),
        adj ? h("span", { class: "adj-badge" }, `${adj > 0 ? "+" : ""}${adj}`) : null,
        h("div", { class: "prayer-time" }, formatTime(r.time, place.tz)),
      );
      if (r.id !== "lastThird") el.addEventListener("click", () => { haptic("light"); openAdjustSheet(r.id, renderAll); });
      return el;
    }));
  }

  // Азкары по времени намаза: утренние — после Фаджра до Зухра, вечерние — после Асра до Иши
  function renderAzkar(st) {
    const now = new Date();
    const t = st.times;
    const id = now >= t.fajr && now < t.dhuhr ? "morning" : now >= t.asr && now < t.isha ? "evening" : null;
    if (!id) { azkarSlot.replaceChildren(); return; }
    const cat = findCategory(id);
    const s = catStats(cat);
    const done = s.done === s.total;
    azkarSlot.replaceChildren(h("button", { class: "continue-card card", type: "button", style: `--tint:${cat.tint}`, onclick: () => { haptic("light"); open("azkar", "azkar-cat", { id }); } },
      h("span", { class: "tile big", style: `--tile:${cat.tint}` }, icon(cat.icon, 22)),
      h("div", { class: "row-main" },
        h("div", { class: "eyebrow" }, "Сейчас время"),
        h("div", { class: "row-label" }, cat.title),
        h("div", { class: "row-sub" }, done ? "Прочитано — да примет Аллах" : s.done ? `Прочитано ${s.done} из ${s.total}` : `${s.total} зикров`)),
      icon(done ? "check" : "chevron-right", 18, done ? "accent" : "chev"),
    ));
  }

  function renderInstall() {
    if (!pwa.suggest()) { installSlot.replaceChildren(); return; }
    installSlot.replaceChildren(h("div", { class: "install-card card" },
      h("img", { src: "icons/icon.svg", alt: "", width: 42, height: 42 }),
      h("div", { class: "row-main" },
        h("div", { class: "row-label" }, "Открывать на весь экран"),
        h("div", { class: "row-sub" }, "Установите «Нур» на главный экран — без адресной строки браузера"),
        h("button", { class: "btn btn-accent small", type: "button", onclick: () => { haptic("light"); pwa.install(); } }, "Установить")),
      h("button", { class: "icon-btn sm install-close", type: "button", "aria-label": "Скрыть", onclick: () => pwa.dismiss() }, icon("x", 16)),
    ));
  }

  function renderAll() {
    renderHeader();
    const st = renderHero();
    renderTimes();
    renderAzkar(st);
  }

  // Обратный отсчёт: обновляем каждые 15 секунд, пока экран виден; в полночь — новый день
  function tick() {
    if (page.el.hidden || document.hidden) return;
    const day = JSON.stringify(todayIn(currentPlace().tz));
    if (day !== lastDay) { lastDay = day; offset = 0; renderAll(); return; }
    const st = renderHero();
    if (offset === 0) renderTimes();
    renderAzkar(st);
  }

  renderInstall();
  renderAll();
  lastDay = JSON.stringify(todayIn(currentPlace().tz));
  setInterval(tick, 15000);
  document.addEventListener("visibilitychange", tick);
  pwa.onChange(renderInstall);
  onChange((key) => { if (PRAYER_KEYS.includes(key)) renderAll(); });
  page.onShow = () => { renderAll(); };
  return page;
});
