// Время намаза: шторка ручной поправки, выбор города, страница настроек.
import { h, openSheet, row, group, toggle, radioGroup, toast, confirmSheet } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { haptic } from "../core/tg.js";
import { settings, set } from "../core/store.js";
import { PRAYERS, METHODS, ASR_SCHOOLS, CITIES, currentPlace, currentMethod, currentSchool, prayerTimes, todayIn, formatTime, requestLocation } from "../core/prayer.js";

export const PRAYER_COLORS = { fajr: "#5e5ce6", sunrise: "#ff9f0a", dhuhr: "#ff9500", asr: "#ff6b3d", maghrib: "#bf5af2", isha: "#0a84ff", lastThird: "#30b0c7" };
export const prayerName = (id) => (id === "lastThird" ? "Тахаджуд" : PRAYERS.find((p) => p.id === id)?.name || id);
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);

// Ручная поправка одного намаза: ползунок −60…+60 минут
export function openAdjustSheet(id, onSaved) {
  const place = currentPlace();
  const today = todayIn(place.tz);
  const base = prayerTimes(today, place, { adjust: { ...settings.prayerAdjust, [id]: 0 } })[id];
  let value = settings.prayerAdjust?.[id] || 0;
  const name = prayerName(id);

  const timeLabel = h("div", { class: "adj-time" });
  const deltaLabel = h("div", { class: "adj-delta" });
  const input = h("input", { class: "slider adj-slider", type: "range", min: -60, max: 60, step: 1, value });
  const paint = () => {
    const t = new Date(base.getTime() + value * 60000);
    timeLabel.textContent = formatTime(t, place.tz);
    deltaLabel.textContent = value ? `${signed(value)} мин к расчёту` : "Без поправки";
    input.value = value;
    input.style.setProperty("--pct", `${((value + 60) / 120) * 100}%`);
  };
  input.addEventListener("input", () => {
    value = Number(input.value);
    if (value % 5 === 0) haptic("select");
    paint();
  });
  const step = (d) => h("button", { class: "round-btn glass-soft small", type: "button", "aria-label": d > 0 ? "Плюс минута" : "Минус минута", onclick: () => { value = Math.max(-60, Math.min(60, value + d)); haptic("select"); paint(); } }, icon(d > 0 ? "plus" : "minus", 18));

  const sheet = openSheet({
    title: "Поправка времени",
    content: [
      h("div", { class: "adj-head" },
        h("h2", null, `Время ${name}`),
        h("p", { class: "row-sub" }, `По расчёту — ${formatTime(base, place.tz)}`)),
      h("div", { class: "adj-card card" },
        h("div", { class: "adj-center" }, step(-1), h("div", null, h("div", { class: "row-sub" }, name), timeLabel, deltaLabel), step(1)),
        input,
        h("div", { class: "adj-scale" }, h("span", null, "−60 мин"), h("button", { class: "link-btn", type: "button", onclick: () => { value = 0; haptic("select"); paint(); } }, "Сбросить"), h("span", null, "+60 мин")),
      ),
      h("p", { class: "footnote" }, "Сдвиньте время, если оно отличается от расписания вашей мечети или муфтията. Поправка сохраняется на каждый день."),
      h("div", { class: "sheet-actions" }, h("button", { class: "btn btn-accent", type: "button", onclick: () => {
        set("prayerAdjust", { ...settings.prayerAdjust, [id]: value });
        haptic("success");
        toast(value ? `${name}: ${signed(value)} мин` : `${name}: без поправки`, "check");
        sheet.close();
        onSaved?.();
      } }, "Сохранить")),
    ],
  });
  paint();
}

// Выбор города или геолокация
export function openCitySheet(onSaved) {
  const search = h("input", { class: "search-input", type: "search", placeholder: "Найти город", autocomplete: "off" });
  const list = h("div", { class: "group card" });
  const geoRow = row({ iconName: "target", color: "#34c759", label: "Определить по геолокации", sub: "Точное время для вашего места", onClick: async () => {
    geoRow.querySelector(".row-sub").textContent = "Определяем…";
    try {
      const g = await requestLocation();
      set("prayerGeo", g);
      set("prayerCity", "geo");
      haptic("success");
      toast(`Место: ${currentPlace().name}`, "check");
      sheet.close();
      onSaved?.();
    } catch (e) {
      geoRow.querySelector(".row-sub").textContent = e.message || "Не удалось определить";
      haptic("error");
    }
  } });

  function render() {
    const q = search.value.trim().toLowerCase().replace(/ё/g, "е");
    const found = CITIES.filter((c) => !q || c.name.toLowerCase().replace(/ё/g, "е").includes(q) || c.region.toLowerCase().includes(q));
    list.replaceChildren(...(found.length ? found.map((c) => {
      const el = h("button", { class: `row radio${settings.prayerCity === c.id ? " checked" : ""}`, type: "button" },
        h("div", { class: "row-main" }, h("div", { class: "row-label" }, c.name), h("div", { class: "row-sub" }, c.region)),
        h("span", { class: "radio-check" }, icon("check", 18)));
      el.addEventListener("click", () => {
        set("prayerCity", c.id);
        haptic("select");
        sheet.close();
        onSaved?.();
      });
      return el;
    }) : [h("div", { class: "empty" }, "Город не найден — используйте геолокацию")]));
  }
  search.addEventListener("input", render);

  const sheet = openSheet({
    title: "Местоположение",
    className: "tall",
    content: [
      h("label", { class: "search glass-soft" }, icon("search", 18), search),
      h("div", { class: "group card", style: "margin:12px 0" }, geoRow),
      list,
    ],
  });
  render();
}

// Содержимое страницы «Время намаза» в настройках
export function prayerSettings(page) {
  const box = h("div");
  function render() {
    const place = currentPlace();
    const adj = settings.prayerAdjust || {};
    box.replaceChildren(
      group("Местоположение",
        row({ iconName: "target", color: "#34c759", label: place.name, sub: place.region, onClick: () => openCitySheet(render) }),
      ),
      radioGroup("Источник времени намаза", METHODS.map((m) => ({ value: m.id, label: m.name, sub: m.note })), settings.prayerMethod, (v) => { set("prayerMethod", v); }),
      radioGroup("Расчёт Асра", ASR_SCHOOLS.map((s) => ({ value: s.id, label: s.id === "standard" ? "Стандартный (рекомендуется)" : s.name, sub: s.note })), settings.asrSchool, (v) => set("asrSchool", v)),
      group("Поправки вручную",
        ...PRAYERS.map((p) => row({
          iconName: p.icon, color: PRAYER_COLORS[p.id], label: p.name,
          right: adj[p.id] ? `${signed(adj[p.id])} мин` : "0",
          onClick: () => openAdjustSheet(p.id, render),
        })),
        row({ iconName: "reset", color: "#8e8e93", label: "Сбросить все поправки", chevron: false, onClick: async () => {
          if (!(await confirmSheet({ title: "Сбросить поправки?", text: "Время вернётся к расчётному по выбранному источнику.", okText: "Сбросить", danger: true }))) return;
          set("prayerAdjust", { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 });
          render();
        } }),
      ),
      group("Дополнительно",
        row({ iconName: "moon", color: PRAYER_COLORS.lastThird, label: "Тахаджуд", sub: "Показывать начало последней трети ночи", right: toggle(settings.showTahajjud, (v) => set("showTahajjud", v)) }),
      ),
      h("p", { class: "footnote" },
        `Сейчас: ${currentMethod().name}, Аср — ${currentSchool().name.toLowerCase()}. Время рассчитывается по положению Солнца прямо на устройстве, летнее время учитывается автоматически. Если оно расходится с расписанием вашей мечети, настройте поправки — они сохранятся на каждый день.`),
    );
  }
  render();
  page.onShow = render;
  return box;
}
