// Мусхаф по страницам (604 страницы Мединского издания).
// Листание как в бумажном Коране — справа налево: свайп вправо открывает следующую страницу.
// Быстрый переход: ползунок по всем страницам и «Содержание» (сура, джуз, номер страницы).
import { h, openSheet, segmented } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { haptic } from "../core/tg.js";
import { getJSON, surahUrl } from "../core/data.js";
import { SURAHS, JUZ, surah, pageRanges, pageOf, PAGE_COUNT, juzOf, arNum } from "../data/surahs.js";

const BASMALA = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

// Подпись страницы: сура, которая на ней начинается, иначе — первая на странице
function pageInfo(p) {
  const ranges = pageRanges(p);
  const main = [...ranges].reverse().find((r) => r.from === 1) || ranges[0];
  return { ranges, name: surah(main.s).name, juz: juzOf(ranges[0].s, ranges[0].from) };
}

export function createMushaf({ page, onPage, onAyah }) {
  let current = page;
  let token = 0;
  let highlighted = null;

  const sheet = h("div", { class: "mushaf-page card ar", lang: "ar", dir: "rtl" });

  // ── Нижняя панель: кнопки, «Содержание» и ползунок ─────────
  const nextBtn = h("button", { class: "icon-btn mushaf-arrow", type: "button", "aria-label": "Следующая страница" }, icon("chevron-left", 22));
  const prevBtn = h("button", { class: "icon-btn mushaf-arrow", type: "button", "aria-label": "Предыдущая страница" }, icon("chevron-right", 22));
  const labelMain = h("span", { class: "ml-main" });
  const labelSub = h("span", { class: "ml-sub" });
  const label = h("button", { class: "mushaf-label", type: "button", "aria-label": "Содержание: перейти к суре, джузу или странице" }, h("span", { class: "ml-text" }, labelMain, labelSub), icon("list", 16));
  const range = h("input", { class: "slider rtl mushaf-range", type: "range", min: 1, max: PAGE_COUNT, step: 1, dir: "rtl", "aria-label": "Страница" });
  const bar = h("div", { class: "mushaf-bar glass" }, h("div", { class: "mushaf-row" }, nextBtn, label, prevBtn), range);
  const el = h("div", { class: "mushaf" }, sheet, bar);

  function setLabel(p, preview = false) {
    const info = pageInfo(p);
    labelMain.textContent = `Стр. ${p} · ${info.name}`;
    labelSub.textContent = preview ? "Отпустите, чтобы перейти" : `Джуз ${info.juz} · всего ${PAGE_COUNT}`;
    range.value = p;
    range.style.setProperty("--pct", `${((p - 1) / (PAGE_COUNT - 1)) * 100}%`);
  }

  async function render(p, dir = 0) {
    current = Math.min(PAGE_COUNT, Math.max(1, p));
    const my = ++token;
    const ranges = pageRanges(current);
    setLabel(current);
    nextBtn.disabled = current >= PAGE_COUNT;
    prevBtn.disabled = current <= 1;
    let texts;
    try {
      texts = await Promise.all(ranges.map((r) => getJSON(surahUrl("ar", r.s))));
    } catch {
      if (my !== token) return;
      sheet.replaceChildren(h("div", { class: "empty" }, icon("cloud", 28), h("small", null, "Страница недоступна без интернета. Скачайте Коран в настройках → «Офлайн-режим»")));
      return;
    }
    if (my !== token) return;

    const nodes = [];
    ranges.forEach((r, i) => {
      if (r.from === 1) {
        nodes.push(h("div", { class: "mushaf-surah" }, h("span", null, `سُورَةُ ${surah(r.s).ar}`)));
        if (r.s !== 1 && r.s !== 9) nodes.push(h("div", { class: "basmala" }, BASMALA));
      }
      const spans = [];
      for (let a = r.from; a <= r.to; a++) {
        spans.push(h("span", { class: "m-ayah", dataset: { s: r.s, a } }, texts[i][a - 1], " ", h("span", { class: "ayah-num" }, arNum(a)), " "));
      }
      nodes.push(h("p", { class: "mushaf-text" }, spans));
    });
    nodes.push(h("div", { class: "mushaf-foot" }, arNum(current)));
    sheet.replaceChildren(...nodes);
    highlighted = null;

    sheet.classList.remove("turn-next", "turn-prev");
    if (dir) {
      void sheet.offsetWidth;
      sheet.classList.add(dir > 0 ? "turn-next" : "turn-prev");
    }
    onPage?.(current, ranges);
    // Подгружаем соседние страницы заранее, чтобы листание было мгновенным
    for (const q of [current + 1, current + 2, current - 1]) {
      if (q >= 1 && q <= PAGE_COUNT) pageRanges(q).forEach((r) => getJSON(surahUrl("ar", r.s)).catch(() => {}));
    }
  }

  function go(delta) {
    const target = current + delta;
    if (target < 1 || target > PAGE_COUNT) return;
    haptic("light");
    render(target, delta);
  }

  function jump(p) {
    if (p === current) return;
    haptic("select");
    render(p, p > current ? 1 : -1);
  }

  nextBtn.addEventListener("click", () => go(1));
  prevBtn.addEventListener("click", () => go(-1));

  // Ползунок: пока тянете — показываем, куда попадёте; отпустили — переходим
  range.addEventListener("input", () => setLabel(+range.value, true));
  range.addEventListener("change", () => jump(+range.value));

  label.addEventListener("click", () => openContents());

  function openContents() {
    haptic("light");
    const list = h("div", { class: "group card" });
    const pageInput = h("input", { class: "text-input", type: "number", inputmode: "numeric", min: 1, max: PAGE_COUNT, placeholder: `Номер страницы, 1–${PAGE_COUNT}` });
    const goPage = () => {
      const p = Math.round(Number(pageInput.value));
      if (p >= 1 && p <= PAGE_COUNT) { sheetRef.close(); jump(p); }
      else pageInput.focus();
    };
    pageInput.addEventListener("keydown", (e) => { if (e.key === "Enter") goPage(); });
    const pageBox = h("div", { class: "input-row" }, pageInput, h("button", { class: "btn btn-accent", type: "button", onclick: goPage }, "Перейти"));

    const rowBtn = (badge, title, sub, right, p) => {
      const b = h("button", { class: `row surah-row${p === current ? " selected" : ""}`, type: "button" },
        h("span", { class: "num-badge" }, h("span", null, badge)),
        h("div", { class: "row-main" }, h("div", { class: "row-label" }, title), h("div", { class: "row-sub" }, sub)),
        h("div", { class: "row-right" }, right));
      b.addEventListener("click", () => { sheetRef.close(); jump(p); });
      return b;
    };

    function show(mode) {
      pageBox.hidden = mode !== "page";
      list.hidden = mode === "page";
      if (mode === "surahs") {
        list.replaceChildren(...SURAHS.map((s) => {
          const p = pageOf(s.n, 1);
          return rowBtn(s.n, s.name, `${s.meaning} · ${s.ayahs} аят.`, `стр. ${p}`, p);
        }));
        // Прокручиваем список к текущей суре
        const curS = pageInfo(current).ranges[0].s;
        setTimeout(() => list.children[curS - 1]?.scrollIntoView({ block: "center" }), 60);
      } else if (mode === "juz") {
        list.replaceChildren(...JUZ.map((j) => {
          const p = pageOf(j.s, j.a);
          return rowBtn(j.n, `Джуз ${j.n}`, `${surah(j.s).name}, аят ${j.a}`, `стр. ${p}`, p);
        }));
      } else {
        setTimeout(() => pageInput.focus(), 350);
      }
    }

    const sheetRef = openSheet({
      title: "Содержание",
      className: "tall",
      content: [
        h("div", { class: "seg-wrap" }, segmented([["surahs", "Суры"], ["juz", "Джузы"], ["page", "Страница"]], "surahs", show, "wide")),
        pageBox,
        list,
      ],
    });
    show("surahs");
  }

  // ── Свайп: страница следует за пальцем; хватает и короткого быстрого движения ──
  let sx = null, sy = null, st = 0, axis = null, moved = false;
  sheet.addEventListener("pointerdown", (e) => { sx = e.clientX; sy = e.clientY; st = performance.now(); axis = null; moved = false; });
  sheet.addEventListener("pointermove", (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!axis && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
    if (axis === "x") {
      moved = true;
      sheet.style.transition = "none";
      sheet.style.transform = `translateX(${dx}px)`;
      sheet.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / 600));
    }
  });
  const reset = () => { sheet.style.transition = ""; sheet.style.transform = ""; sheet.style.opacity = ""; };
  sheet.addEventListener("pointerup", (e) => {
    if (sx == null) return;
    const dx = e.clientX - sx;
    const speed = Math.abs(dx) / Math.max(1, performance.now() - st);
    sx = null;
    reset();
    if (axis === "x" && (Math.abs(dx) > 50 || (Math.abs(dx) > 20 && speed > 0.45))) go(dx > 0 ? 1 : -1);
  });
  sheet.addEventListener("pointercancel", () => { sx = null; reset(); });

  sheet.addEventListener("click", (e) => {
    if (moved) { moved = false; return; }
    const span = e.target.closest(".m-ayah");
    if (!span || String(window.getSelection?.() || "").length) return;
    haptic("light");
    onAyah?.(+span.dataset.s, +span.dataset.a);
  });

  render(current);

  return {
    el,
    page: () => current,
    go: (p) => render(p),
    openContents,
    // Подсветка аята при воспроизведении; follow — перелистнуть на страницу аята
    highlight(s, a, follow) {
      const span = s ? sheet.querySelector(`.m-ayah[data-s="${s}"][data-a="${a}"]`) : null;
      if (highlighted && highlighted !== span) highlighted.classList.remove("playing");
      if (span) span.classList.add("playing");
      highlighted = span;
      if (!span && s && follow) {
        const p = pageOf(s, a);
        if (p !== current) render(p, p > current ? 1 : -1).then(() => this.highlight(s, a, false));
      }
    },
  };
}
