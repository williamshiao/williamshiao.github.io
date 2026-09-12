import type { ComponentType } from "react";
import { Artworks } from "../components/sections/Artworks";
import { Internships } from "../components/sections/Internships";

export type TabId = "about" | "artworks" | "internships";

export interface NavTab {
  id: TabId;
  label: string;
}

export interface PanelConfig {
  id: Exclude<TabId, "about">;
  label: string;
  kicker: string;
  title: string;
  component: ComponentType;
}

// Every button the TabBar renders, in order. "about" has no panel — it's the
// terrarium's resting/home state (see Hero) — selecting it just closes
// whatever panel is open.
export const NAV_TABS: NavTab[] = [
  { id: "about", label: "About" },
  { id: "artworks", label: "Artworks" },
  { id: "internships", label: "Internships" },
];

// Whether the Internships tab stays is still undecided (see project brief).
// To drop it: delete this entry and its NAV_TABS entry above.
export const PANELS: PanelConfig[] = [
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
