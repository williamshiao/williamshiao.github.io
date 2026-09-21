import type { ComponentType } from "react";
import { Artworks } from "../components/sections/Artworks";

export type TabId = "about" | "artworks";

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
];

export const PANELS: PanelConfig[] = [
  {
    id: "artworks",
    label: "Artworks",
    kicker: "Personal drawings",
    title: "Artworks",
    component: Artworks,
  },
];
