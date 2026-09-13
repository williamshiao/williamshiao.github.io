/**
 * Shape definitions for the floating/falling physics playground. Colors and
 * sizes are randomized fresh on every page load (generateShapes), not
 * baked in — only the kind mix and size/color *ranges* are fixed here.
 *
 * Two tiers: a larger population of small, purely decorative shapes, and a
 * handful of significantly bigger ones (`interactive: true`) that are meant
 * to eventually be the site's real page navigation — for now that just
 * means they're the only ones that respond to hover once settled (see
 * FloatingShapes), but keeping the flag on the shape itself now means the
 * later "click a big shape to open a page" step doesn't need to touch this
 * file again.
 */

export type ShapeKind = "circle" | "rect" | "triangle" | "ditto" | "switch";

export interface ShapeSpec {
  id: string;
  kind: ShapeKind;
  color: string;
  /** Circle: radius. Rect: half-width/half-height define the box. Triangle: circumradius. */
  size: number;
  /** Rect only — the box's other half-extent (size is half-width, this is half-height). */
  size2?: number;
  rotation?: number;
  interactive: boolean;
  /** Set only on the one big shape that currently opens a real page (see
   * FloatingShapes' click-to-expand) — undefined means "just decorative
   * hover feedback for now", same as any other non-interactive shape. */
  pageId?: string;
}

const KIND_WEIGHTS: { kind: ShapeKind; weight: number }[] = [
  { kind: "circle", weight: 0.5 },
  { kind: "rect", weight: 0.3 },
  { kind: "triangle", weight: 0.2 },
];

function pickKind(): ShapeKind {
  const r = Math.random();
  let acc = 0;
  for (const { kind, weight } of KIND_WEIGHTS) {
    acc += weight;
    if (r <= acc) return kind;
  }
  return "circle";
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

// Hues pulled straight from the site's own pastel accents + Ditto's magenta
// (see index.css --color-pastel-* / --color-ditto) so the shapes always
// read as "this site's palette", not an arbitrary rainbow — a fresh mix of
// these on every reload stays varied without ever clashing.
const PALETTE_HUES = [338, 292, 262, 205, 152, 40];
const HUE_JITTER = 8;

/** A color drawn from the curated palette above (small hue jitter for
 * variety) at a consistent saturation/lightness band, so any two shapes
 * picked at random still harmonize. */
function randomColor(): string {
  const base = PALETTE_HUES[Math.floor(Math.random() * PALETTE_HUES.length)];
  const hue = ((base + randomBetween(-HUE_JITTER, HUE_JITTER)) % 360 + 360) % 360;
  const saturation = randomBetween(55, 70);
  const lightness = randomBetween(32, 48);
  return `hsl(${hue.toFixed(0)}deg ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
}

interface SizeRange {
  circle: [number, number];
  rectHalf: [number, number];
  triangle: [number, number];
}

const SMALL_SIZE: SizeRange = { circle: [26, 42], rectHalf: [24, 38], triangle: [30, 46] };
// Roughly 3x the small tier — unmistakably a different class of object, not
// just "a slightly bigger circle".
const BIG_SIZE: SizeRange = { circle: [95, 135], rectHalf: [80, 115], triangle: [100, 140] };

function makeShape(id: string, interactive: boolean, range: SizeRange): ShapeSpec {
  const kind = pickKind();
  const color = randomColor();
  const rotation = randomBetween(-0.6, 0.6);
  if (kind === "rect") {
    const [min, max] = range.rectHalf;
    return { id, kind, color, size: randomBetween(min, max), size2: randomBetween(min, max), rotation, interactive };
  }
  if (kind === "triangle") {
    const [min, max] = range.triangle;
    return { id, kind, color, size: randomBetween(min, max), rotation, interactive };
  }
  const [min, max] = range.circle;
  return { id, kind, color, size: randomBetween(min, max), interactive };
}

export function generateShapes(smallCount: number, bigCount: number): ShapeSpec[] {
  const small = Array.from({ length: smallCount }, (_, i) => makeShape(`small-${i}`, false, SMALL_SIZE));
  const big = Array.from({ length: bigCount }, (_, i) => makeShape(`big-${i}`, true, BIG_SIZE));
  // Exactly one big shape currently opens a real page (Internships, as a
  // first pass — see FloatingShapes' click-to-expand). Always the first
  // one generated rather than picked by color, since color is randomized
  // fresh every load and isn't a stable enough hook to key off of.
  if (big.length > 0) big[0].pageId = "internships";
  // One guaranteed Ditto among the small tier, just for fun — always
  // present (not a random chance kind), always in the first small slot.
  if (small.length > 0) small[0] = makeDittoShape();
  // One guaranteed light switch too, in the second slot — see
  // FloatingShapes' toggleNightMode.
  if (small.length > 1) small[1] = makeLightSwitchShape();
  return [...small, ...big];
}

/**
 * A little easter egg: one of the small shapes is always Ditto itself,
 * rendered in FloatingShapes as a soft-body blob (see ./dittoBlob) with
 * the character's classic asymmetric face — one oval eye, one flat line
 * eye, a wavy mouth.
 */
export function makeDittoShape(): ShapeSpec {
  const [min, max] = SMALL_SIZE.circle;
  // A touch bigger than a typical small shape so it actually reads as
  // "someone drew a face on this" rather than disappearing into the mix.
  return { id: "ditto", kind: "ditto", color: "#f0abfc", size: randomBetween(min, max) * 1.15, interactive: false };
}

/**
 * Another shape that's always present rather than randomly generated: a
 * small rocker-switch-shaped rectangle that toggles the whole site's
 * night mode when clicked (see FloatingShapes' toggleNightMode/
 * spawnLightSwitch). Fixed size/proportions (not randomized like the
 * decorative tier) since it needs to reliably read as "a switch", and
 * `color` is a CSS var rather than a literal color so its plate always
 * matches the site's *current* surface tone, light or dark.
 */
export function makeLightSwitchShape(): ShapeSpec {
  return { id: "light-switch", kind: "switch", color: "var(--color-surface)", size: 22, size2: 32, interactive: true };
}
