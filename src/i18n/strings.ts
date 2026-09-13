/**
 * The site's bilingual copy — every UI string lives here once, in both
 * languages, rather than scattered across components with the French
 * bolted on separately later. Components read it through useLanguage()'s
 * `t()` (see ../context/LanguageContext), never straight from STRINGS.
 *
 * TODO(content): the English copy here is still the same placeholder text
 * used everywhere else in this project (see Hero.tsx, App.tsx) — finalize
 * both languages together once the real bio/copy is written, rather than
 * translating a draft that's about to change anyway.
 */

export type Lang = "en" | "fr";

export interface Strings {
  heroTagline: string;
  heroBio: string;
  comingDownToLand: string;
  soonSite: string;
  internshipsLabel: string;
  internshipsTitle: string;
}

const en: Strings = {
  heroTagline: "Software Engineer · Aspiring UI/UX Engineer",
  heroBio:
    "A software engineering graduate currently studying usability and UX at Polytechnique Montréal — building things that are both technically solid and genuinely pleasant to use.",
  comingDownToLand: "Coming down to land",
  soonSite: "Soon, these become the site",
  internshipsLabel: "Internships",
  internshipsTitle: "Internships",
};

const fr: Strings = {
  heroTagline: "Ingénieur logiciel · Aspirant ingénieur UI/UX",
  heroBio:
    "Diplômé en génie logiciel, actuellement aux études en utilisabilité et en expérience utilisateur à Polytechnique Montréal — je conçois des projets à la fois techniquement solides et agréables à utiliser.",
  comingDownToLand: "Sur le point d'atterrir",
  soonSite: "Bientôt, ceci deviendra le site",
  internshipsLabel: "Stages",
  internshipsTitle: "Stages",
};

export const STRINGS: Record<Lang, Strings> = { en, fr };
export type StringKey = keyof Strings;
