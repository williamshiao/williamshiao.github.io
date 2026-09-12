/**
 * A real soft-body mesh — a ring of point-masses connected to each other
 * and to a center point, deforming as a connected structure rather than
 * being individually scripted — using Verlet integration with iterative
 * position-based distance constraints (the classic Jakobsen "Advanced
 * Character Physics" technique: https://www.gamedev.net/tutorials/programming/general-and-gameplay-programming/advanced-character-physics-r2492/).
 * This is what most robust cloth/soft-body web demos actually use, and for
 * good reason: an earlier version of this file used Hooke's-law spring
 * forces integrated with velocity, which is straightforward to get
 * unstable (a stiff spring's force can spike faster than damping removes
 * it, and velocity keeps compounding). Verlet+PBD sidesteps that whole
 * failure class — there's no force or velocity to spike. Each constraint
 * just nudges its two points a bounded fraction of the way toward the
 * right distance, every iteration; it is structurally very hard to make
 * that diverge.
 *
 * One perimeter node (the "anchor") is pulled toward the cursor — also
 * expressed as a position nudge, not a force — like the cursor is pinching
 * that one point of the body and dragging it around, and the rest of the
 * mesh follows through its own constraints.
 */

export interface MeshNode {
  x: number;
  y: number;
  /** Previous position — Verlet integration derives velocity from this instead of tracking it explicitly. */
  px: number;
  py: number;
  invMass: number;
}

interface DistanceConstraint {
  a: number;
  b: number;
  restLength: number;
  /** Fraction of the distance error corrected per relaxation iteration (0..1). Lower = squishier, higher = more rigid. */
  stiffness: number;
}

export interface BlobMesh {
  nodes: MeshNode[];
  constraints: DistanceConstraint[];
  /** Indices into `nodes` for the ring, in perimeter order (for rendering). */
  perimeter: number[];
  centerIndex: number;
  /** The perimeter node the cursor pinches and drags. */
  anchorIndex: number;
}

export interface RingBump {
  /** Perimeter node index this bump centers on. */
  index: number;
  /** Extra rest length added to that node's spoke. */
  amount: number;
}

export interface MeshSpringConfig {
  ringStiffness: number;
  spokeStiffness: number;
  /** Connects each perimeter node to its next-nearest neighbor (i to i+2).
   * Plain neighbor + spoke distance constraints don't stop the ring from
   * folding inside-out under a strong asymmetric pull — nothing in that
   * constraint set actually requires it stay a simple, non-self-crossing
   * loop, and an iterative solver can walk into a "doubled-back" line that
   * satisfies most individual distances well enough. Bend constraints add
   * resistance to exactly that local fold. */
  bendStiffness: number;
}

export function createBlobMesh(
  centerX: number,
  centerY: number,
  restRadius: number,
  perimeterCount: number,
  bumps: RingBump[],
  config: MeshSpringConfig,
  nodeMass: number,
  centerMass: number,
): BlobMesh {
  const nodes: MeshNode[] = [{ x: centerX, y: centerY, px: centerX, py: centerY, invMass: 1 / centerMass }];
  const perimeter: number[] = [];

  const bumpAt = (i: number) => bumps.find((b) => b.index === i)?.amount ?? 0;

  for (let i = 0; i < perimeterCount; i++) {
    const angle = (i / perimeterCount) * Math.PI * 2 - Math.PI / 2; // start at the top
    const r = restRadius + bumpAt(i);
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    nodes.push({ x, y, px: x, py: y, invMass: 1 / nodeMass });
    perimeter.push(i + 1); // +1 for the center node at index 0
  }

  const constraints: DistanceConstraint[] = [];
  for (const idx of perimeter) {
    const restLength = Math.hypot(nodes[idx].x - centerX, nodes[idx].y - centerY);
    constraints.push({ a: 0, b: idx, restLength, stiffness: config.spokeStiffness });
  }
  for (let i = 0; i < perimeterCount; i++) {
    const a = perimeter[i];
    const b = perimeter[(i + 1) % perimeterCount];
    const restLength = Math.hypot(nodes[b].x - nodes[a].x, nodes[b].y - nodes[a].y);
    constraints.push({ a, b, restLength, stiffness: config.ringStiffness });
  }
  for (let i = 0; i < perimeterCount; i++) {
    const a = perimeter[i];
    const b = perimeter[(i + 2) % perimeterCount];
    const restLength = Math.hypot(nodes[b].x - nodes[a].x, nodes[b].y - nodes[a].y);
    constraints.push({ a, b, restLength, stiffness: config.bendStiffness });
  }

  return { nodes, constraints, perimeter, centerIndex: 0, anchorIndex: perimeter[0] };
}

/** Bounding-box span of the ring — used to detect a degenerate/collapsed shape. */
export function ringSpan(mesh: BlobMesh): { width: number; height: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const i of mesh.perimeter) {
    const n = mesh.nodes[i];
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }
  return { width: maxX - minX, height: maxY - minY };
}

/**
 * Snaps every node back to a fresh circular arrangement around `centerX,
 * centerY` (constraints/rest-lengths are untouched — this only resets
 * positions), zeroing implied Verlet velocity. A last-resort safety net:
 * if the ring's bounding box ever exceeds a sane multiple of its rest
 * radius, call this instead of letting a visibly broken shape render. See
 * the call site in BlobCursor for when that triggers.
 */
export function resetMeshShape(mesh: BlobMesh, centerX: number, centerY: number, restRadius: number, bumps: RingBump[]) {
  const bumpAt = (i: number) => bumps.find((b) => b.index === i)?.amount ?? 0;
  const center = mesh.nodes[mesh.centerIndex];
  center.x = centerX;
  center.y = centerY;
  center.px = centerX;
  center.py = centerY;
  for (let i = 0; i < mesh.perimeter.length; i++) {
    const angle = (i / mesh.perimeter.length) * Math.PI * 2 - Math.PI / 2;
    const r = restRadius + bumpAt(i);
    const x = centerX + Math.cos(angle) * r;
    const y = centerY + Math.sin(angle) * r;
    const node = mesh.nodes[mesh.perimeter[i]];
    node.x = x;
    node.y = y;
    node.px = x;
    node.py = y;
  }
}

export interface Pull {
  nodeIndex: number;
  x: number;
  y: number;
  /** Fraction of the remaining distance closed per relaxation iteration. */
  strength: number;
}

/** Verlet position update: derives velocity from (current - previous) position, so damping and gravity are just position nudges — no explicit velocity to blow up. Call once per frame. */
export function integrate(mesh: BlobMesh, gravity: number, damping: number, maxStep: number) {
  for (const node of mesh.nodes) {
    let vx = (node.x - node.px) * damping;
    let vy = (node.y - node.py) * damping + gravity;
    const speed = Math.hypot(vx, vy);
    if (speed > maxStep) {
      const scale = maxStep / speed;
      vx *= scale;
      vy *= scale;
    }
    node.px = node.x;
    node.py = node.y;
    node.x += vx;
    node.y += vy;
  }
}

/** Relaxes every distance constraint (and any external pulls) toward being satisfied, `iterations` times. More iterations = stiffer/more coherent; fewer = squishier. */
export function satisfyConstraints(mesh: BlobMesh, pulls: Pull[], iterations: number) {
  for (let iter = 0; iter < iterations; iter++) {
    for (const c of mesh.constraints) {
      const a = mesh.nodes[c.a];
      const b = mesh.nodes[c.b];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      // Floor `dist` well above 0 — the correction below divides by it, and
      // as two connected nodes approach coincidence that division explodes
      // toward infinity in a single step, flinging both nodes to
      // nonsensical positions. A 1px floor keeps the correction bounded
      // (equivalent to just pushing the two apart along an arbitrary axis
      // once they're this close) instead of blowing up.
      const dist = Math.max(Math.hypot(dx, dy), 1);
      const diff = ((dist - c.restLength) / dist) * c.stiffness;
      const totalInvMass = a.invMass + b.invMass || 1;
      // Also cap the correction's own magnitude as a second safety net —
      // no single relaxation pass should move a node further than its
      // constraint's rest length in one go.
      const maxCorrection = c.restLength;
      const correctionX = Math.max(-maxCorrection, Math.min(maxCorrection, dx * diff));
      const correctionY = Math.max(-maxCorrection, Math.min(maxCorrection, dy * diff));
      a.x += (correctionX * a.invMass) / totalInvMass;
      a.y += (correctionY * a.invMass) / totalInvMass;
      b.x -= (correctionX * b.invMass) / totalInvMass;
      b.y -= (correctionY * b.invMass) / totalInvMass;
    }
    for (const pull of pulls) {
      const node = mesh.nodes[pull.nodeIndex];
      node.x += (pull.x - node.x) * pull.strength;
      node.y += (pull.y - node.y) * pull.strength;
    }
  }
}

/** Per-node AABB collision against a wall rect — Ditto cannot cross it. */
export function collideWalls(mesh: BlobMesh, wall: DOMRect, margin: number) {
  const minX = wall.left + margin;
  const maxX = wall.right - margin;
  const minY = wall.top + margin;
  const maxY = wall.bottom - margin;
  for (const node of mesh.nodes) {
    if (node.x < minX) node.x = minX;
    else if (node.x > maxX) node.x = maxX;
    if (node.y < minY) node.y = minY;
    else if (node.y > maxY) node.y = maxY;
  }
}
