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

export type ShapeKind = "circle" | "rect" | "triangle";

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
  return [...small, ...big];
}
