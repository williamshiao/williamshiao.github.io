/**
 * Shape definitions for the floating/falling physics playground. Colors and
 * sizes are randomized fresh on every page load (generateShapes), not
 * baked in — only the kind mix and size/color *ranges* are fixed here.
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

/** A random, moderately saturated color — varied hue every call, but a
 * consistent enough saturation/lightness band to read as one cohesive
 * palette rather than arbitrary noise. */
function randomColor(): string {
  const hue = Math.floor(randomBetween(0, 360));
  const saturation = randomBetween(50, 72);
  const lightness = randomBetween(28, 52);
  return `hsl(${hue}deg ${saturation.toFixed(0)}% ${lightness.toFixed(0)}%)`;
}

export function generateShapes(count: number): ShapeSpec[] {
  return Array.from({ length: count }, (_, i) => {
    const kind = pickKind();
    const color = randomColor();
    const rotation = randomBetween(-0.6, 0.6);
    if (kind === "rect") {
      return { id: `shape-${i}`, kind, color, size: randomBetween(38, 62), size2: randomBetween(38, 62), rotation };
    }
    if (kind === "triangle") {
      return { id: `shape-${i}`, kind, color, size: randomBetween(48, 76), rotation };
    }
    return { id: `shape-${i}`, kind, color, size: randomBetween(44, 74) };
  });
}
