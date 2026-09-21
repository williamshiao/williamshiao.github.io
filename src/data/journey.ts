import type { Localized } from "../i18n/localized";

// The professional/academic path, newest first, drawn from the software
// engineering CV (the fullest and most recent of the CV variants). Work and
// study share one timeline on purpose — the point of this page is the
// path, not a résumé's separate Education/Experience sections.
export type JourneyKind = "work" | "study";

export interface JourneyEntry {
  id: string;
  kind: JourneyKind;
  /** Role or degree. */
  title: Localized;
  /** Company or school — proper names, not translated. */
  org: string;
  /** Omitted when the org's own name already says where it is. */
  location?: string;
  period: Localized;
  /** Small pill next to the title, e.g. "Internship". */
  note?: Localized;
  highlights?: Localized[];
  /** Tools/tech actually named in that entry's own bullets. */
  tags?: string[];
}

export const journey: JourneyEntry[] = [
  {
    id: "dess-polytechnique",
    kind: "study",
    title: {
      en: "DESS in Usability & User Experience",
      fr: "DESS en utilisabilité et expérience utilisateur",
    },
    org: "Polytechnique Montréal",
    period: { en: "2026 – present", fr: "2026 – présent" },
    note: { en: "In progress", fr: "En cours" },
  },
  {
    id: "ets-bachelor",
    kind: "study",
    title: {
      en: "Baccalaureate in Software Engineering",
      fr: "Baccalauréat en génie logiciel",
    },
    org: "École de technologie supérieure (ÉTS)",
    location: "Montréal",
    period: { en: "Graduated March 2025", fr: "Diplômé en mars 2025" },
  },
  {
    id: "frima-devops",
    kind: "work",
    title: { en: "DevOps Developer", fr: "Développeur DevOps" },
    org: "Frima Studio",
    location: "Québec",
    period: { en: "Fall 2024", fr: "Automne 2024" },
    note: { en: "Internship", fr: "Stage" },
    highlights: [
      {
        en: "Designed, automated and optimized CI/CD pipelines, improving compilation and deployment across mobile, console and PC for the delivery and publishing of AAA video games.",
        fr: "Conception, automatisation et optimisation de pipelines CI/CD, améliorant la compilation et le déploiement sur mobile, console et PC pour la livraison et la publication de jeux vidéo AAA.",
      },
      {
        en: "Developed internal automation tools (CLI utilities, testing scripts, UX) with Python.",
        fr: "Développement d'outils d'automatisation internes (utilitaires en ligne de commande, scripts de test, UX) avec Python.",
      },
    ],
    tags: ["CI/CD", "Python"],
  },
  {
    id: "cinesite-pipeline",
    kind: "work",
    title: { en: "Pipeline TD Intern", fr: "Stagiaire Pipeline TD" },
    org: "Cinesite",
    location: "Montréal",
    period: { en: "Summer 2023", fr: "Été 2023" },
    note: { en: "Internship", fr: "Stage" },
    highlights: [
      {
        en: "Built and maintained pipeline tools and plugins in Python and C++ to support VFX and animation workflows.",
        fr: "Création et maintenance d'outils et de plugiciels de pipeline en Python et C++ pour soutenir les flux de travail VFX et d'animation.",
      },
      {
        en: "Troubleshot and resolved technical issues across major applications including Unreal Engine, Maya, Nuke, Mari, Houdini, and Gaffer.",
        fr: "Diagnostic et résolution de problèmes techniques dans de grandes applications dont Unreal Engine, Maya, Nuke, Mari, Houdini et Gaffer.",
      },
    ],
    tags: ["Python", "C++", "Maya", "Houdini", "Unreal Engine", "Nuke", "Mari", "Gaffer"],
  },
  {
    id: "equisoft-testing",
    kind: "work",
    title: { en: "Automated Test Specialist", fr: "Spécialiste en tests automatisés" },
    org: "Equisoft",
    location: "Montréal",
    period: { en: "Fall 2021", fr: "Automne 2021" },
    note: { en: "Internship", fr: "Stage" },
    highlights: [
      {
        en: "Developed and maintained automated regression tests in C#, improving test coverage and reducing manual QA workload.",
        fr: "Développement et maintenance de tests de régression automatisés en C#, améliorant la couverture de tests et réduisant la charge de QA manuelle.",
      },
      {
        en: "Analyzed test results and collaborated with QA specialists in Agile/SCRUM teams.",
        fr: "Analyse des résultats de tests et collaboration avec des spécialistes en assurance qualité dans des équipes Agile/SCRUM.",
      },
    ],
    tags: ["C#", "Selenium", "JUnit", "JIRA"],
  },
  {
    id: "bois-de-boulogne",
    kind: "study",
    title: {
      en: "College Degree in Computer Science and Mathematics",
      fr: "DEC en informatique et mathématiques",
    },
    org: "Collège de Bois-de-Boulogne",
    location: "Montréal",
    period: { en: "2018", fr: "2018" },
  },
  {
    id: "staples",
    kind: "work",
    title: { en: "Cashier & Floor Clerk", fr: "Caissier et commis de plancher" },
    org: "Staples",
    location: "Montréal",
    period: { en: "Summers 2016 & 2017", fr: "Étés 2016 et 2017" },
  },
];
