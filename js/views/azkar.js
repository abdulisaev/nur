// Азкары: список разделов и экран раздела со счётчиком на каждой карточке.
import { h, toast, copyText, confirmSheet, plural, openSheet, group, row, toggle, segmented, slider, progressRing } from "../core/ui.js";
import { prayerTimes, todayIn, currentPlace } from "../core/prayer.js";
import { icon } from "../core/icons.js";
import { register, makePage, push, open } from "../core/nav.js";
import { settings, set, onChange, getProgress, setProgress } from "../core/store.js";
import { haptic } from "../core/tg.js";
import { sound } from "../core/sound.js";
import { AZKAR, BASMALA, findCategory } from "../data/azkar.js";
import { arNum, surah } from "../data/surahs.js";

export function catStats(cat) {
  const { counts } = getProgress(cat.id);
  let done = 0;
  for (const it of cat.items) if (isDone(it, counts[it.id] || 0)) done++;
  return { done, total: cat.items.length };
}

const isDone = (item, count) => (item.n === 0 ? count > 0 : count >= item.n);

export function arabicBlock(item) {
  if (!item.quran) return h("div", { class: "ar", lang: "ar", dir: "rtl" }, item.ar);
  return h("div", { class: "ar ar-quran", lang: "ar", dir: "rtl" },
    item.pre ? h("div", { class: "ar-pre" }, item.pre) : null,
    item.quran.map((seg) => [
      seg.basmala ? h("div", { class: "ar-basmala" }, BASMALA) : null,
      h("p", null, seg.ayat.map((t, i) => [t, " ", h("span", { class: "ayah-num" }, arNum(seg.start + i)), " "])),
    ]),
  );
}

const plainArabic = (item) =>
  item.quran ? [item.pre, ...item.quran.flatMap((s) => [s.basmala ? BASMALA : null, s.ayat.join(" ")])].filter(Boolean).join("\n") : item.ar;

// ── Список разделов ──────────────────────────────────────────
register("azkar", () => {
  const page = makePage({ title: "Азкары", subtitle: "Достоверные зикры из Корана и Сунны" });
  const featured = h("div", { class: "duo-grid" });
  const grid = h("div", { class: "cat-grid" });
  page.content.append(featured, h("h4", { class: "section-title" }, "Другие азкары"), grid);

  // Утренние и вечерние — главные, крупно сверху; «Сейчас» — по времени намаза
  function renderFeatured() {
    const now = new Date();
    const t = prayerTimes(todayIn(currentPlace().tz, now));
    const nowId = now >= t.fajr && now < t.dhuhr ? "morning" : now >= t.asr && now < t.isha ? "evening" : null;
    featured.replaceChildren(...["morning", "evening"].map((id) => {
      const cat = findCategory(id);
      const st = catStats(cat);
      const complete = st.done === st.total;
      const ring = progressRing(46, 4);
      ring.set(st.total ? st.done / st.total : 0);
      return h("button", { class: `duo card${id === nowId ? " now" : ""}`, type: "button", style: `--tint:${cat.tint}`, onclick: () => { haptic("light"); push("azkar-cat", { id }); } },
        h("div", { class: "hero-glow" }),
        h("div", { class: "duo-top" },
          h("span", { class: "tile", style: `--tile:${cat.tint}` }, icon(cat.icon, 18)),
          id === nowId ? h("span", { class: "now-badge" }, "Сейчас") : null),
        h("div", { class: "duo-title" }, cat.title),
        h("div", { class: "duo-bottom" },
          h("span", { class: "duo-sub" }, complete ? "Прочитано" : st.done ? `${st.done} из ${st.total}` : `${st.total} зикров`),
          h("span", { class: "duo-ring" }, ring, complete ? icon("check", 15) : null)),
      );
    }));
  }

  function render() {
    renderFeatured();
    grid.replaceChildren(...AZKAR.filter((cat) => cat.id !== "morning" && cat.id !== "evening").map((cat) => {
      const st = catStats(cat);
      const pct = st.total ? st.done / st.total : 0;
      return h("button", { class: `cat-card card${pct === 1 ? " complete" : ""}`, type: "button", onclick: () => { haptic("light"); push("azkar-cat", { id: cat.id }); } },
        h("span", { class: "tile big", style: `--tile:${cat.tint}` }, icon(cat.icon, 22)),
        h("div", { class: "cat-title" }, cat.title),
        h("div", { class: "cat-sub" }, `${cat.items.length} ${plural(cat.items.length, "зикр", "зикра", "зикров")}`),
        h("div", { class: "mini-bar" }, h("i", { style: `width:${pct * 100}%` })),
        pct === 1 ? h("span", { class: "cat-check" }, icon("check", 14)) : null,
      );
    }));
  }
  render();
  page.onShow = render;

  page.content.append(h("p", { class: "footnote" },
    "Тексты сверены с «Крепостью мусульманина» и первоисточниками. Включены только хадисы со степенью «сахих» или «хасан». Транскрипция приблизительная — по возможности учитесь читать арабский текст."));
  return page;
});

// ── Раздел со счётчиками ─────────────────────────────────────
register("azkar-cat", ({ id }) => {
  const cat = findCategory(id);
  let progress = getProgress(cat.id);
  const counts = progress.counts;

  const textBtn = h("button", { class: "icon-btn glass-btn", "aria-label": "Вид и текст" }, icon("type", 20));
  const resetBtn = h("button", { class: "icon-btn glass-btn", "aria-label": "Сбросить прогресс" }, icon("reset", 19));
  const page = makePage({ title: cat.title, subtitle: cat.hint, back: true, actions: [textBtn, resetBtn] });

  const progLabel = h("span", { class: "prog-label" });
  const progBar = h("div", { class: "prog-bar" }, h("i"));
  const progCard = h("div", { class: "cat-progress card" }, progBar, progLabel);
  // При прокрутке прогресс виден тонкой полоской под шапкой и не закрывает текст
  const navProgress = h("div", { class: "nav-progress" }, h("i"));
  page.bar.append(navProgress);
  const list = h("div", { class: "zikr-list" });
  const doneCard = h("div", { class: "done-card card" },
    h("div", { class: "done-icon" }, icon("check", 30)),
    h("h3", null, "Ма ша Аллах!"),
    h("p", null, "Все азкары раздела прочитаны. Пусть Аллах примет от вас."),
    h("button", { class: "btn btn-ghost", onclick: () => resetAll(false) }, icon("reset", 16), "Начать заново"),
  );
  page.content.append(progCard, list, doneCard);

  const cards = cat.items.map((item, i) => buildCard(item, i));
  list.append(...cards.map((c) => c.el));

  function buildCard(item, i) {
    const fill = h("span", { class: "counter-fill" });
    const label = h("span", { class: "counter-label" });
    const num = h("span", { class: "counter-num" });
    const counter = h("button", { class: "counter", type: "button", "aria-label": "Посчитать" }, fill, label, num);
    const undo = h("button", { class: "icon-btn sm", "aria-label": "Отменить одно нажатие", onclick: (e) => { e.stopPropagation(); change(-1); } }, icon("undo", 17));
    const el = h("article", { class: "zikr card", dataset: { id: item.id } },
      h("div", { class: "zikr-top" },
        h("span", { class: "zikr-index" }, i + 1),
        h("span", { class: "zikr-title" }, item.title || ""),
        h("span", { class: "zikr-times" }, item.n ? `${item.n} ${plural(item.n, "раз", "раза", "раз")}` : "без счёта"),
      ),
      item.note ? h("div", { class: "zikr-note" }, icon("info", 15), h("span", null, item.note)) : null,
      arabicBlock(item),
      h("div", { class: "translit" }, item.tr),
      h("div", { class: "translation" }, item.ru),
      item.fadl ? h("div", { class: "fadl" }, icon("star", 15), h("span", null, item.fadl)) : null,
      item.open ? h("div", { class: "zikr-links" }, item.open.map((n) => h("button", { class: "chip", onclick: (e) => { e.stopPropagation(); open("quran", "surah", { n }); } }, icon("book", 15), `Сура ${surah(n).name}`))) : null,
      h("div", { class: "zikr-meta" },
        h("span", { class: "source" }, h("b", null, item.grade), " · ", item.src),
        h("span", { class: "zikr-actions" },
          undo,
          h("button", { class: "icon-btn sm", "aria-label": "Копировать", onclick: (e) => { e.stopPropagation(); copyText([plainArabic(item), item.tr, item.ru, `— ${item.src}`].join("\n\n")); } }, icon("copy", 17)),
        ),
      ),
      counter,
    );

    function render(animate) {
      const c = counts[item.id] || 0;
      const done = isDone(item, c);
      el.classList.toggle("done", done && item.n !== 0);
      undo.disabled = c === 0;
      if (item.n === 0) {
        fill.style.transform = "scaleX(0)";
        label.textContent = c ? "Продолжайте" : "Нажмите, чтобы считать";
        num.textContent = c;
      } else {
        fill.style.transform = `scaleX(${Math.min(1, c / item.n)})`;
        label.replaceChildren(done ? h("span", { class: "counter-done" }, icon("check", 16), "Готово") : c ? "Ещё" : "Нажмите, чтобы считать");
        num.textContent = `${c} / ${item.n}`;
      }
      if (animate) {
        counter.classList.remove("bump");
        void counter.offsetWidth;
        counter.classList.add("bump");
      }
    }

    function change(delta) {
      const c = counts[item.id] || 0;
      if (delta > 0 && item.n !== 0 && c >= item.n) {
        haptic("warning");
        return;
      }
      const nc = Math.max(0, c + delta);
      if (nc === c) return;
      counts[item.id] = nc;
      progress.counts = counts;
      setProgress(cat.id, progress);
      render(delta > 0);
      updateProgress();
      if (delta < 0) { haptic("select"); return; }
      const finished = item.n !== 0 && nc === item.n;
      if (finished) {
        if (settings.hapticDone) haptic("success");
        if (settings.sound) sound.done();
        if (settings.autoNext) setTimeout(() => goToNext(i), 380);
      } else {
        if (settings.hapticTap) haptic("light");
        if (settings.sound) sound.tick();
      }
    }

    counter.addEventListener("click", (e) => { e.stopPropagation(); change(1); });
    el.addEventListener("click", (e) => {
      if (!settings.tapCard) return;
      if (e.target.closest("button, a")) return;
      if (String(window.getSelection?.() || "").length) return;
      change(1);
    });
    render(false);
    return { el, render };
  }

  function firstUndone(from = -1) {
    for (let j = from + 1; j < cat.items.length; j++) if (!isDone(cat.items[j], counts[cat.items[j].id] || 0)) return j;
    for (let j = 0; j <= from; j++) if (!isDone(cat.items[j], counts[cat.items[j].id] || 0)) return j;
    return -1;
  }

  function scrollToCard(j, smooth = true) {
    const el = cards[j]?.el;
    if (!el) return;
    if (settings.azkarView === "cards") {
      list.scrollTo({ left: el.offsetLeft - list.offsetLeft - 16, behavior: smooth ? "smooth" : "auto" });
    } else {
      const top = el.getBoundingClientRect().top - page.scroller.getBoundingClientRect().top + page.scroller.scrollTop - page.bar.offsetHeight - 12;
      page.scroller.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
    }
  }

  function goToNext(i) {
    const j = firstUndone(i);
    if (j === -1) {
      if (settings.hapticDone) haptic("success");
      toast("Все азкары прочитаны", "check");
      if (settings.azkarView === "list") doneCard.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    scrollToCard(j);
  }

  function updateProgress() {
    let done = 0;
    for (const it of cat.items) if (isDone(it, counts[it.id] || 0)) done++;
    const total = cat.items.length;
    progBar.firstChild.style.transform = `scaleX(${done / total})`;
    navProgress.firstChild.style.transform = `scaleX(${done / total})`;
    progLabel.textContent = `${done} из ${total}`;
    doneCard.classList.toggle("show", done === total);
  }

  async function resetAll(ask = true) {
    if (ask && !(await confirmSheet({ title: "Сбросить прогресс?", text: "Счётчики этого раздела обнулятся.", okText: "Сбросить", danger: true }))) return;
    for (const k of Object.keys(counts)) delete counts[k];
    setProgress(cat.id, progress);
    cards.forEach((c) => c.render(false));
    updateProgress();
    haptic("medium");
    scrollToCard(0, true);
    if (settings.azkarView === "list") page.scroller.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyView() {
    const cardsMode = settings.azkarView === "cards";
    list.classList.toggle("carousel", cardsMode);
    page.el.classList.toggle("carousel-mode", cardsMode);
  }

  // Быстрые настройки прямо в разделе: что показывать, размеры, вид
  function openTextSheet() {
    haptic("light");
    openSheet({
      title: "Вид и текст",
      content: [
        group("Показывать",
          row({ label: "Транскрипцию", right: toggle(settings.showTranslit, (v) => set("showTranslit", v)) }),
          row({ label: "Перевод", right: toggle(settings.showTranslation, (v) => set("showTranslation", v)) }),
          row({ label: "Источник и достоверность", right: toggle(settings.showSource, (v) => set("showSource", v)) }),
          row({ label: "Достоинство зикра", right: toggle(settings.showFadl, (v) => set("showFadl", v)) }),
        ),
        group("Вид", h("div", { class: "row" }, segmented([["list", "Списком"], ["cards", "Карточками"]], settings.azkarView, (v) => {
          set("azkarView", v);
          applyView();
          const j = firstUndone();
          setTimeout(() => scrollToCard(j === -1 ? 0 : j, false), 30);
        }, "wide"))),
        group("Размер арабского текста", h("div", { class: "row" }, slider({ min: 20, max: 56, value: settings.arSize, onInput: (v) => set("arSize", v) }))),
        group("Размер транскрипции", h("div", { class: "row" }, slider({ min: 12, max: 24, value: settings.tlSize, onInput: (v) => set("tlSize", v) }))),
        group("Размер перевода", h("div", { class: "row" }, slider({ min: 12, max: 26, value: settings.trSize, onInput: (v) => set("trSize", v) }))),
      ],
    });
  }

  textBtn.addEventListener("click", openTextSheet);
  resetBtn.addEventListener("click", () => resetAll(true));
  const unsubSettings = onChange((key) => { if (key === "azkarView" || key === "*") applyView(); });
  page.destroy = unsubSettings;

  applyView();
  updateProgress();

  // Если прогресс уже есть — продолжаем с первой непрочитанной карточки
  const start = firstUndone();
  if (start > 0) setTimeout(() => scrollToCard(start, false), 60);

  page.onShow = () => {
    const fresh = getProgress(cat.id);
    if (fresh.date !== progress.date) {
      progress = fresh;
      for (const k of Object.keys(counts)) delete counts[k];
      Object.assign(counts, fresh.counts);
      progress.counts = counts;
      cards.forEach((c) => c.render(false));
      updateProgress();
    }
  };
  return page;
});
