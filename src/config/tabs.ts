import type { ComponentType } from "react";
import { About } from "../components/sections/About";
import { Artworks } from "../components/sections/Artworks";
import { Internships } from "../components/sections/Internships";

export type TabId = "about" | "artworks" | "internships";

export interface TabConfig {
  id: TabId;
  label: string;
  kicker: string;
  title: string;
  component: ComponentType;
}

// Whether the Internships tab stays is still undecided (see project brief).
// To drop it: delete this entry and the About/Artworks-adjacent import above —
// TabBar and App both read this array, so nothing else needs to change.
export const TABS: TabConfig[] = [
  { id: "about", label: "About", kicker: "Who I am", title: "About", component: About },
  {
    id: "artworks",
    label: "Artworks",
    kicker: "Personal drawings",
    title: "Artworks",
    component: Artworks,
  },
  {
    id: "internships",
    label: "Internships",
    kicker: "Where I've worked",
    title: "Internship Experience",
    component: Internships,
  },
];
