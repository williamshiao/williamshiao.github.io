/**
 * Ditto's soft-body skin — a ring of nodes that visually wobbles, squashes,
 * and stretches around the rigid Matter.js circle body that actually
 * handles collision for it (see FloatingShapes: createShapeBody treats
 * "ditto" as a plain circle). The nodes never resolve collisions
 * themselves; every frame they just chase a goal position derived from
 * that body's own position/angle (Verlet integration gives them their own
 * inertia, so a sudden bounce makes them lag and overshoot before
 * catching back up — the actual squash-and-stretch), plus simple
 * neighbor-distance constraints so they stay evenly spaced around the
 * perimeter instead of bunching up.
 *
 * This is deliberately a different architecture from the original blob
 * cursor (see git history for BlobCursor.tsx/blobPhysics.ts, banked
 * earlier): that mesh had no rigid anchor of its own and derived its own
 * transform from the nodes' current positions, which is what let it drift
 * and topologically invert over many frames. Anchoring every node's goal
 * to an externally-driven, authoritative rigid body sidesteps that whole
 * class of bug — the nodes can wobble, but they can never wander more
 * than a spring's-worth away from a perfectly valid circle.
 */

export interface DittoNode {
  x: number;
  y: number;
  px: number;
  py: number;
  restX: number;
  restY: number;
}

export interface DittoBlobState {
  nodes: DittoNode[];
  radius: number;
  pathEl: SVGPathElement;
  faceEl: SVGGElement;
}

const NODE_COUNT = 10;
// How hard each node is pulled back toward its goal position every frame
// (the "shape matching" stiffness) vs. how much of its own momentum it
// keeps (Verlet damping) — stiff enough to always spring back to round,
// loose enough to visibly squish on impact first.
const STIFFNESS = 0.2;
const DAMPING = 0.9;
const EDGE_ITERATIONS = 2;

export function createDittoNodes(x: number, y: number, radius: number): DittoNode[] {
  return Array.from({ length: NODE_COUNT }, (_, i) => {
    const angle = (i / NODE_COUNT) * Math.PI * 2;
    const rx = Math.cos(angle) * radius;
    const ry = Math.sin(angle) * radius;
    return { x: x + rx, y: y + ry, px: x + rx, py: y + ry, restX: rx, restY: ry };
  });
}

/** Advances the blob's nodes by one frame toward the driving rigid body's
 * current transform, and writes the result straight into the path/face
 * elements — call once per animation frame. */
export function stepDittoBlob(blob: DittoBlobState, driverX: number, driverY: number, driverAngle: number) {
  const cos = Math.cos(driverAngle);
  const sin = Math.sin(driverAngle);

  for (const n of blob.nodes) {
    // Verlet: infer velocity from the last two positions rather than
    // tracking it separately, and damp it — this is what gives each node
    // its own lag/overshoot instead of snapping straight to the goal.
    const vx = (n.x - n.px) * DAMPING;
    const vy = (n.y - n.py) * DAMPING;
    n.px = n.x;
    n.py = n.y;
    n.x += vx;
    n.y += vy;

    // Pull toward the rest-shape offset rotated/translated by the rigid
    // body's own current transform — the "shape matching" goal, just
    // driven externally instead of derived from the nodes themselves.
    const goalX = driverX + (n.restX * cos - n.restY * sin);
    const goalY = driverY + (n.restX * sin + n.restY * cos);
    n.x += (goalX - n.x) * STIFFNESS;
    n.y += (goalY - n.y) * STIFFNESS;
  }

  // Keep neighbors evenly spaced along the perimeter so the outline stays
  // a simple ring rather than nodes bunching or crossing locally.
  const restEdgeLen = 2 * blob.radius * Math.sin(Math.PI / blob.nodes.length);
  for (let iter = 0; iter < EDGE_ITERATIONS; iter++) {
    for (let i = 0; i < blob.nodes.length; i++) {
      const a = blob.nodes[i];
      const b = blob.nodes[(i + 1) % blob.nodes.length];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      const diff = ((dist - restEdgeLen) / dist) * 0.5;
      const ox = dx * diff;
      const oy = dy * diff;
      a.x += ox;
      a.y += oy;
      b.x -= ox;
      b.y -= oy;
    }
  }

  blob.pathEl.setAttribute("d", nodesToSmoothPath(blob.nodes));
  // The face rides rigidly on the driving body, like a sticker on top of
  // the wobbling skin underneath — simpler than deforming it too, and
  // reads better (it stays legible instead of squishing into a smear).
  blob.faceEl.setAttribute(
    "transform",
    `translate(${driverX.toFixed(2)} ${driverY.toFixed(2)}) rotate(${(driverAngle * (180 / Math.PI)).toFixed(2)})`,
  );
}

/** Closed Catmull-Rom spline through the nodes, converted to cubic bezier
 * segments (standard 1/6-tension formula) — smooth and blobby rather than
 * faceted, with no spline library needed. */
function nodesToSmoothPath(nodes: DittoNode[]): string {
  const n = nodes.length;
  const at = (i: number) => nodes[(i + n) % n];
  const p0 = at(0);
  let d = `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} `;
  for (let i = 0; i < n; i++) {
    const a = at(i - 1);
    const b = at(i);
    const c = at(i + 1);
    const e = at(i + 2);
    const c1x = b.x + (c.x - a.x) / 6;
    const c1y = b.y + (c.y - a.y) / 6;
    const c2x = c.x - (e.x - b.x) / 6;
    const c2y = c.y - (e.y - b.y) / 6;
    d += `C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${c.x.toFixed(2)} ${c.y.toFixed(2)} `;
  }
  return d + "Z";
}

/** Appends Ditto's classic asymmetric face (one oval eye, one flat line
 * eye, a simple wavy mouth) to the given group, sized relative to r. */
export function appendDittoFace(g: SVGGElement, r: number) {
  const ns = "http://www.w3.org/2000/svg";

  const leftEye = document.createElementNS(ns, "ellipse");
  leftEye.setAttribute("cx", String(-r * 0.32));
  leftEye.setAttribute("cy", String(-r * 0.15));
  leftEye.setAttribute("rx", String(r * 0.12));
  leftEye.setAttribute("ry", String(r * 0.16));
  leftEye.setAttribute("fill", "#241f2e");
  g.appendChild(leftEye);

  const rightEye = document.createElementNS(ns, "line");
  rightEye.setAttribute("x1", String(r * 0.16));
  rightEye.setAttribute("y1", String(-r * 0.15));
  rightEye.setAttribute("x2", String(r * 0.46));
  rightEye.setAttribute("y2", String(-r * 0.15));
  rightEye.setAttribute("stroke", "#241f2e");
  rightEye.setAttribute("stroke-width", String(r * 0.09));
  rightEye.setAttribute("stroke-linecap", "round");
  g.appendChild(rightEye);

  const mouth = document.createElementNS(ns, "path");
  mouth.setAttribute(
    "d",
    `M ${(-r * 0.28).toFixed(2)} ${(r * 0.32).toFixed(2)} Q 0 ${(r * 0.5).toFixed(2)} ${(r * 0.28).toFixed(2)} ${(r * 0.32).toFixed(2)}`,
  );
  mouth.setAttribute("fill", "none");
  mouth.setAttribute("stroke", "#241f2e");
  mouth.setAttribute("stroke-width", String(r * 0.08));
  mouth.setAttribute("stroke-linecap", "round");
  g.appendChild(mouth);
}
