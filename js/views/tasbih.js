// Электронный тасбих: пресеты, последовательности, своя цель, круги и статистика.
import { h, openSheet, progressRing, confirmSheet, toast } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { register, makePage } from "../core/nav.js";
import { settings, load, save, today } from "../core/store.js";
import { haptic } from "../core/tg.js";
import { sound } from "../core/sound.js";

const D = {
  subhanallah: { ar: "سُبْحَانَ اللَّهِ", tr: "СубханАллах", ru: "Пречист Аллах" },
  alhamdulillah: { ar: "الْحَمْدُ لِلَّهِ", tr: "Альхамдулиллях", ru: "Хвала Аллаху" },
  allahuakbar: { ar: "اللَّهُ أَكْبَرُ", tr: "Аллаху акбар", ru: "Аллах велик" },
  tahlil: { ar: "لَا إِلَهَ إِلَّا اللَّهُ", tr: "Ля иляха илляЛлах", ru: "Нет божества, кроме Аллаха" },
  tahlilFull: { ar: "لَا إِلَهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ، وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ", tr: "Ля иляха илляЛлаху вахдаху ля шарика лях, ляхуль-мульку ва ляхуль-хамду, ва хува 'аля кулли шай'ин кадир", ru: "Нет божества, кроме одного лишь Аллаха, у Которого нет сотоварища. Ему — власть и хвала, и Он над всякой вещью мощен" },
  istighfar: { ar: "أَسْتَغْفِرُ اللَّهَ وَأَتُوبُ إِلَيْهِ", tr: "Астагфируллаха ва атубу иляйх", ru: "Прошу прощения у Аллаха и каюсь перед Ним" },
  bihamdihi: { ar: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ", tr: "СубханАллахи ва бихамдих", ru: "Пречист Аллах, и хвала Ему" },
  hawqala: { ar: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ", tr: "Ля хауля ва ля куввата илля биллях", ru: "Нет мощи и силы ни у кого, кроме Аллаха" },
  salawat: { ar: "اللَّهُمَّ صَلِّ عَلَى مُحَمَّدٍ", tr: "Аллахумма салли 'аля Мухаммад", ru: "О Аллах, благослови Мухаммада" },
};

export const PRESETS = [
  { id: "subhanallah", label: "СубханАллах", steps: [["subhanallah", 33]] },
  { id: "alhamdulillah", label: "Альхамдулиллях", steps: [["alhamdulillah", 33]] },
  { id: "allahuakbar", label: "Аллаху акбар", steps: [["allahuakbar", 33]] },
  { id: "after-prayer", label: "После намаза", hint: "33 · 33 · 33 · 1", steps: [["subhanallah", 33], ["alhamdulillah", 33], ["allahuakbar", 33], ["tahlilFull", 1]] },
  { id: "before-sleep", label: "Перед сном", hint: "33 · 33 · 34", steps: [["subhanallah", 33], ["alhamdulillah", 33], ["allahuakbar", 34]] },
  { id: "tahlil", label: "Ля иляха илляЛлах", steps: [["tahlil", 100]] },
  { id: "istighfar", label: "Истигфар", steps: [["istighfar", 100]] },
  { id: "bihamdihi", label: "Ва бихамдих", steps: [["bihamdihi", 100]] },
  { id: "hawqala", label: "Ля хауля", steps: [["hawqala", 33]] },
  { id: "salawat", label: "Салават", steps: [["salawat", 10]] },
  { id: "custom", label: "Свой зикр", steps: [["custom", 33]] },
];

const DEFAULT_STATE = { preset: "subhanallah", target: null, count: 0, step: 0, rounds: 0, day: "", todayCount: 0, total: 0, custom: { ar: "", ru: "" } };

export function tasbihToday() {
  const st = load("tasbih", DEFAULT_STATE);
  return st.day === today() ? st.todayCount : 0;
}

register("tasbih", () => {
  const st = { ...DEFAULT_STATE, ...load("tasbih", {}) };
  const persist = () => save("tasbih", st);

  const page = makePage({ title: "Тасбих", subtitle: "Нажимайте на круг или в любом месте под ним" });
  const chips = h("div", { class: "chips-scroll" });
  const arEl = h("div", { class: "ar tasbih-ar", lang: "ar", dir: "rtl" });
  const trEl = h("div", { class: "translit" });
  const ruEl = h("div", { class: "translation" });
  const stepEl = h("div", { class: "step-dots" });
  const prevArrow = h("button", { class: "dhikr-arrow prev", type: "button", "aria-label": "Предыдущий зикр", onclick: () => shiftPreset(-1) }, icon("chevron-left", 18));
  const nextArrow = h("button", { class: "dhikr-arrow next", type: "button", "aria-label": "Следующий зикр", onclick: () => shiftPreset(1) }, icon("chevron-right", 18));
  const dhikrText = h("div", { class: "dhikr-text" }, stepEl, arEl, trEl, ruEl);
  const dhikrCard = h("div", { class: "dhikr-card card" }, prevArrow, dhikrText, nextArrow);

  const ring = progressRing(300, 9);
  const countEl = h("div", { class: "tasbih-count" });
  const targetEl = h("div", { class: "tasbih-target" });
  const roundEl = h("div", { class: "tasbih-round" });
  const circle = h("button", { class: "tasbih-circle glass", type: "button", "aria-label": "Посчитать" }, ring, h("div", { class: "tasbih-center" }, countEl, targetEl, roundEl));
  const zone = h("div", { class: "tasbih-zone" }, circle);

  const targetBtn = h("button", { class: "chip", type: "button" });
  const controls = h("div", { class: "tasbih-controls" },
    h("button", { class: "round-btn glass-soft", type: "button", "aria-label": "Минус один", onclick: () => undo() }, icon("undo", 20)),
    targetBtn,
    h("button", { class: "round-btn glass-soft", type: "button", "aria-label": "Сбросить", onclick: () => reset() }, icon("reset", 20)),
  );
  const stats = h("div", { class: "tasbih-stats" });
  page.content.append(chips, dhikrCard, zone, controls, stats);
  page.el.classList.add("tasbih-page");

  const preset = () => PRESETS.find((p) => p.id === st.preset) || PRESETS[0];
  const stepInfo = () => {
    const p = preset();
    const [key, defTarget] = p.steps[Math.min(st.step, p.steps.length - 1)];
    const target = p.steps.length === 1 && st.target != null ? st.target : defTarget;
    const d = key === "custom" ? { ar: st.custom.ar || "Свой зикр", tr: "", ru: st.custom.ru || "Нажмите «Свой зикр», чтобы задать текст" } : D[key];
    return { ...d, target, multi: p.steps.length > 1 };
  };

  function renderChips() {
    chips.replaceChildren(...PRESETS.map((p) => {
      const b = h("button", { class: `chip${p.id === st.preset ? " active" : ""}`, type: "button" }, p.id === "custom" ? icon("edit", 15) : null, p.label, p.hint ? h("small", null, p.hint) : null);
      b.addEventListener("click", () => {
        haptic("select");
        if (p.id === "custom" && (st.preset === "custom" || !st.custom.ar)) return editCustom();
        selectPreset(p.id);
      });
      return b;
    }));
  }

  function selectPreset(id) {
    st.preset = id;
    st.step = 0;
    st.count = 0;
    st.rounds = 0;
    if (PRESETS.find((p) => p.id === id).steps.length > 1) st.target = null;
    persist();
    renderChips();
    render();
    const active = chips.querySelector(".chip.active");
    if (active) chips.scrollTo({ left: active.offsetLeft - (chips.clientWidth - active.offsetWidth) / 2, behavior: "smooth" });
  }

  function render() {
    const info = stepInfo();
    const p = preset();
    arEl.textContent = info.ar;
    trEl.textContent = info.tr;
    ruEl.textContent = info.ru;
    stepEl.replaceChildren(...(info.multi ? p.steps.map((_, i) => h("i", { class: i < st.step ? "done" : i === st.step ? "cur" : "" })) : []));
    countEl.textContent = st.count;
    targetEl.textContent = info.target ? `из ${info.target}` : "без ограничения";
    roundEl.textContent = st.rounds ? `Кругов: ${st.rounds}` : "";
    ring.set(info.target ? st.count / info.target : (st.count % 100) / 100);
    targetBtn.replaceChildren(icon("target", 16), info.multi ? p.hint : `Цель: ${info.target || "∞"}`);
    targetBtn.disabled = info.multi;
    const day = st.day === today() ? st.todayCount : 0;
    stats.replaceChildren(
      h("div", { class: "stat card" }, h("b", null, day.toLocaleString("ru-RU")), h("span", null, "сегодня")),
      h("div", { class: "stat card" }, h("b", null, st.total.toLocaleString("ru-RU")), h("span", null, "всего")),
    );
  }

  function count() {
    const info = stepInfo();
    const p = preset();
    if (info.target && st.count >= info.target) {
      // Цель уже достигнута — начинаем новый круг / следующий шаг
      st.count = 0;
      if (p.steps.length > 1) st.step = (st.step + 1) % p.steps.length;
    }
    st.count++;
    if (st.day !== today()) { st.day = today(); st.todayCount = 0; }
    st.todayCount++;
    st.total++;
    let finished = false;
    let sequenceDone = false;
    const cur = stepInfo();
    if (cur.target && st.count >= cur.target) {
      finished = true;
      if (p.steps.length > 1 && st.step < p.steps.length - 1) {
        st.step++;
        st.count = 0;
      } else {
        st.rounds++;
        sequenceDone = p.steps.length > 1;
      }
    }
    persist();
    render();
    circle.classList.remove("pulse");
    void circle.offsetWidth;
    circle.classList.add("pulse");
    if (finished) {
      if (settings.hapticDone) haptic("success");
      if (settings.sound) sound.done();
      if (sequenceDone) toast("Последовательность завершена", "check");
    } else {
      if (settings.hapticTap) haptic("light");
      if (settings.sound) sound.tick();
    }
  }

  function undo() {
    if (st.count > 0) {
      st.count--;
      st.todayCount = Math.max(0, st.todayCount - 1);
      st.total = Math.max(0, st.total - 1);
      persist();
      render();
      haptic("select");
    }
  }

  async function reset() {
    if (st.count === 0 && st.rounds === 0 && st.step === 0) return;
    if (!(await confirmSheet({ title: "Сбросить счётчик?", text: "Текущий счёт и круги обнулятся. Статистика за день сохранится.", okText: "Сбросить", danger: true }))) return;
    st.count = 0;
    st.rounds = 0;
    st.step = 0;
    persist();
    render();
    haptic("medium");
  }

  function pickTarget() {
    const opts = [33, 34, 99, 100, 300, 1000, 0];
    const input = h("input", { class: "text-input", type: "number", inputmode: "numeric", min: 1, max: 100000, placeholder: "Своё число" });
    const sheet = openSheet({
      title: "Цель",
      content: [
        h("div", { class: "target-grid" }, opts.map((v) => h("button", {
          class: `chip big${(st.target ?? stepInfo().target) === v ? " active" : ""}`, type: "button",
          onclick: () => { st.target = v; st.count = Math.min(st.count, v || st.count); persist(); render(); haptic("select"); sheet.close(); },
        }, v === 0 ? "∞" : String(v)))),
        h("div", { class: "input-row" }, input, h("button", { class: "btn btn-accent", type: "button", onclick: () => {
          const v = Math.round(Number(input.value));
          if (v > 0) { st.target = v; persist(); render(); sheet.close(); }
        } }, "Готово")),
      ],
    });
  }

  function editCustom() {
    const ar = h("textarea", { class: "text-input ar-input", rows: 2, dir: "auto", placeholder: "Текст зикра (на арабском или любом языке)" });
    const ru = h("input", { class: "text-input", type: "text", placeholder: "Перевод или заметка (необязательно)" });
    ar.value = st.custom.ar;
    ru.value = st.custom.ru;
    const sheet = openSheet({
      title: "Свой зикр",
      content: [
        h("div", { class: "form" }, ar, ru),
        h("div", { class: "sheet-actions" }, h("button", { class: "btn btn-accent", type: "button", onclick: () => {
          st.custom = { ar: ar.value.trim(), ru: ru.value.trim() };
          sheet.close();
          selectPreset("custom");
        } }, "Сохранить")),
      ],
    });
    setTimeout(() => ar.focus(), 350);
  }

  // Листание зикров свайпом по карточке (свой зикр — только если он задан)
  function shiftPreset(dir) {
    const list = PRESETS.filter((p) => p.id !== "custom" || st.custom.ar);
    const i = Math.max(0, list.findIndex((p) => p.id === st.preset));
    haptic("select");
    selectPreset(list[(i + dir + list.length) % list.length].id);
    dhikrText.classList.remove("slide-next", "slide-prev");
    void dhikrText.offsetWidth;
    dhikrText.classList.add(dir > 0 ? "slide-next" : "slide-prev");
  }

  let sx = null, sy = null, axis = null;
  dhikrCard.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    sx = e.clientX; sy = e.clientY; axis = null;
  });
  dhikrCard.addEventListener("pointermove", (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (axis === "x") {
      dhikrText.style.transition = "none";
      dhikrText.style.transform = `translateX(${dx * 0.6}px)`;
      dhikrText.style.opacity = String(1 - Math.min(0.6, Math.abs(dx) / 300));
    }
  });
  const endSwipe = (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    sx = null;
    dhikrText.style.transition = "";
    dhikrText.style.transform = "";
    dhikrText.style.opacity = "";
    if (axis === "x" && Math.abs(dx) > 50) shiftPreset(dx < 0 ? 1 : -1);
  };
  dhikrCard.addEventListener("pointerup", endSwipe);
  dhikrCard.addEventListener("pointercancel", () => { sx = null; dhikrText.style.cssText = ""; });

  targetBtn.addEventListener("click", () => { if (!stepInfo().multi) pickTarget(); });
  circle.addEventListener("click", count);
  zone.addEventListener("click", (e) => { if (e.target === zone) count(); });

  const onKey = (e) => {
    if (page.el.hidden || document.querySelector(".sheet-wrap")) return;
    if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); count(); }
  };
  document.addEventListener("keydown", onKey);

  renderChips();
  render();
  page.onShow = render;
  return page;
});
