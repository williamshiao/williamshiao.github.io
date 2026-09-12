export interface Vec2 {
  x: number;
  y: number;
}

/**
 * A point on the boundary of a rounded rectangle, parameterized by `t` in
 * [0, 1) — arc-length uniform, going clockwise starting on the top edge.
 * Used to give each outline point a target when the blob molds onto an
 * element's bounding box.
 */
export function pointOnRoundedRect(rect: DOMRect, cornerRadius: number, t: number): Vec2 {
  const r = Math.max(0, Math.min(cornerRadius, rect.width / 2, rect.height / 2));
  const straightW = rect.width - 2 * r;
  const straightH = rect.height - 2 * r;
  const arc = (Math.PI / 2) * r;
  const perimeter = 2 * straightW + 2 * straightH + 4 * arc;

  let d = (((t % 1) + 1) % 1) * perimeter;

  const segments: Array<{ length: number; point: (local: number) => Vec2 }> = [
    // top edge, left -> right
    { length: straightW, point: (l) => ({ x: rect.x + r + l, y: rect.y }) },
    // top-right corner
    {
      length: arc,
      point: (l) => {
        const a = -Math.PI / 2 + (l / arc) * (Math.PI / 2);
        return { x: rect.x + rect.width - r + Math.cos(a) * r, y: rect.y + r + Math.sin(a) * r };
      },
    },
    // right edge, top -> bottom
    { length: straightH, point: (l) => ({ x: rect.x + rect.width, y: rect.y + r + l }) },
    // bottom-right corner
    {
      length: arc,
      point: (l) => {
        const a = 0 + (l / arc) * (Math.PI / 2);
        return {
          x: rect.x + rect.width - r + Math.cos(a) * r,
          y: rect.y + rect.height - r + Math.sin(a) * r,
        };
      },
    },
    // bottom edge, right -> left
    { length: straightW, point: (l) => ({ x: rect.x + rect.width - r - l, y: rect.y + rect.height }) },
    // bottom-left corner
    {
      length: arc,
      point: (l) => {
        const a = Math.PI / 2 + (l / arc) * (Math.PI / 2);
        return {
          x: rect.x + r + Math.cos(a) * r,
          y: rect.y + rect.height - r + Math.sin(a) * r,
        };
      },
    },
    // left edge, bottom -> top
    { length: straightH, point: (l) => ({ x: rect.x, y: rect.y + rect.height - r - l }) },
    // top-left corner
    {
      length: arc,
      point: (l) => {
        const a = Math.PI + (l / arc) * (Math.PI / 2);
        return { x: rect.x + r + Math.cos(a) * r, y: rect.y + r + Math.sin(a) * r };
      },
    },
  ];

  for (const segment of segments) {
    if (d <= segment.length) return segment.point(d);
    d -= segment.length;
  }
  const last = segments[segments.length - 1];
  return last.point(last.length);
}

/**
 * Smooth closed SVG path through a loop of points, via Catmull-Rom-to-Bezier
 * conversion (uniform parameterization, tension 1/6). This is what turns a
 * handful of geometry points into an organic blob outline instead of a
 * faceted polygon.
 */
export function smoothClosedPath(points: Vec2[]): string {
  const n = points.length;
  if (n < 3) return "";
  const at = (i: number) => points[((i % n) + n) % n];

  let d = `M ${points[0].x.toFixed(2)},${points[0].y.toFixed(2)} `;
  for (let i = 0; i < n; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2.x.toFixed(2)},${p2.y.toFixed(2)} `;
  }
  return d + "Z";
}

// ---- Teardrop body shape -----------------------------------------------
//
// Ditto's idle silhouette is generated from just two physics points — a
// "head" (pinned near the cursor) and a "body" (hanging below it, lagging
// with its own heavier spring) — rather than many independently-sprung
// outline points. A width profile along that head-to-body "spine" gives the
// teardrop silhouette (narrow pinch at the head, bulging around the body,
// a small blunt nub at the tail), and a few fixed bump perturbations along
// it read as stubby ragdoll limbs. Driving the whole ring from one shared
// skeleton is what keeps the outline moving as one cohesive body instead of
// rippling — the sway comes from the head/body lag, not from per-point lag.

interface ProfileKey {
  t: number;
  w: number;
}

// Width along the spine as a fraction of baseRadius, t=0 at the head
// (pinched, held by the cursor) to t=1 at the tail (a small blunt nub).
const TEARDROP_PROFILE: ProfileKey[] = [
  { t: 0.0, w: 0.2 },
  { t: 0.16, w: 0.55 },
  { t: 0.38, w: 0.9 },
  { t: 0.6, w: 1.0 },
  { t: 0.8, w: 0.88 },
  { t: 0.94, w: 0.45 },
  { t: 1.0, w: 0.12 },
];

function sampleProfile(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 0; i < TEARDROP_PROFILE.length - 1; i++) {
    const a = TEARDROP_PROFILE[i];
    const b = TEARDROP_PROFILE[i + 1];
    if (clamped >= a.t && clamped <= b.t) {
      const span = b.t - a.t || 1;
      const localT = (clamped - a.t) / span;
      const eased = localT * localT * (3 - 2 * localT); // smoothstep
      return a.w + (b.w - a.w) * eased;
    }
  }
  return TEARDROP_PROFILE[TEARDROP_PROFILE.length - 1].w;
}

export interface LimbBump {
  /** Position along the spine, 0 (head) to 1 (tail). */
  t: number;
  /** -1 = left side only, 1 = right side only, 0 = both sides. */
  side: -1 | 0 | 1;
  /** Extra width at the bump's peak, as a fraction of baseRadius. */
  amount: number;
  /** How localized the bump is along t — smaller reads as a tighter nub. */
  spread: number;
}

// A handful of fixed, asymmetric nubs — Ditto's stubby ragdoll limbs.
export const DEFAULT_LIMB_BUMPS: LimbBump[] = [
  { t: 0.34, side: -1, amount: 0.24, spread: 0.09 },
  { t: 0.48, side: 1, amount: 0.2, spread: 0.08 },
  { t: 0.74, side: -1, amount: 0.16, spread: 0.1 },
];

function widthAt(t: number, side: -1 | 1, baseRadius: number, bumps: LimbBump[]): number {
  let w = sampleProfile(t);
  for (const bump of bumps) {
    if (bump.side !== 0 && bump.side !== side) continue;
    const dt = (t - bump.t) / bump.spread;
    w += bump.amount * Math.exp(-4 * dt * dt);
  }
  return Math.max(0, w) * baseRadius;
}

/**
 * One point on the teardrop ring, indexed 0..count-1 going right-side
 * head->tail then left-side tail->head, so the loop closes cleanly.
 */
export function teardropRingPoint(
  index: number,
  count: number,
  head: Vec2,
  tailDir: Vec2,
  spineLength: number,
  baseRadius: number,
  bumps: LimbBump[],
): Vec2 {
  const s = (index / count) * 2; // 0..2 around the loop
  const t = s <= 1 ? s : 2 - s;
  const side: -1 | 1 = s <= 1 ? 1 : -1;
  const width = widthAt(t, side, baseRadius, bumps);
  const perpX = -tailDir.y;
  const perpY = tailDir.x;
  return {
    x: head.x + tailDir.x * t * spineLength + perpX * side * width,
    y: head.y + tailDir.y * t * spineLength + perpY * side * width,
  };
}
