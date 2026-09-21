import type { Localized } from "../i18n/localized";

// Personal/academic projects, from the software engineering CV plus the
// ornithopter (which only appears on the other CV variants). Links are the
// exact ones on those CVs; the YouTube ones were checked to resolve to
// videos on the owner's own channel.
export type ProjectGroup = "engineering" | "games";

export type ProjectLinkKind = "video" | "play" | "page";

export interface Project {
  id: string;
  group: ProjectGroup;
  title: Localized;
  period: Localized;
  /** Tech/tools, shown as small chips. */
  tags: string[];
  summary: Localized;
  link?: { url: string; kind: ProjectLinkKind };
}

export const projects: Project[] = [
  {
    id: "physics-engine",
    group: "engineering",
    title: { en: "Physics Simulation Engine", fr: "Moteur de simulation physique" },
    period: { en: "Winter 2022", fr: "Hiver 2022" },
    tags: ["C++"],
    summary: {
      en: "Iterative Closest Point (ICP), numerical integration and particle system solvers, with optimized CPU memory usage and simulation performance.",
      fr: "Algorithme Iterative Closest Point (ICP), intégration numérique et solveurs de systèmes de particules, avec une utilisation mémoire et des performances de simulation optimisées.",
    },
    link: { url: "https://youtu.be/bOhFWAoF8_Q", kind: "video" },
  },
  {
    id: "graphics-engine",
    group: "engineering",
    title: { en: "3D Graphics Engine", fr: "Moteur graphique 3D" },
    period: { en: "Fall 2022", fr: "Automne 2022" },
    tags: ["OpenGL", "GLSL", "ImGui"],
    summary: {
      en: "A rendering pipeline with custom shaders, lighting, shadows and animations, tuned for performance, with ImGui for real-time debugging and visualization.",
      fr: "Un pipeline de rendu avec shaders personnalisés, éclairage, ombres et animations, optimisé pour la performance, avec ImGui pour le débogage et la visualisation en temps réel.",
    },
  },
  {
    id: "moodboard",
    group: "engineering",
    title: { en: "MoodBoard — Visual Reference Tool", fr: "MoodBoard — outil de référence visuelle" },
    period: { en: "Winter 2021", fr: "Hiver 2021" },
    tags: ["Java"],
    summary: {
      en: "A desktop application for image manipulation and reference management, with UI features, file handling and image processing logic.",
      fr: "Une application de bureau pour la manipulation d'images et la gestion de références, avec fonctionnalités d'interface, gestion de fichiers et logique de traitement d'images.",
    },
  },
  {
    id: "ornithopter",
    group: "engineering",
    title: { en: "Ornithopter", fr: "Ornithoptère" },
    period: { en: "2019", fr: "2019" },
    tags: ["AutoCAD", "SolidWorks", "C", "Atmel Studio"],
    summary: {
      en: "Design and production of a flapping-wing aircraft, drawn up in AutoCAD and SolidWorks, with its microcontroller programmed in C.",
      fr: "Conception et fabrication d'un aéronef à ailes battantes, dessiné avec AutoCAD et SolidWorks, dont le microcontrôleur est programmé en C.",
    },
    link: { url: "https://youtu.be/RhWuqH-fddU", kind: "video" },
  },
  {
    id: "hole-in-the-wall",
    group: "games",
    title: { en: "Hole In The Wall", fr: "Hole In The Wall" },
    period: { en: "2024", fr: "2024" },
    tags: ["Unity", "C#", "Leap Motion"],
    summary: {
      en: "An interactive 3D installation built in Unity with Leap Motion.",
      fr: "Une installation 3D interactive réalisée dans Unity avec Leap Motion.",
    },
    link: { url: "https://rb.gy/lc6v7w", kind: "page" },
  },
  {
    id: "poly-defense",
    group: "games",
    title: { en: "Poly Defense", fr: "Poly Defense" },
    period: { en: "2024", fr: "2024" },
    tags: ["Unity", "C#", "Mixed Reality"],
    summary: {
      en: "A mixed reality game built in Unity.",
      fr: "Un jeu en réalité mixte réalisé dans Unity.",
    },
    link: { url: "https://youtu.be/6FHY8toK5C0", kind: "video" },
  },
  {
    id: "loner-ranger",
    group: "games",
    title: { en: "Loner Ranger", fr: "Loner Ranger" },
    period: { en: "2023", fr: "2023" },
    tags: ["Unity", "C#", "PC"],
    summary: {
      en: "A PC game built in Unity, including its 3D world and level design.",
      fr: "Un jeu PC réalisé dans Unity, incluant son monde 3D et son level design.",
    },
    link: { url: "https://colorfulways.itch.io/lone-ranger", kind: "play" },
  },
  {
    id: "parasite",
    group: "games",
    title: { en: "Parasite", fr: "Parasite" },
    period: { en: "2018", fr: "2018" },
    tags: ["Unity", "C#", "PC"],
    summary: {
      en: "A student PC game built in Unity.",
      fr: "Un jeu PC étudiant réalisé dans Unity.",
    },
    link: { url: "https://youtu.be/-Rxdk11xQUE", kind: "video" },
  },
];
