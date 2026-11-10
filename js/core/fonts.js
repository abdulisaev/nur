// Шрифты подгружаются с Google Fonts только когда выбраны (или открыт экран выбора).
export const AR_FONTS = [
  { id: "amiri-quran", name: "Amiri Quran", note: "Классический мусхаф", family: '"Amiri Quran"', q: "Amiri+Quran", lh: 2.25 },
  { id: "scheherazade", name: "Scheherazade New", note: "Чёткий насх", family: '"Scheherazade New"', q: "Scheherazade+New:wght@400;700", lh: 2.05 },
  { id: "amiri", name: "Amiri", note: "Книжный насх", family: '"Amiri"', q: "Amiri:wght@400;700", lh: 2.15 },
  { id: "noto-naskh", name: "Noto Naskh Arabic", note: "Современный", family: '"Noto Naskh Arabic"', q: "Noto+Naskh+Arabic:wght@400;600", lh: 2.0 },
  { id: "lateef", name: "Lateef", note: "Мягкий, крупный", family: '"Lateef"', q: "Lateef:wght@400;600", lh: 2.0 },
];

export const TR_FONTS = [
  { id: "system", name: "Системный", note: "SF Pro / Inter", family: "var(--font-ui)" },
  { id: "manrope", name: "Manrope", note: "Геометрический", family: '"Manrope", var(--font-ui)', q: "Manrope:wght@400;500;600" },
  { id: "pt-serif", name: "PT Serif", note: "Книжный", family: '"PT Serif", Georgia, serif', q: "PT+Serif:ital,wght@0,400;0,700;1,400" },
  { id: "lora", name: "Lora", note: "Элегантный", family: '"Lora", Georgia, serif', q: "Lora:ital,wght@0,400;0,500;1,400" },
  { id: "noto-serif", name: "Noto Serif", note: "Классический", family: '"Noto Serif", Georgia, serif', q: "Noto+Serif:ital,wght@0,400;0,600;1,400" },
];

const loaded = new Set();

export function loadFont(font) {
  if (!font?.q || loaded.has(font.q)) return;
  loaded.add(font.q);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${font.q}&display=swap`;
  document.head.append(link);
}

export const loadAllFonts = () => [...AR_FONTS, ...TR_FONTS].forEach(loadFont);
