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
 * handful of physics points into an organic blob outline instead of a
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
