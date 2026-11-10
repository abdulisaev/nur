// 20 известных чтецов. Аудио по аятам — everyayah.com (папка = id).
export const AUDIO_BASE = "https://everyayah.com/data/";

export const RECITERS = [
  { id: "Alafasy_128kbps", name: "Мишари Рашид аль-Афаси", ar: "مشاري راشد العفاسي", info: "Кувейт · муратталь" },
  { id: "Abdul_Basit_Murattal_192kbps", name: "Абдуль-Басит Абдус-Самад", ar: "عبد الباسط عبد الصمد", info: "Египет · муратталь" },
  { id: "Abdurrahmaan_As-Sudais_192kbps", name: "Абдуррахман ас-Судайс", ar: "عبد الرحمن السديس", info: "Имам Заповедной мечети" },
  { id: "MaherAlMuaiqly128kbps", name: "Махер аль-Муайкли", ar: "ماهر المعيقلي", info: "Имам Заповедной мечети" },
  { id: "Saood_ash-Shuraym_128kbps", name: "Са'уд аш-Шурайм", ar: "سعود الشريم", info: "Саудовская Аравия" },
  { id: "Yasser_Ad-Dussary_128kbps", name: "Ясир ад-Даусари", ar: "ياسر الدوسري", info: "Имам Заповедной мечети" },
  { id: "Ghamadi_40kbps", name: "Са'д аль-Гамиди", ar: "سعد الغامدي", info: "Саудовская Аравия" },
  { id: "Husary_128kbps", name: "Махмуд Халиль аль-Хусари", ar: "محمود خليل الحصري", info: "Египет · муратталь" },
  { id: "Minshawy_Murattal_128kbps", name: "Мухаммад Сиддик аль-Миншави", ar: "محمد صديق المنشاوي", info: "Египет · муратталь" },
  { id: "Abu_Bakr_Ash-Shaatree_128kbps", name: "Абу Бакр аш-Шатыри", ar: "أبو بكر الشاطري", info: "Саудовская Аравия" },
  { id: "ahmed_ibn_ali_al_ajamy_128kbps", name: "Ахмад аль-Аджми", ar: "أحمد بن علي العجمي", info: "Саудовская Аравия" },
  { id: "Hani_Rifai_192kbps", name: "Хани ар-Рифаи", ar: "هاني الرفاعي", info: "Саудовская Аравия" },
  { id: "Nasser_Alqatami_128kbps", name: "Насир аль-Катами", ar: "ناصر القطامي", info: "Саудовская Аравия" },
  { id: "Fares_Abbad_64kbps", name: "Фарис Аббад", ar: "فارس عباد", info: "Йемен" },
  { id: "Hudhaify_128kbps", name: "Али аль-Хузайфи", ar: "علي الحذيفي", info: "Имам Мечети Пророка" },
  { id: "Abdullaah_3awwaad_Al-Juhaynee_128kbps", name: "Абдуллах аль-Джухани", ar: "عبد الله الجهني", info: "Имам Заповедной мечети" },
  { id: "Muhammad_Ayyoub_128kbps", name: "Мухаммад Айюб", ar: "محمد أيوب", info: "Имам Мечети Пророка" },
  { id: "Abdul_Basit_Mujawwad_128kbps", name: "Абдуль-Басит (мужаввад)", ar: "عبد الباسط عبد الصمد", info: "Египет · мужаввад, напевное чтение" },
  { id: "Muhammad_Jibreel_128kbps", name: "Мухаммад Джибриль", ar: "محمد جبريل", info: "Египет" },
  { id: "Abdullah_Basfar_192kbps", name: "Абдуллах Басфар", ar: "عبد الله بصفر", info: "Саудовская Аравия" },
];

export const reciter = (id) => RECITERS.find((r) => r.id === id) || RECITERS[0];

export function initials(name) {
  const parts = name.replace(/^(аль|ас|аш|ад|ар|ан|аз|ат)-/i, "").split(/\s+/);
  return parts.slice(0, 2).map((p) => p.replace(/^(аль|ас|аш|ад|ар|ан|аз|ат)-/i, "")[0]).join("").toUpperCase();
}

const pad3 = (n) => String(n).padStart(3, "0");
export const ayahUrl = (reciterId, s, a) => `${AUDIO_BASE}${reciterId}/${pad3(s)}${pad3(a)}.mp3`;
