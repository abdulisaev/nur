// Мини-плеер над таб-баром и шторка с настройками воспроизведения.
import { h, openSheet, segmented, toggle, row, group } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { haptic } from "../core/tg.js";
import { settings, set } from "../core/store.js";
import { player, subscribe, toggle as togglePlay, next, prev, stop } from "../core/audio.js";
import { surah } from "../data/surahs.js";
import { RECITERS, reciter, initials } from "../data/reciters.js";
import { open } from "../core/nav.js";

export function mountMiniPlayer(slot) {
  const title = h("div", { class: "mp-title" });
  const sub = h("div", { class: "mp-sub" });
  const avatar = h("div", { class: "avatar" });
  const playBtn = h("button", { class: "icon-btn mp-play", "aria-label": "Пауза/воспроизведение" });
  const bar = h("div", { class: "mp-progress" }, h("i"));
  const el = h("div", { class: "mini-player glass" },
    bar,
    h("button", { class: "mp-info", type: "button", onclick: () => openPlayerSheet() }, avatar, h("div", { class: "mp-text" }, title, sub)),
    h("div", { class: "mp-controls" },
      h("button", { class: "icon-btn", "aria-label": "Предыдущий аят", onclick: () => { haptic("light"); prev(); } }, icon("prev", 20)),
      playBtn,
      h("button", { class: "icon-btn", "aria-label": "Следующий аят", onclick: () => { haptic("light"); next(); } }, icon("next", 20)),
      h("button", { class: "icon-btn mp-close", "aria-label": "Закрыть плеер", onclick: () => { haptic("light"); stop(); } }, icon("x", 18)),
    ),
  );
  playBtn.addEventListener("click", () => { haptic("light"); togglePlay(); });
  slot.append(el);

  subscribe((p, kind) => {
    if (kind === "time") {
      bar.firstChild.style.transform = `scaleX(${p.progress || 0})`;
      return;
    }
    document.body.classList.toggle("has-player", p.active);
    if (!p.active) return;
    const s = surah(p.s);
    const r = reciter(settings.reciter);
    title.textContent = `${s.name} · ${p.basmala ? "басмала" : `аят ${p.a}`}`;
    sub.textContent = r.name;
    avatar.textContent = initials(r.name);
    playBtn.replaceChildren(icon(p.playing ? "pause" : "play", 22));
    el.classList.toggle("loading", p.loading);
  });
}

export function openReciterSheet() {
  const list = h("div", { class: "group card reciter-list" });
  const sheet = openSheet({ title: "Чтец", content: list, className: "tall" });
  for (const r of RECITERS) {
    const item = h("button", { class: `row reciter${r.id === settings.reciter ? " selected" : ""}`, type: "button" },
      h("div", { class: "avatar" }, initials(r.name)),
      h("div", { class: "row-main" }, h("div", { class: "row-label" }, r.name), h("div", { class: "row-sub" }, r.info)),
      h("div", { class: "row-right ar-name" }, r.ar),
      r.id === settings.reciter ? icon("check", 18, "accent") : null,
    );
    item.addEventListener("click", () => {
      haptic("select");
      set("reciter", r.id);
      sheet.close();
    });
    list.append(item);
  }
}

export function playbackControls() {
  return [
    group("Скорость",
      h("div", { class: "row" }, segmented([[0.75, "0.75×"], [1, "1×"], [1.25, "1.25×"], [1.5, "1.5×"], [2, "2×"]], settings.speed, (v) => set("speed", v), "wide")),
    ),
    group("Повтор каждого аята",
      h("div", { class: "row" }, segmented([[1, "1"], [2, "2"], [3, "3"], [5, "5"], [10, "10"], [0, "∞"]], settings.repeatAyah, (v) => set("repeatAyah", v), "wide")),
    ),
    group(null,
      row({ iconName: "layers", color: "#34c759", label: "Переходить к следующей суре", right: toggle(settings.continueNext, (v) => set("continueNext", v)) }),
      row({ iconName: "target", color: "#ff9f0a", label: "Следить за аятом при чтении", right: toggle(settings.autoScroll, (v) => set("autoScroll", v)) }),
    ),
  ];
}

export function openPlayerSheet() {
  const r = reciter(settings.reciter);
  const s = player.active ? surah(player.s) : null;
  const sheet = openSheet({
    title: "Воспроизведение",
    content: [
      s ? h("div", { class: "player-hero" },
        h("div", { class: "ar-title" }, s.ar),
        h("div", { class: "player-hero-title" }, `${s.n}. ${s.name}`),
        h("div", { class: "player-hero-sub" }, player.basmala ? "Басмала" : `Аят ${player.a} из ${s.ayahs}`),
        h("button", { class: "btn btn-ghost small", onclick: () => { sheet.close(); open("quran", "surah", { n: player.s, a: player.a }); } }, icon("book", 16), "Открыть суру"),
      ) : null,
      group("Чтец", row({ label: r.name, sub: r.info, right: h("span", { class: "avatar sm" }, initials(r.name)), onClick: () => { sheet.close(); openReciterSheet(); } })),
      ...playbackControls(),
    ],
  });
}
