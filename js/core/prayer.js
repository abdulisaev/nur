// Время намаза: астрономический расчёт прямо на устройстве (работает офлайн, в любом городе).
// Формулы положения Солнца — стандартные (как в PrayTimes / Aladhan); летнее время
// учитывается автоматически через часовой пояс города (Intl).
import { settings } from "./store.js";

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const sin = (d) => Math.sin(rad(d));
const cos = (d) => Math.cos(rad(d));
const tan = (d) => Math.tan(rad(d));
const asin = (x) => deg(Math.asin(x));
const acos = (x) => deg(Math.acos(x));
const atan2 = (y, x) => deg(Math.atan2(y, x));
const acot = (x) => deg(Math.atan(1 / x));
const fix = (a, b) => { a -= b * Math.floor(a / b); return a < 0 ? a + b : a; };

export const PRAYERS = [
  { id: "fajr", name: "Фаджр", ar: "الفجر", icon: "sunrise" },
  { id: "sunrise", name: "Восход", ar: "الشروق", icon: "sun", optional: true },
  { id: "dhuhr", name: "Зухр", ar: "الظهر", icon: "sun" },
  { id: "asr", name: "Аср", ar: "العصر", icon: "sunset" },
  { id: "maghrib", name: "Магриб", ar: "المغرب", icon: "sunset" },
  { id: "isha", name: "Иша", ar: "العشاء", icon: "moon" },
];

// Способы расчёта. fajr/isha — угол Солнца под горизонтом; ishaMin — Иша через N минут после Магриба;
// offsets — поправки метода в минутах (ихтият).
export const METHODS = [
  // Параметры подобраны по официальному расписанию Муфтията РД для Махачкалы (октябрь 2026):
  // совпадение до минуты по всем шести временам за 22 дня
  { id: "dumd", name: "Муфтият РД (Дагестан)", note: "По официальному расписанию Муфтията Республики Дагестан", fajr: 17.4, isha: 15.05, offsets: { fajr: -0.15, sunrise: -2.65, dhuhr: 4.55, asr: 2.35, maghrib: 4.75, isha: 0.05 } },
  { id: "dumrf", name: "ДУМ России", note: "Фаджр 16°, Иша 15°", fajr: 16, isha: 15 },
  { id: "mwl", name: "Всемирная исламская лига", note: "Фаджр 18°, Иша 17°", fajr: 18, isha: 17 },
  { id: "umm", name: "Умм аль-Кура (Мекка)", note: "Фаджр 18,5°, Иша через 90 мин после Магриба", fajr: 18.5, ishaMin: 90 },
  { id: "turkey", name: "Диянет (Турция)", note: "Фаджр 18°, Иша 17° и поправки Диянета", fajr: 18, isha: 17, offsets: { sunrise: -7, dhuhr: 5, asr: 4, maghrib: 7 } },
  { id: "egypt", name: "Египет", note: "Фаджр 19,5°, Иша 17,5°", fajr: 19.5, isha: 17.5 },
  { id: "karachi", name: "Карачи", note: "Фаджр 18°, Иша 18°", fajr: 18, isha: 18 },
  { id: "isna", name: "ISNA (Северная Америка)", note: "Фаджр 15°, Иша 15°", fajr: 15, isha: 15 },
];

export const ASR_SCHOOLS = [
  { id: "standard", name: "Стандартный", note: "Шафиитский, маликитский, ханбалитский мазхабы — тень равна предмету", factor: 1 },
  { id: "hanafi", name: "Ханафитский", note: "Тень вдвое длиннее предмета — Аср наступает позже", factor: 2 },
];

// Города: [id, название, широта, долгота, часовой пояс, регион]
const CITY_ROWS = [
  ["makhachkala", "Махачкала", 42.9849, 47.5047, "Europe/Moscow", "Дагестан"],
  ["kaspiysk", "Каспийск", 42.8816, 47.6389, "Europe/Moscow", "Дагестан"],
  ["derbent", "Дербент", 42.0678, 48.2899, "Europe/Moscow", "Дагестан"],
  ["khasavyurt", "Хасавюрт", 43.2509, 46.5876, "Europe/Moscow", "Дагестан"],
  ["buynaksk", "Буйнакск", 42.8199, 47.1166, "Europe/Moscow", "Дагестан"],
  ["izberbash", "Избербаш", 42.5650, 47.8710, "Europe/Moscow", "Дагестан"],
  ["kizilyurt", "Кизилюрт", 43.2050, 46.8705, "Europe/Moscow", "Дагестан"],
  ["kizlyar", "Кизляр", 43.8467, 46.7130, "Europe/Moscow", "Дагестан"],
  ["dagogni", "Дагестанские Огни", 42.1167, 48.1936, "Europe/Moscow", "Дагестан"],
  ["sukhokumsk", "Южно-Сухокумск", 44.6600, 45.6492, "Europe/Moscow", "Дагестан"],
  ["akhty", "Ахты", 41.4647, 47.7397, "Europe/Moscow", "Дагестан"],
  ["gunib", "Гуниб", 42.3880, 46.9640, "Europe/Moscow", "Дагестан"],
  ["grozny", "Грозный", 43.3178, 45.6983, "Europe/Moscow", "Чечня"],
  ["nazran", "Назрань", 43.2257, 44.7645, "Europe/Moscow", "Ингушетия"],
  ["nalchik", "Нальчик", 43.4853, 43.6071, "Europe/Moscow", "Кабардино-Балкария"],
  ["cherkessk", "Черкесск", 44.2269, 42.0578, "Europe/Moscow", "Карачаево-Черкесия"],
  ["vladikavkaz", "Владикавказ", 43.0367, 44.6678, "Europe/Moscow", "Северная Осетия"],
  ["stavropol", "Ставрополь", 45.0428, 41.9734, "Europe/Moscow", "Ставропольский край"],
  ["astrakhan", "Астрахань", 46.3497, 48.0408, "Europe/Astrakhan", "Астраханская область"],
  ["moscow", "Москва", 55.7558, 37.6173, "Europe/Moscow", "Россия"],
  ["spb", "Санкт-Петербург", 59.9343, 30.3351, "Europe/Moscow", "Россия"],
  ["kazan", "Казань", 55.7963, 49.1088, "Europe/Moscow", "Татарстан"],
  ["ufa", "Уфа", 54.7388, 55.9721, "Asia/Yekaterinburg", "Башкортостан"],
  ["krasnodar", "Краснодар", 45.0355, 38.9753, "Europe/Moscow", "Россия"],
  ["rostov", "Ростов-на-Дону", 47.2357, 39.7015, "Europe/Moscow", "Россия"],
  ["samara", "Самара", 53.1959, 50.1002, "Europe/Samara", "Россия"],
  ["yekaterinburg", "Екатеринбург", 56.8389, 60.6057, "Asia/Yekaterinburg", "Россия"],
  ["surgut", "Сургут", 61.2540, 73.3962, "Asia/Yekaterinburg", "Россия"],
  ["novosibirsk", "Новосибирск", 55.0084, 82.9357, "Asia/Novosibirsk", "Россия"],
  ["baku", "Баку", 40.4093, 49.8671, "Asia/Baku", "Азербайджан"],
  ["istanbul", "Стамбул", 41.0082, 28.9784, "Europe/Istanbul", "Турция"],
  ["tashkent", "Ташкент", 41.2995, 69.2401, "Asia/Tashkent", "Узбекистан"],
  ["almaty", "Алматы", 43.2220, 76.8512, "Asia/Almaty", "Казахстан"],
  ["bishkek", "Бишкек", 42.8746, 74.5698, "Asia/Bishkek", "Кыргызстан"],
  ["dushanbe", "Душанбе", 38.5598, 68.7870, "Asia/Dushanbe", "Таджикистан"],
  ["mecca", "Мекка", 21.4225, 39.8262, "Asia/Riyadh", "Саудовская Аравия"],
  ["medina", "Медина", 24.4672, 39.6024, "Asia/Riyadh", "Саудовская Аравия"],
];
export const CITIES = CITY_ROWS.map(([id, name, lat, lon, tz, region]) => ({ id, name, lat, lon, tz, region }));

const distanceKm = (a, b) => {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(x));
};

export function nearestCity(lat, lon) {
  let best = null;
  for (const c of CITIES) {
    const d = distanceKm({ lat, lon }, c);
    if (!best || d < best.d) best = { city: c, d };
  }
  return best;
}

// Текущее местоположение из настроек: город из списка или координаты устройства
export function currentPlace() {
  if (settings.prayerCity === "geo" && settings.prayerGeo) {
    const g = settings.prayerGeo;
    const near = nearestCity(g.lat, g.lon);
    const name = near && near.d < 25 ? near.city.name : "Моё местоположение";
    return { id: "geo", name, lat: g.lat, lon: g.lon, tz: g.tz || Intl.DateTimeFormat().resolvedOptions().timeZone, region: "по геолокации" };
  }
  return CITIES.find((c) => c.id === settings.prayerCity) || CITIES[0];
}

export const currentMethod = () => METHODS.find((m) => m.id === settings.prayerMethod) || METHODS[0];
export const currentSchool = () => ASR_SCHOOLS.find((s) => s.id === settings.asrSchool) || ASR_SCHOOLS[0];

// ── Астрономия ────────────────────────────────────────────────
function julian(y, m, d) {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd) {
  const D = jd - 2451545.0;
  const g = fix(357.529 + 0.98560028 * D, 360);
  const q = fix(280.459 + 0.98564736 * D, 360);
  const L = fix(q + 1.915 * sin(g) + 0.020 * sin(2 * g), 360);
  const e = 23.439 - 0.00000036 * D;
  const RA = atan2(cos(e) * sin(L), cos(L)) / 15;
  const eqt = q / 15 - fix(RA, 24);
  const decl = asin(sin(e) * sin(L));
  return { decl, eqt };
}

// Все времена — в часах всемирного времени (UTC) для заданной даты
function computeUtcHours(y, m, d, lat, lon, method, asrFactor) {
  const jd = julian(y, m, d) - lon / (15 * 24);
  const midDay = (t) => fix(12 - sunPosition(jd + t).eqt, 24);
  const angleTime = (angle, t, before) => {
    const { decl } = sunPosition(jd + t);
    const noon = midDay(t);
    const T = acos((-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat))) / 15;
    return noon + (before ? -T : T);
  };
  const asrTime = (factor, t) => {
    const { decl } = sunPosition(jd + t);
    return angleTime(-acot(factor + tan(Math.abs(lat - decl))), t);
  };

  // Начальное приближение и два уточнения
  let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
  for (let i = 0; i < 2; i++) {
    const p = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v / 24]));
    t = {
      fajr: angleTime(method.fajr, p.fajr, true),
      sunrise: angleTime(0.833, p.sunrise, true),
      dhuhr: midDay(p.dhuhr),
      asr: asrTime(asrFactor, p.asr),
      sunset: angleTime(0.833, p.sunset),
      isha: method.ishaMin ? t.sunset + method.ishaMin / 60 : angleTime(method.isha, p.isha),
    };
  }
  if (method.ishaMin) t.isha = t.sunset + method.ishaMin / 60;

  // Высокие широты: если сумерки не наступают или слишком длинные — правило «доли ночи по углу»
  const night = 24 - (t.sunset - t.sunrise);
  const fajrMax = (method.fajr / 60) * night;
  if (!Number.isFinite(t.fajr) || t.sunrise - t.fajr > fajrMax) t.fajr = t.sunrise - fajrMax;
  if (!method.ishaMin) {
    const ishaMax = (method.isha / 60) * night;
    if (!Number.isFinite(t.isha) || t.isha - t.sunset > ishaMax) t.isha = t.sunset + ishaMax;
  }

  const shift = lon / 15;
  return {
    fajr: t.fajr - shift,
    sunrise: t.sunrise - shift,
    dhuhr: t.dhuhr - shift,
    asr: t.asr - shift,
    maghrib: t.sunset - shift,
    isha: t.isha - shift,
  };
}

// Календарная дата «сейчас» в часовом поясе города
export function todayIn(tz, base = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(base);
  const get = (type) => +parts.find((p) => p.type === type).value;
  return { y: get("year"), m: get("month"), d: get("day") };
}

export function addDays({ y, m, d }, n) {
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

/**
 * Время намазов на дату (по календарю города).
 * Возвращает { fajr, sunrise, dhuhr, asr, maghrib, isha, lastThird } — объекты Date (моменты времени).
 */
export function prayerTimes(day, place = currentPlace(), opts = {}) {
  const method = opts.method || currentMethod();
  const school = opts.school || currentSchool();
  const adjust = opts.adjust || settings.prayerAdjust || {};
  const { y, m, d } = day;
  const hours = computeUtcHours(y, m, d, place.lat, place.lon, method, school.factor);
  const result = {};
  for (const id of Object.keys(hours)) {
    const minutes = hours[id] * 60 + (method.offsets?.[id] || 0) + (adjust[id] || 0);
    // Округляем до минуты, как в печатных расписаниях
    result[id] = new Date(Date.UTC(y, m - 1, d) + Math.round(minutes) * 60000);
  }
  // Последняя треть ночи (время тахаджуда): от Магриба до Фаджра следующего дня
  const nd = addDays(day, 1);
  const next = computeUtcHours(nd.y, nd.m, nd.d, place.lat, place.lon, method, school.factor);
  const nextFajr = Date.UTC(nd.y, nd.m - 1, nd.d) + (next.fajr * 60 + (method.offsets?.fajr || 0) + (adjust.fajr || 0)) * 60000;
  const nightMs = nextFajr - result.maghrib.getTime();
  result.lastThird = new Date(Math.round((nextFajr - nightMs / 3) / 60000) * 60000);
  return result;
}

export const formatTime = (date, tz) =>
  new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz, hourCycle: "h23" }).format(date);

// Текущий и следующий намаз (Восход в «текущие» не считается — после него до Зухра намаза нет)
export function prayerState(place = currentPlace(), now = new Date()) {
  const today = todayIn(place.tz, now);
  const t = prayerTimes(today, place);
  const order = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  let next = order.find((id) => t[id] > now);
  let nextTime = next ? t[next] : null;
  if (!next) {
    next = "fajr";
    nextTime = prayerTimes(addDays(today, 1), place).fajr;
  }
  const idx = order.indexOf(next);
  let current = null;
  let currentTime = null;
  if (idx > 0 && t[next] > now) { current = order[idx - 1]; currentTime = t[current]; }
  else if (next === "fajr") {
    current = "isha";
    currentTime = t.isha < now ? t.isha : prayerTimes(addDays(today, -1), place).isha;
  }
  if (current === "sunrise") current = null; // после восхода — время духа, не фард
  return { today, times: t, current, currentTime, next, nextTime };
}

export function countdown(ms) {
  const total = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(total / 60), m = total % 60;
  if (h && m) return `через ${h} ч ${m} мин`;
  if (h) return `через ${h} ч`;
  return m ? `через ${m} мин` : "сейчас";
}

// Геолокация: в Telegram — LocationManager (Bot API 8.0), иначе — браузер
export function requestLocation() {
  return new Promise((resolve, reject) => {
    const tg = window.Telegram?.WebApp;
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const viaBrowser = () => {
      if (!navigator.geolocation) return reject(new Error("Геолокация недоступна"));
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, tz }),
        () => reject(new Error("Нет доступа к геолокации")),
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 3600000 },
      );
    };
    const lm = tg?.initData && tg.isVersionAtLeast?.("8.0") ? tg.LocationManager : null;
    if (!lm) return viaBrowser();
    const get = () => lm.getLocation((data) => (data ? resolve({ lat: data.latitude, lon: data.longitude, tz }) : viaBrowser()));
    try { lm.isInited ? get() : lm.init(() => (lm.isLocationAvailable ? get() : viaBrowser())); }
    catch { viaBrowser(); }
  });
}
