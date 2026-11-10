// DOM-помощники и общие стеклянные компоненты: шторка, тост, переключатели.
import { icon } from "./icons.js";
import { haptic } from "./tg.js";
import { overlays } from "./nav.js";

export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k === "html") el.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const $ = (sel, root = document) => root.querySelector(sel);

// ── Тост ──────────────────────────────────────────────────────
let toastTimer;
export function toast(text, iconName = "check") {
  let el = $("#toast");
  if (!el) {
    el = h("div", { id: "toast", class: "toast glass", role: "status" });
    document.body.append(el);
  }
  el.replaceChildren(icon(iconName, 18), h("span", null, text));
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

// ── Нижняя шторка ─────────────────────────────────────────────
export function openSheet({ title, content, onClose, className = "" }) {
  const root = $("#overlay-root");
  const backdrop = h("div", { class: "backdrop" });
  const body = h("div", { class: "sheet-body" }, content);
  const closeBtn = h("button", { class: "icon-btn sheet-close", "aria-label": "Закрыть", onclick: () => close() }, icon("x", 18));
  const head = h("div", { class: "sheet-head" }, h("div", { class: "grabber" }), title ? h("h3", null, title) : null, closeBtn);
  const panel = h("div", { class: `sheet glass ${className}`.trim(), role: "dialog", "aria-modal": "true" }, head, body);
  const wrap = h("div", { class: "sheet-wrap" }, backdrop, panel);
  root.append(wrap);
  requestAnimationFrame(() => wrap.classList.add("open"));

  let closed = false;
  function close() {
    if (closed) return;
    closed = true;
    overlays.remove(close);
    wrap.classList.remove("open");
    panel.style.transform = "";
    setTimeout(() => wrap.remove(), 380);
    onClose && onClose();
  }
  overlays.add(close);
  backdrop.addEventListener("click", close);

  // Свайп вниз за шапку закрывает шторку
  let startY = null;
  let dy = 0;
  head.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button")) return;
    startY = e.clientY;
    dy = 0;
    panel.style.transition = "none";
    head.setPointerCapture(e.pointerId);
  });
  head.addEventListener("pointermove", (e) => {
    if (startY == null) return;
    dy = Math.max(0, e.clientY - startY);
    panel.style.transform = `translateY(${dy}px)`;
  });
  const end = () => {
    if (startY == null) return;
    startY = null;
    panel.style.transition = "";
    if (dy > 90) close();
    else panel.style.transform = "";
  };
  head.addEventListener("pointerup", end);
  head.addEventListener("pointercancel", end);

  return { close, panel, body };
}

export function confirmSheet({ title, text, okText = "Да", danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const sheet = openSheet({
      title,
      onClose: () => resolve(result),
      content: [
        text ? h("p", { class: "sheet-text" }, text) : null,
        h("div", { class: "sheet-actions" },
          h("button", { class: "btn btn-ghost", onclick: () => sheet.close() }, "Отмена"),
          h("button", { class: `btn ${danger ? "btn-danger" : "btn-accent"}`, onclick: () => { result = true; sheet.close(); } }, okText),
        ),
      ],
    });
  });
}

// ── Элементы управления ──────────────────────────────────────
export function toggle(checked, onToggle) {
  const input = h("input", { type: "checkbox", class: "switch", role: "switch" });
  input.checked = !!checked;
  input.addEventListener("change", () => {
    haptic("select");
    onToggle(input.checked);
  });
  return input;
}

export function segmented(options, value, onSelect, cls = "") {
  const wrap = h("div", { class: `segmented ${cls}`.trim(), role: "tablist" });
  const thumb = h("div", { class: "seg-thumb" });
  wrap.append(thumb);
  const buttons = options.map(([val, label]) => {
    const b = h("button", { class: "seg-btn", role: "tab", type: "button" }, label);
    b.addEventListener("click", () => {
      if (val === value) return;
      value = val;
      haptic("select");
      update();
      onSelect(val);
    });
    wrap.append(b);
    return [val, b];
  });
  function update() {
    const idx = Math.max(0, buttons.findIndex(([v]) => v === value));
    buttons.forEach(([, b], i) => b.classList.toggle("active", i === idx));
    wrap.style.setProperty("--seg-count", buttons.length);
    wrap.style.setProperty("--seg-index", idx);
  }
  update();
  wrap.setValue = (v) => { value = v; update(); };
  return wrap;
}

export function slider({ min, max, step = 1, value, onInput, format = (v) => v }) {
  const out = h("span", { class: "slider-val" }, format(value));
  const input = h("input", { type: "range", class: "slider", min, max, step, value });
  const paint = () => input.style.setProperty("--pct", `${((input.value - min) / (max - min)) * 100}%`);
  paint();
  input.addEventListener("input", () => {
    const v = Number(input.value);
    out.textContent = format(v);
    paint();
    onInput(v);
  });
  input.addEventListener("change", () => haptic("select"));
  return h("div", { class: "slider-row" }, input, out);
}

export function progressRing(size = 44, stroke = 3.5) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const wrap = h("span", { class: "ring", style: `width:${size}px;height:${size}px` });
  wrap.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none"/><circle class="ring-bar" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`;
  const bar = wrap.querySelector(".ring-bar");
  wrap.set = (p) => bar.setAttribute("stroke-dashoffset", String(c * (1 - Math.min(1, Math.max(0, p)))));
  return wrap;
}

// Цветная иконка-плитка как в настройках iOS
export const tile = (name, color) => h("span", { class: "tile", style: `--tile:${color}` }, icon(name, 17));

export function row({ iconName, color, label, sub, right, onClick, chevron = !!onClick }) {
  const el = h(onClick ? "button" : "div", { class: "row", type: onClick ? "button" : null },
    iconName ? tile(iconName, color) : null,
    h("div", { class: "row-main" }, h("div", { class: "row-label" }, label), sub ? h("div", { class: "row-sub" }, sub) : null),
    right != null ? h("div", { class: "row-right" }, right) : null,
    chevron ? icon("chevron-right", 16, "chev") : null,
  );
  if (onClick) el.addEventListener("click", onClick);
  return el;
}

export const group = (title, ...rows) =>
  h("section", { class: "group-wrap" }, title ? h("h4", { class: "group-title" }, title) : null, h("div", { class: "group card" }, rows));

// Список с одной галочкой (выбор шрифта, перевода и т.п.)
export function radioGroup(title, options, value, onSelect) {
  const rows = options.map((o) => {
    const el = h("button", { class: "row radio", type: "button" },
      o.lead || null,
      h("div", { class: "row-main" }, h("div", { class: "row-label", style: o.labelStyle || null }, o.label), o.sub ? h("div", { class: "row-sub" }, o.sub) : null),
      o.right || null,
      h("span", { class: "radio-check" }, icon("check", 18)),
    );
    el.addEventListener("click", () => {
      if (value === o.value) return;
      value = o.value;
      haptic("select");
      update();
      onSelect(o.value);
    });
    return [o.value, el];
  });
  const update = () => rows.forEach(([v, el]) => el.classList.toggle("checked", v === value));
  update();
  return group(title, rows.map(([, el]) => el));
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = h("textarea", { style: "position:fixed;opacity:0" });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand("copy"); } catch {}
    ta.remove();
  }
  toast("Скопировано", "copy");
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
