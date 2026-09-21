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
  pageHintKicker: string;
  pageHintTitle: string;
  journeyLabel: string;
  journeyTitle: string;
  journeyIntro: string;
  projectsLabel: string;
  projectsTitle: string;
  projectsIntro: string;
  projectsEngineeringHeading: string;
  projectsGamesHeading: string;
  projectsLinkVideo: string;
  projectsLinkPlay: string;
  projectsLinkPage: string;
  contactLabel: string;
  contactTitle: string;
  contactIntro: string;
  contactEmailLabel: string;
  contactGithubLabel: string;
  contactLinkedinLabel: string;
  artworksLabel: string;
  artworksTitle: string;
  artworksIntro: string;
  artworksArtstationLabel: string;
}

const en: Strings = {
  heroTagline: "Software Engineer · Aspiring UI/UX Engineer",
  heroBio:
    "A software engineering graduate currently studying usability and UX at Polytechnique Montréal — building things that are both technically solid and genuinely pleasant to use.",
  pageHintKicker: "Look around",
  pageHintTitle: "Every shape opens something",
  journeyLabel: "Journey",
  journeyTitle: "My Journey",
  journeyIntro:
    "Software engineering, film and game pipelines, and now usability & UX — the path so far.",
  projectsLabel: "Projects",
  projectsTitle: "Projects",
  projectsIntro: "Engines, tools and games I've built — most with a demo you can watch or play.",
  projectsEngineeringHeading: "Engineering",
  projectsGamesHeading: "Games",
  projectsLinkVideo: "Watch demo",
  projectsLinkPlay: "Play on itch.io",
  projectsLinkPage: "View project",
  contactLabel: "Contact",
  contactTitle: "Get in Touch",
  contactIntro: "Have a project, an opportunity, or just want to say hi? Reach out — I'd love to hear from you.",
  contactEmailLabel: "Email",
  contactGithubLabel: "GitHub",
  contactLinkedinLabel: "LinkedIn",
  artworksLabel: "Artworks",
  artworksTitle: "Artworks",
  artworksIntro: "A few personal drawings — see the rest of my portfolio on ArtStation.",
  artworksArtstationLabel: "View full portfolio on ArtStation",
};

const fr: Strings = {
  heroTagline: "Ingénieur logiciel · Aspirant ingénieur UI/UX",
  heroBio:
    "Diplômé en génie logiciel, actuellement aux études en utilisabilité et en expérience utilisateur à Polytechnique Montréal — je conçois des projets à la fois techniquement solides et agréables à utiliser.",
  pageHintKicker: "Explorez",
  pageHintTitle: "Chaque forme ouvre quelque chose",
  journeyLabel: "Parcours",
  journeyTitle: "Mon parcours",
  journeyIntro:
    "Génie logiciel, pipelines de cinéma et de jeux vidéo, et maintenant utilisabilité et UX — mon parcours jusqu'ici.",
  projectsLabel: "Projets",
  projectsTitle: "Projets",
  projectsIntro:
    "Des moteurs, des outils et des jeux que j'ai créés — la plupart avec une démo à regarder ou à jouer.",
  projectsEngineeringHeading: "Ingénierie",
  projectsGamesHeading: "Jeux",
  projectsLinkVideo: "Voir la démo",
  projectsLinkPlay: "Jouer sur itch.io",
  projectsLinkPage: "Voir le projet",
  contactLabel: "Contact",
  contactTitle: "Me contacter",
  contactIntro:
    "Un projet, une opportunité, ou simplement envie de dire bonjour? Écrivez-moi — ça me ferait plaisir d'échanger.",
  contactEmailLabel: "Courriel",
  contactGithubLabel: "GitHub",
  contactLinkedinLabel: "LinkedIn",
  artworksLabel: "Illustrations",
  artworksTitle: "Illustrations",
  artworksIntro: "Quelques dessins personnels — voyez le reste de mon portfolio sur ArtStation.",
  artworksArtstationLabel: "Voir le portfolio complet sur ArtStation",
};

export const STRINGS: Record<Lang, Strings> = { en, fr };
export type StringKey = keyof Strings;
