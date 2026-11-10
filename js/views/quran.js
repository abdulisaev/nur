// Коран: список сур, джузы, закладки, экран чтения с переводом и аудио.
import { h, openSheet, segmented, slider, row, group, radioGroup, copyText, toast, plural } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { register, makePage, push, replace } from "../core/nav.js";
import { settings, set, onChange, bookmarks, lastRead } from "../core/store.js";
import { haptic, shareText } from "../core/tg.js";
import { loadSurah, TRANSLATIONS } from "../core/data.js";
import { player, subscribe, playFrom, toggle as togglePlay } from "../core/audio.js";
import { SURAHS, surah, JUZ, juzOf, isSajda, arNum, pageOf, pageRanges } from "../data/surahs.js";
import { reciter, initials } from "../data/reciters.js";
import { openReciterSheet, playbackControls } from "./player-ui.js";
import { createMushaf } from "./mushaf.js";

const BASMALA_UTHMANI = "بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ";

const surahBadge = (n) => h("span", { class: "num-badge" }, h("span", null, n));

function surahRow(s, extra) {
  return h("button", { class: "row surah-row", type: "button", onclick: () => { haptic("light"); push("surah", { n: s.n }); } },
    surahBadge(s.n),
    h("div", { class: "row-main" },
      h("div", { class: "row-label" }, s.name),
      h("div", { class: "row-sub" }, extra || `${s.meaning} · ${s.ayahs} ${plural(s.ayahs, "аят", "аята", "аятов")}`)),
    h("div", { class: "row-right ar-name" }, s.ar),
  );
}

// ── Список ────────────────────────────────────────────────────
register("quran", () => {
  const page = makePage({ title: "Коран", subtitle: "114 сур · перевод · 20 чтецов" });
  const search = h("input", { class: "search-input", type: "search", placeholder: "Название, номер или 2:255", enterkeyhint: "go", autocomplete: "off" });
  const searchBox = h("label", { class: "search glass-soft" }, icon("search", 18), search);
  const continueSlot = h("div");
  const listBox = h("div", { class: "group card list-surahs" });
  let mode = "surahs";
  const seg = segmented([["surahs", "Суры"], ["juz", "Джузы"], ["bookmarks", "Закладки"]], mode, (v) => { mode = v; render(); });
  page.content.append(searchBox, continueSlot, h("div", { class: "seg-wrap" }, seg), listBox);

  function renderContinue() {
    const lr = lastRead.get();
    if (!lr) { continueSlot.replaceChildren(); return; }
    const s = surah(lr.s);
    continueSlot.replaceChildren(h("button", { class: "continue-card card", type: "button", onclick: () => push("surah", { n: lr.s, a: lr.a }) },
      h("span", { class: "tile big", style: "--tile:var(--accent)" }, icon("book", 22)),
      h("div", { class: "row-main" }, h("div", { class: "eyebrow" }, "Продолжить чтение"), h("div", { class: "row-label" }, `${s.name}, аят ${lr.a}`), h("div", { class: "row-sub" }, `Джуз ${juzOf(lr.s, lr.a)} · ${s.meaning}`)),
      h("div", { class: "ar-name" }, s.ar),
    ));
  }

  function render() {
    const q = search.value.trim().toLowerCase().replace(/ё/g, "е");
    const ref = /^(\d{1,3})\s*[:.\s]\s*(\d{1,3})$/.exec(q);
    if (ref) {
      const n = +ref[1], a = +ref[2];
      if (n >= 1 && n <= 114 && a >= 1 && a <= surah(n).ayahs) {
        listBox.replaceChildren(h("button", { class: "row", type: "button", onclick: () => push("surah", { n, a }) },
          surahBadge(n), h("div", { class: "row-main" }, h("div", { class: "row-label" }, `Перейти к ${surah(n).name}, аят ${a}`)), icon("chevron-right", 16, "chev")));
        return;
      }
    }
    if (q) {
      const norm = (s) => s.toLowerCase().replace(/ё/g, "е").replace(/['\-\s]/g, "");
      const qq = norm(q);
      const found = SURAHS.filter((s) => String(s.n) === q || norm(s.name).includes(qq) || norm(s.meaning).includes(qq) || s.ar.includes(q));
      listBox.replaceChildren(...(found.length ? found.map((s) => surahRow(s)) : [h("div", { class: "empty" }, "Ничего не найдено")]));
      return;
    }
    if (mode === "surahs") {
      listBox.replaceChildren(...SURAHS.map((s) => surahRow(s)));
    } else if (mode === "juz") {
      listBox.replaceChildren(...JUZ.map((j) => h("button", { class: "row surah-row", type: "button", onclick: () => push("surah", { n: j.s, a: j.a }) },
        surahBadge(j.n),
        h("div", { class: "row-main" }, h("div", { class: "row-label" }, `Джуз ${j.n}`), h("div", { class: "row-sub" }, `${surah(j.s).name}, аят ${j.a}`)),
        h("div", { class: "row-right ar-name" }, `الجزء ${arNum(j.n)}`),
      )));
    } else {
      const list = bookmarks.list();
      if (!list.length) {
        listBox.replaceChildren(h("div", { class: "empty" }, icon("bookmark", 28), h("p", null, "Закладок пока нет"), h("small", null, "Нажмите на аят во время чтения и выберите «В закладки»")));
        return;
      }
      listBox.replaceChildren(...list.map((b) => {
        const s = surah(b.s);
        return h("button", { class: "row surah-row", type: "button", onclick: () => push("surah", { n: b.s, a: b.a }) },
          h("span", { class: "tile", style: "--tile:var(--accent)" }, icon("bookmark-fill", 16)),
          h("div", { class: "row-main" }, h("div", { class: "row-label" }, `${s.name}, аят ${b.a}`), h("div", { class: "row-sub" }, new Date(b.t).toLocaleDateString("ru-RU", { day: "numeric", month: "long" }))),
          h("div", { class: "row-right ar-name" }, s.ar));
      }));
    }
  }

  search.addEventListener("input", render);
  search.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      search.blur();
      const first = listBox.querySelector("button.row");
      first?.click();
    }
  });
  renderContinue();
  render();
  page.onShow = () => { renderContinue(); if (mode === "bookmarks") render(); };
  return page;
});

// ── Чтение суры ───────────────────────────────────────────────
register("surah", ({ n, a: targetAyah }) => {
  const s = surah(n);
  const playBtn = h("button", { class: "icon-btn glass-btn", "aria-label": "Слушать" }, icon("play", 18));
  const textBtn = h("button", { class: "icon-btn glass-btn", "aria-label": "Настройки чтения" }, icon("type", 20));
  const page = makePage({ title: s.name, large: false, back: true, actions: [textBtn, playBtn], className: "reader" });
  const r = () => reciter(settings.reciter);

  const reciterChip = h("button", { class: "chip", type: "button", onclick: () => openReciterSheet() });
  const hero = h("div", { class: "surah-hero card" },
    h("div", { class: "hero-ornament" }, h("div", { class: "ar-title" }, `سُورَةُ ${s.ar}`)),
    h("h2", null, `${s.n}. ${s.name}`),
    h("p", null, `${s.meaning} · ${s.typeName} · ${s.ayahs} ${plural(s.ayahs, "аят", "аята", "аятов")}`),
    h("div", { class: "hero-actions" },
      h("button", { class: "btn btn-accent", type: "button", onclick: () => { haptic("medium"); playFrom(n, 1); } }, icon("play", 16), "Слушать суру"),
      reciterChip,
    ),
  );
  const body = h("div", { class: "ayahs" }, h("div", { class: "loader" }, h("i"), h("i"), h("i")));
  const navFooter = h("div", { class: "surah-nav" },
    n > 1 ? h("button", { class: "btn btn-ghost", type: "button", onclick: () => replaceWith(n - 1) }, icon("chevron-left", 16), surah(n - 1).name) : h("span"),
    n < 114 ? h("button", { class: "btn btn-ghost", type: "button", onclick: () => replaceWith(n + 1) }, surah(n + 1).name, icon("chevron-right", 16)) : h("span"),
  );
  const ayahView = h("div", null, hero, body, navFooter);
  page.content.append(ayahView);

  const isMushaf = () => settings.quranMode === "mushaf";
  let mushaf = null;
  let firstPage = true;

  function replaceWith(m) {
    haptic("light");
    replace("surah", { n: m });
  }

  function updateReciterChip() {
    reciterChip.replaceChildren(h("span", { class: "avatar xs" }, initials(r().name)), h("span", null, r().name), icon("chevron-down", 14));
  }
  updateReciterChip();

  let data = null;
  let ayahEls = [];

  async function load() {
    try {
      data = await loadSurah(n);
      renderAyahs();
      if (targetAyah) setTimeout(() => scrollToAyah(targetAyah, false, true), 30);
    } catch {
      body.replaceChildren(h("div", { class: "empty" }, icon("cloud", 30), h("p", null, "Не удалось загрузить суру"), h("small", null, "Проверьте интернет или скачайте Коран для офлайн-чтения в настройках"),
        h("button", { class: "btn btn-ghost", onclick: () => { body.replaceChildren(h("div", { class: "loader" }, h("i"), h("i"), h("i"))); load(); } }, icon("reset", 16), "Повторить")));
    }
  }

  const bookmarkDot = () => h("span", { class: "bm-dot" }, icon("bookmark-fill", 14));

  function renderAyahs() {
    const nodes = [];
    if (n !== 1 && n !== 9) nodes.push(h("div", { class: "basmala ar", lang: "ar", dir: "rtl" }, BASMALA_UTHMANI));
    ayahEls = data.ar.map((t, i) => {
      const a = i + 1;
      const tr = data.tr?.[i]?.replace(/ - /g, " — ");
      return h("article", { class: "ayah", dataset: { a } },
        h("div", { class: "ayah-head" },
          h("span", { class: "ayah-ref" }, `${n}:${a}`),
          isSajda(n, a) ? h("span", { class: "badge" }, "Саджда") : null,
          bookmarks.has(n, a) ? bookmarkDot() : null,
          h("button", { class: "icon-btn sm ayah-more", type: "button", "aria-label": "Действия" }, icon("more", 18)),
        ),
        h("div", { class: "ar", lang: "ar", dir: "rtl" }, t, " ", h("span", { class: "ayah-num" }, arNum(a))),
        tr ? h("div", { class: "translation" }, tr) : null,
      );
    });
    nodes.push(...ayahEls);
    if (data.tr === null && settings.translation !== "none") {
      nodes.unshift(h("div", { class: "notice" }, icon("cloud", 16), "Перевод недоступен офлайн"));
    }
    body.replaceChildren(...nodes);
    highlight(player);
  }

  // Переключение «аяты с переводом» ↔ «мусхаф по страницам»
  function applyMode() {
    const m = isMushaf();
    page.el.classList.toggle("mushaf-mode", m);
    ayahView.hidden = m;
    if (m) {
      if (!mushaf) {
        mushaf = createMushaf({
          page: pageOf(n, targetAyah || lastRead.get()?.s === n && lastRead.get().a || 1),
          onPage: (_, ranges) => {
            // В заголовке — сура, которая начинается на этой странице, иначе — первая на странице
            const starting = [...ranges].reverse().find((r) => r.from === 1);
            page.setTitle(surah((starting || ranges[0]).s).name);
            lastRead.set(ranges[0].s, ranges[0].from);
            page.scroller.scrollTo({ top: 0 });
            if (firstPage) {
              firstPage = false;
              const want = targetAyah || 1;
              const span = mushaf?.el.querySelector(`.m-ayah[data-s="${n}"][data-a="${want}"]`);
              let anchor = span;
              if (want === 1 && span) {
                let el = span.parentElement;
                while (el && !el.classList.contains("mushaf-surah")) el = el.previousElementSibling;
                anchor = el || span;
              }
              if (anchor && !(ranges[0].s === n && ranges[0].from === want)) {
                setTimeout(() => {
                  const sr = page.scroller.getBoundingClientRect();
                  page.scroller.scrollTo({ top: anchor.getBoundingClientRect().top - sr.top + page.scroller.scrollTop - 80 });
                }, 30);
              }
            }
            highlight(player);
          },
          onAyah: ayahSheet,
        });
        page.content.append(mushaf.el);
      }
      mushaf.el.hidden = false;
    } else {
      if (mushaf) mushaf.el.hidden = true;
      page.setTitle(s.name);
      if (data) renderAyahs();
      else load();
    }
  }

  body.addEventListener("click", (e) => {
    const el = e.target.closest("[data-a]");
    if (!el) return;
    if (String(window.getSelection?.() || "").length) return;
    haptic("light");
    ayahSheet(n, +el.dataset.a);
  });

  function ayahSheet(sn, a) {
    const sr = surah(sn);
    const marked = bookmarks.has(sn, a);
    const text = async () => {
      const d = await loadSurah(sn);
      const tr = d.tr?.[a - 1];
      return `${d.ar[a - 1]}\n\n${tr ? tr + "\n\n" : ""}— Коран, ${sr.name} ${sn}:${a}`;
    };
    const sheet = openSheet({
      title: `${sr.name}, аят ${a}`,
      content: group(null,
        row({ iconName: "play", color: "#34c759", label: "Слушать с этого аята", onClick: () => { sheet.close(); playFrom(sn, a); }, chevron: false }),
        row({ iconName: marked ? "bookmark-fill" : "bookmark", color: "#ff9f0a", label: marked ? "Убрать из закладок" : "В закладки", chevron: false, onClick: () => {
          const now = bookmarks.toggle(sn, a);
          toast(now ? "Добавлено в закладки" : "Удалено из закладок", now ? "bookmark-fill" : "bookmark");
          sheet.close();
          updateBookmark(sn, a, now);
        } }),
        row({ iconName: "copy", color: "#0a84ff", label: "Копировать", chevron: false, onClick: async () => { sheet.close(); copyText(await text()); } }),
        row({ iconName: "share", color: "#5e5ce6", label: "Поделиться", chevron: false, onClick: async () => { sheet.close(); const t = await text(); if (!shareText(t)) copyText(t); } }),
      ),
    });
  }

  // Меняем только значок у одного аята, без перерисовки всей суры
  function updateBookmark(sn, a, on) {
    if (sn !== n || !ayahEls[a - 1]) return;
    const head = ayahEls[a - 1].querySelector(".ayah-head");
    head.querySelector(".bm-dot")?.remove();
    if (on) head.insertBefore(bookmarkDot(), head.querySelector(".ayah-more"));
  }

  function scrollToAyah(a, smooth = true, flash = false) {
    const el = ayahEls[a - 1];
    if (!el) return;
    const sr = page.scroller.getBoundingClientRect();
    const top = el.getBoundingClientRect().top - sr.top + page.scroller.scrollTop - sr.height * 0.28;
    page.scroller.scrollTo({ top: Math.max(0, top), behavior: smooth ? "smooth" : "auto" });
    if (flash) {
      el.classList.add("flash");
      setTimeout(() => el.classList.remove("flash"), 1600);
    }
  }

  let lastHighlighted = null;
  function highlight(p) {
    const here = p.active && (isMushaf() || p.s === n);
    playBtn.replaceChildren(icon(here && p.playing ? "pause" : "play", 18));
    const follow = settings.autoScroll && (p.playing || p.loading) && !page.el.hidden;
    if (isMushaf()) {
      mushaf?.highlight(p.active && !p.basmala ? p.s : 0, p.a, follow);
      return;
    }
    const el = p.active && p.s === n && !p.basmala ? ayahEls[p.a - 1] : null;
    if (lastHighlighted && lastHighlighted !== el) lastHighlighted.classList.remove("playing");
    if (el) {
      el.classList.add("playing");
      if (el !== lastHighlighted && follow) scrollToAyah(p.a);
    }
    lastHighlighted = el;
  }

  playBtn.addEventListener("click", () => {
    haptic("light");
    if (player.active && (isMushaf() || player.s === n)) togglePlay();
    else if (isMushaf() && mushaf) {
      const [first] = pageRanges(mushaf.page());
      playFrom(first.s, first.from);
    } else playFrom(n, 1);
  });

  textBtn.addEventListener("click", () => openReadingSheet());

  function openReadingSheet() {
    openSheet({
      title: "Чтение",
      content: [
        group("Режим",
          h("div", { class: "row" }, segmented([["ayah", "Аяты с переводом"], ["mushaf", "Мусхаф по страницам"]], settings.quranMode, (v) => set("quranMode", v), "wide"))),
        group("Размер арабского текста", h("div", { class: "row" }, slider({ min: 20, max: 56, value: settings.arSize, onInput: (v) => set("arSize", v), format: (v) => `${v}` }))),
        group("Размер перевода", h("div", { class: "row" }, slider({ min: 12, max: 26, value: settings.trSize, onInput: (v) => set("trSize", v), format: (v) => `${v}` }))),
        radioGroup("Перевод", TRANSLATIONS.map((t) => ({ value: t.id, label: t.name, sub: t.note })), settings.translation, (v) => set("translation", v)),
        group("Аудио", row({ iconName: "headphones", color: "#ff375f", label: "Чтец", sub: r().name, onClick: () => openReciterSheet() })),
        ...playbackControls(),
      ],
    });
  }

  // Запоминаем последний прочитанный аят
  let saveTimer;
  page.scroller.addEventListener("scroll", () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (isMushaf() || !ayahEls.length) return;
      const top = page.scroller.getBoundingClientRect().top + 90;
      const el = ayahEls.find((x) => x.getBoundingClientRect().bottom > top);
      if (el) lastRead.set(n, +el.dataset.a);
    }, 500);
  }, { passive: true });
  if (!targetAyah && !isMushaf()) lastRead.set(n, lastRead.get()?.s === n ? lastRead.get().a : 1);

  const unsub = subscribe((p, kind) => { if (kind !== "time") highlight(p); });
  const unsettings = onChange((key) => {
    if (key === "reciter") updateReciterChip();
    if (key === "quranMode" || key === "*") applyMode();
    if (key === "translation" && data) loadSurah(n).then((d) => { data = d; if (!isMushaf()) renderAyahs(); });
  });
  page.destroy = () => { unsub(); unsettings(); clearTimeout(saveTimer); };
  applyMode();
  return page;
});
