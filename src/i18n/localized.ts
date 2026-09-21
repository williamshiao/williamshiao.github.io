import type { Lang } from "./strings";

// A piece of content that exists in both site languages — used by the data
// files (journey.ts, projects.ts) whose copy is too long/specific to live
// as keys in strings.ts, but still has to follow the language toggle.
export type Localized = Record<Lang, string>;
