import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { pointOnRoundedRect, smoothClosedPath, type Vec2 } from "./blobMath";
import {
  applyShapeMatching,
  collideWalls,
  createBlobMesh,
  integrate,
  resetMeshShape,
  ringSpan,
  satisfyConstraints,
  type BlobMesh,
  type Pull,
} from "./blobPhysics";

/**
 * Ditto is a real soft-body mesh (see blobPhysics): a ring of point-masses
 * connected to each other and to a center point, with one perimeter node
 * (the "anchor", at the top) pulled toward the cursor each frame — like the
 * cursor is pinching that one point and dragging the rest of the body
 * along through the mesh's own constraints. Gravity, the pendulum-like sway
 * when moving fast, and the jelly jiggle after a sudden stop are all
 * emergent from that — nothing about the shape is scripted per frame.
 *
 * Hovering a `[data-blob-target]` element blends the pulls: the anchor's
 * cursor-pull fades out while every perimeter node gains its own pull
 * toward a point on the element's rounded-rect perimeter, molding the mesh
 * onto it. Two flavors, by the attribute's value:
 * - `data-blob-target` / `="shape"`: solid, full opacity — Ditto "becomes"
 *   that control (nav tabs, artwork tiles).
 * - `data-blob-target="text"`: low opacity, and the element's own text
 *   recolors to the ditto color — Ditto "attaches" without hiding it.
 *
 * Every node collides with the terrarium's inner bounds every frame (see
 * `[data-terrarium-bounds]`) — Ditto cannot cross the walls.
 */

const PERIMETER_COUNT = 14;
const REST_RADIUS = 58;
const NODE_MASS = 1;
const CENTER_MASS = 2.2;

// Fraction of each constraint's distance error corrected per relaxation
// iteration (see satisfyConstraints) — lower reads squishier, higher reads
// more rigid. Tuned well below 1 on purpose: Ditto should visibly jiggle.
const RING_STIFFNESS = 0.3;
const SPOKE_STIFFNESS = 0.22;
const BEND_STIFFNESS = 0.15;
const CONSTRAINT_ITERATIONS = 5;
// Pulls the ring toward a rigidly-rotated copy of its rest shape every
// frame (see blobPhysics.applyShapeMatching) — this is what actually stops
// it from folding on itself; bend constraints alone weren't enough. Kept
// low so it reads as "stay coherent" rather than "stay rigid". Faded out
// during hover-mold (scaled by 1-blend below) so it doesn't fight molding
// into a rectangle.
const SHAPE_MATCH_STIFFNESS = 0.2;

const ANCHOR_PULL_STRENGTH = 0.35;
const HOVER_PULL_STRENGTH = 0.45;

const GRAVITY = 0.9; // position nudge per frame (Verlet — see blobPhysics.integrate)
const DAMPING = 0.965; // fraction of Verlet-derived velocity retained per frame
const MAX_STEP = 60; // px/frame safety clamp on the Verlet position delta

const WALL_MARGIN = 10;

// If the ring's bounding box ever exceeds this, treat it as a collapsed/
// degenerate shape and snap back to a clean circle rather than render a
// visibly broken sliver (see resetMeshShape and its call site below).
const MAX_SANE_SPAN = REST_RADIUS * 6;

// A few fixed, asymmetric nubs on specific perimeter nodes — Ditto's stubby
// ragdoll limbs — expressed as extra rest length on that node's spoke.
const LIMB_BUMPS = [
  { index: 3, amount: 19 },
  { index: 7, amount: 15 },
  { index: 10, amount: 18 },
];

const SHAPE_CORNER_RADIUS = 16;
const TEXT_CORNER_RADIUS = 8;
const SHAPE_FILL_OPACITY = 1;
const TEXT_FILL_OPACITY = 0.3;
const HOVER_IN_DURATION = 0.18;
const HOVER_OUT_DURATION = 0.5;

// Keep in sync with the --color-ditto* tokens in index.css.
const REST_COLOR = "#f0abfc";
const HOVER_COLOR = "#c026d3";

type HoverMode = "shape" | "text";

function readHoverMode(el: Element): HoverMode {
  return el.getAttribute("data-blob-target") === "text" ? "text" : "shape";
}

function getTerrariumRect(): DOMRect | null {
  const el = document.querySelector("[data-terrarium-bounds]");
  return el ? el.getBoundingClientRect() : null;
}

export function BlobCursor() {
  const svgRef = useRef<SVGSVGElement>(null);
  const pathRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    // Touch devices keep their native cursor — there's no hover to chase.
    const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!supportsHover) return;

    const svgEl = svgRef.current;
    const pathEl = pathRef.current;
    if (!svgEl || !pathEl) return;
    // Reassigned to satisfy TS narrowing inside the closures below.
    const svg: SVGSVGElement = svgEl;
    const path: SVGPathElement = pathEl;

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "none";

    const setViewport = () => {
      svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    };
    setViewport();

    let wallRect = getTerrariumRect();
    const handleResize = () => {
      setViewport();
      wallRect = getTerrariumRect();
    };

    const mouse: Vec2 = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let hasMouse = false;
    let hoverEl: Element | null = null;
    let hoverMode: HoverMode = "shape";
    let tintedEl: HTMLElement | null = null;

    // A managed "ghost label": a plain white copy of a covered button's
    // text, appended directly to <body> so it's a sibling of this SVG at
    // the top level. This is necessary, not cosmetic — TabBar's own wrapper
    // has `position: absolute; z-index: 50`, which creates a stacking
    // context, and CSS confines a descendant's z-index to *within* its
    // nearest ancestor stacking context. No z-index on the button itself
    // could ever out-rank this SVG's z-999, because the whole TabBar div is
    // compared against it as one z-50 unit. Rendering the label as this
    // SVG's own sibling sidesteps that entirely.
    const labelEl = document.createElement("div");
    labelEl.setAttribute("aria-hidden", "true");
    Object.assign(labelEl.style, {
      position: "fixed",
      zIndex: "1000",
      pointerEvents: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      color: "#ffffff",
      opacity: "0",
      transition: "opacity 0.15s ease",
      whiteSpace: "nowrap",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(labelEl);
    let labelTarget: HTMLElement | null = null;

    function syncLabel(target: HTMLElement) {
      const rect = target.getBoundingClientRect();
      const cs = getComputedStyle(target);
      labelEl.style.left = `${rect.left}px`;
      labelEl.style.top = `${rect.top}px`;
      labelEl.style.width = `${rect.width}px`;
      labelEl.style.height = `${rect.height}px`;
      labelEl.style.fontFamily = cs.fontFamily;
      labelEl.style.fontSize = cs.fontSize;
      labelEl.style.fontWeight = cs.fontWeight;
      labelEl.style.letterSpacing = cs.letterSpacing;
      labelEl.textContent = target.textContent;
    }

    const mesh: BlobMesh = createBlobMesh(
      mouse.x,
      mouse.y,
      REST_RADIUS,
      PERIMETER_COUNT,
      LIMB_BUMPS,
      { ringStiffness: RING_STIFFNESS, spokeStiffness: SPOKE_STIFFNESS, bendStiffness: BEND_STIFFNESS },
      NODE_MASS,
      CENTER_MASS,
    );

    const hoverBlend = { value: 0 };
    let blendTween: gsap.core.Tween | null = null;

    function clearTint() {
      if (!tintedEl) return;
      tintedEl.style.color = "";
      tintedEl = null;
    }

    function hideLabel() {
      labelEl.style.opacity = "0";
      labelTarget = null;
    }

    function morphTo(target: Element | null) {
      if (target === hoverEl) return;
      hoverEl = target;
      hoverMode = target ? readHoverMode(target) : "shape";

      blendTween?.kill();
      blendTween = gsap.to(hoverBlend, {
        value: target ? 1 : 0,
        duration: target ? HOVER_IN_DURATION : HOVER_OUT_DURATION,
        ease: target ? "power2.out" : "back.out(1.6)",
      });

      const fillColor = target ? HOVER_COLOR : REST_COLOR;
      const fillOpacity = target && hoverMode === "text" ? TEXT_FILL_OPACITY : SHAPE_FILL_OPACITY;
      gsap.to(path, {
        attr: { fill: fillColor, "fill-opacity": fillOpacity },
        duration: 0.18,
        ease: "power1.out",
      });

      if (target instanceof HTMLElement && hoverMode === "text") {
        hideLabel();
        clearTint();
        target.style.transition = "color 0.18s ease";
        target.style.color = HOVER_COLOR;
        tintedEl = target;
      } else if (target instanceof HTMLButtonElement) {
        // Shape mode covers the element solidly — its own label would
        // vanish under Ditto's fill without this. A plain tint can't fix
        // it (see the ghost-label comment above), so swap in the overlay.
        clearTint();
        labelTarget = target;
        syncLabel(target);
        labelEl.style.opacity = "1";
      } else if (target instanceof HTMLElement) {
        // Other shape targets (e.g. artwork tiles): fall back to a plain
        // tint. It won't reach a child's own explicit color class (artwork
        // captions set their own), but it's harmless and better than
        // nothing for simple cases.
        hideLabel();
        clearTint();
        target.style.transition = "color 0.18s ease";
        target.style.color = "#ffffff";
        tintedEl = target;
      } else {
        hideLabel();
        clearTint();
      }
    }

    function handlePointerMove(e: PointerEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      hasMouse = true;
    }

    function handlePointerOver(e: PointerEvent) {
      const target = (e.target as Element | null)?.closest?.("[data-blob-target]") ?? null;
      if (!target) return;
      morphTo(target);
    }

    function handlePointerOut(e: PointerEvent) {
      const target = (e.target as Element | null)?.closest?.("[data-blob-target]") ?? null;
      if (!target || target !== hoverEl) return;
      const related = e.relatedTarget as Element | null;
      if (related && target.contains(related)) return;
      morphTo(null);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerover", handlePointerOver);
    document.addEventListener("pointerout", handlePointerOut);
    window.addEventListener("resize", handleResize);

    path.setAttribute("fill", REST_COLOR);
    path.setAttribute("fill-opacity", String(SHAPE_FILL_OPACITY));

    const ring: Vec2[] = mesh.perimeter.map((i) => ({ x: mesh.nodes[i].x, y: mesh.nodes[i].y }));

    let frameId: number;
    let visible = false;
    function tick() {
      const rect = hoverEl ? hoverEl.getBoundingClientRect() : null;
      const blend = Math.max(0, Math.min(1, hoverBlend.value));
      const cornerRadius = hoverMode === "text" ? TEXT_CORNER_RADIUS : SHAPE_CORNER_RADIUS;
      const anchorTarget = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : mouse;

      const pulls: Pull[] = [];
      const cursorStrength = ANCHOR_PULL_STRENGTH * (1 - blend);
      if (cursorStrength > 0.001) {
        pulls.push({ nodeIndex: mesh.anchorIndex, x: anchorTarget.x, y: anchorTarget.y, strength: cursorStrength });
      }
      if (rect && blend > 0.001) {
        for (let i = 0; i < mesh.perimeter.length; i++) {
          const t = i / mesh.perimeter.length;
          const target = pointOnRoundedRect(rect, cornerRadius, t);
          pulls.push({ nodeIndex: mesh.perimeter[i], x: target.x, y: target.y, strength: HOVER_PULL_STRENGTH * blend });
        }
      }

      integrate(mesh, GRAVITY, DAMPING, MAX_STEP);
      satisfyConstraints(mesh, pulls, CONSTRAINT_ITERATIONS);
      applyShapeMatching(mesh, SHAPE_MATCH_STIFFNESS * (1 - blend));
      if (wallRect) collideWalls(mesh, wallRect, WALL_MARGIN);

      const span = ringSpan(mesh);
      if (span.width > MAX_SANE_SPAN || span.height > MAX_SANE_SPAN) {
        resetMeshShape(mesh, anchorTarget.x, anchorTarget.y, REST_RADIUS, LIMB_BUMPS);
      }

      for (let i = 0; i < mesh.perimeter.length; i++) {
        const node = mesh.nodes[mesh.perimeter[i]];
        ring[i].x = node.x;
        ring[i].y = node.y;
      }
      path.setAttribute("d", smoothClosedPath(ring));

      // Keep the ghost label glued to its button in case of any layout
      // shift while hovering (e.g. a panel-open animation moving things).
      if (labelTarget) syncLabel(labelTarget);

      // Avoid a flash of the blob sitting at the viewport center before the
      // first real pointer position arrives.
      if (hasMouse !== visible) {
        visible = hasMouse;
        svg.style.opacity = visible ? "1" : "0";
      }

      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      blendTween?.kill();
      clearTint();
      labelEl.remove();
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      window.removeEventListener("resize", handleResize);
      document.body.style.cursor = previousCursor;
    };
  }, []);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[999] h-screen w-screen opacity-0 transition-opacity duration-200"
    >
      <path ref={pathRef} />
    </svg>
  );
}
