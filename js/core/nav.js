// Навигация в стиле iOS: у каждой вкладки свой стек страниц, шторки поверх.
// Кнопка «Назад» — нативная в Telegram (BackButton) и своя в браузере.
import { h } from "./ui.js";
import { icon } from "./icons.js";
import { inTG, backButton, haptic } from "./tg.js";

export const TABS = [
  { id: "home", label: "Намаз", icon: "mosque" },
  { id: "azkar", label: "Азкары", icon: "sparkles" },
  { id: "quran", label: "Коран", icon: "book" },
  { id: "tasbih", label: "Тасбих", icon: "beads" },
  { id: "settings", label: "Настройки", icon: "sliders" },
];

const routes = {};
const stacks = {};
const overlayList = [];
let current = null;
let pagesRoot = null;
let tabbar = null;
let historyDepth = 0;

export const register = (name, render) => { routes[name] = render; };
export const currentTab = () => current;

export const overlays = {
  add(fn) { overlayList.push(fn); syncBack(); },
  remove(fn) {
    const i = overlayList.indexOf(fn);
    if (i >= 0) overlayList.splice(i, 1);
    syncBack();
  },
};

function syncBack() {
  backButton.set(overlayList.length > 0 || (stacks[current]?.length || 0) > 1);
  setBarsHidden(false);
}

const setBarsHidden = (hidden) => document.body.classList.toggle("bars-hidden", hidden);

// Свайп от левого края экрана — «Назад», как в iOS
function initEdgeSwipe() {
  let start = null;
  document.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    start = e.touches.length === 1 && t.clientX < 24 && (stacks[current]?.length || 0) > 1 ? { x: t.clientX, y: t.clientY } : null;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x, dy = Math.abs(t.clientY - start.y);
    start = null;
    if (dx > 70 && dy < 60 && !overlayList.length) {
      haptic("light");
      back();
    }
  }, { passive: true });
}

export function initNav(root, bar) {
  pagesRoot = root;
  tabbar = bar;
  bar.append(h("div", { class: "tab-indicator" }));
  for (const [i, t] of TABS.entries()) {
    const btn = h("button", { class: "tab", type: "button", dataset: { tab: t.id }, "aria-label": t.label }, icon(t.icon, 24), h("span", null, t.label));
    btn.addEventListener("click", () => {
      haptic("select");
      switchTab(t.id);
    });
    btn.style.setProperty("--i", i);
    bar.append(btn);
  }
  bar.style.setProperty("--tabs", TABS.length);
  backButton.bind(() => back());
  initEdgeSwipe();
  if (history.state?.nur) history.replaceState(null, "");
  window.addEventListener("popstate", () => {
    if (historyDepth === 0) return;
    historyDepth--;
    if (overlayList.length) overlayList[overlayList.length - 1]();
    else pop();
  });
}

export function makePage({ title = "", subtitle = "", large = true, actions = [], back: hasBack = false, className = "" } = {}) {
  const navTitle = h("div", { class: "nav-title" }, title);
  const left = h("div", { class: "nav-side" },
    hasBack && !inTG ? h("button", { class: "nav-back", type: "button", onclick: () => back() }, icon("chevron-left", 22), h("span", null, "Назад")) : null);
  const right = h("div", { class: "nav-side nav-right" }, actions);
  const bar = h("header", { class: `navbar${large ? "" : " compact"}` }, left, navTitle, right);
  const head = large ? h("div", { class: "large-head" }, h("h1", { class: "large-title" }, title), subtitle ? h("p", { class: "large-sub" }, subtitle) : null) : null;
  const content = h("div", { class: "content" });
  const scroller = h("div", { class: "scroller" }, head, content, h("div", { class: "scroll-end" }));
  const el = h("section", { class: `page ${className}`.trim() }, bar, scroller);
  let lastY = 0;
  scroller.addEventListener("scroll", () => {
    const y = scroller.scrollTop;
    bar.classList.toggle("scrolled", y > (large ? 44 : 4));
    // Панель вкладок уезжает при прокрутке вниз и возвращается при прокрутке вверх
    if (Math.abs(y - lastY) > 8) {
      setBarsHidden(y > lastY && y > 140);
      lastY = y;
    }
  }, { passive: true });
  return {
    el, bar, scroller, content, head,
    setTitle(t) {
      navTitle.textContent = t;
      if (head) head.querySelector(".large-title").textContent = t;
    },
  };
}

function mount(name, params) {
  const page = routes[name](params || {});
  page.route = { name, params };
  page.el.dataset.tab = current;
  pagesRoot.append(page.el);
  return page;
}

export function switchTab(id, { reset = false } = {}) {
  if (id === current) {
    const stack = stacks[id];
    if (stack.length > 1) {
      while (stack.length > 1) {
        const p = stack.pop();
        p.destroy?.();
        p.el.remove();
      }
      stack[0].el.classList.remove("covered");
      stack[0].onShow?.();
      syncBack();
    } else {
      stack[0].scroller?.scrollTo({ top: 0, behavior: "smooth" });
    }
    return;
  }
  if (current) for (const p of stacks[current]) { p.el.hidden = true; p.onHide?.(); }
  current = id;
  if (!stacks[id] || reset) {
    stacks[id]?.forEach((p) => { p.destroy?.(); p.el.remove(); });
    stacks[id] = [mount(id)];
  }
  for (const p of stacks[id]) p.el.hidden = false;
  const top = stacks[id][stacks[id].length - 1];
  top.el.classList.remove("tab-enter");
  void top.el.offsetWidth;
  top.el.classList.add("tab-enter");
  top.onShow?.();
  const i = TABS.findIndex((t) => t.id === id);
  tabbar.style.setProperty("--active", i);
  tabbar.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === id));
  syncBack();
}

export function push(name, params) {
  const stack = stacks[current];
  const prev = stack[stack.length - 1];
  const page = mount(name, params);
  page.el.classList.add("pushing");
  void page.el.offsetWidth;
  page.el.classList.remove("pushing");
  prev?.el.classList.add("covered");
  prev?.onHide?.();
  stack.push(page);
  if (!inTG) {
    history.pushState({ nur: stack.length }, "");
    historyDepth++;
  }
  syncBack();
  return page;
}

// Заменить верхнюю страницу (например, «следующая сура») без роста стека
export function replace(name, params) {
  const stack = stacks[current];
  if (stack.length < 2) return push(name, params);
  const old = stack.pop();
  const page = mount(name, params);
  page.el.classList.add("pushing");
  void page.el.offsetWidth;
  page.el.classList.remove("pushing");
  old.el.classList.add("covered");
  stack.push(page);
  setTimeout(() => { old.destroy?.(); old.el.remove(); }, 500);
  syncBack();
  return page;
}

function pop() {
  const stack = stacks[current];
  if (!stack || stack.length < 2) return false;
  const page = stack.pop();
  const prev = stack[stack.length - 1];
  prev.el.classList.remove("covered");
  page.el.classList.add("popping");
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    page.destroy?.();
    page.el.remove();
  };
  page.el.addEventListener("transitionend", finish, { once: true });
  setTimeout(finish, 600);
  prev.onShow?.();
  syncBack();
  return true;
}

export function back() {
  if (overlayList.length) {
    overlayList[overlayList.length - 1]();
    return true;
  }
  if ((stacks[current]?.length || 0) < 2) return false;
  if (!inTG && historyDepth > 0) history.back();
  else pop();
  return true;
}

// Открыть страницу в нужной вкладке (с главной, из диплинка и т.п.)
export function open(tab, name, params) {
  if (current !== tab) switchTab(tab);
  const stack = stacks[tab];
  while (stack.length > 1) {
    const p = stack.pop();
    p.destroy?.();
    p.el.remove();
  }
  stack[0].el.classList.remove("covered");
  if (name) push(name, params);
  else syncBack();
}
