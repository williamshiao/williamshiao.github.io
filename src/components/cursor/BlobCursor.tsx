import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { pointOnRoundedRect, smoothClosedPath, type Vec2 } from "./blobMath";

/**
 * The blob is a ring of points, each independently spring-chasing a target,
 * rendered as one smooth closed path (see blobMath). Two target functions:
 *
 * - Idle: every point targets a position offset from the mouse by an angle
 *   around a teardrop-shaped radius function — tight near the top (the
 *   "pinch" where the cursor holds it) and bulging at the bottom. Per-point
 *   spring stiffness follows the same top->bottom gradient (tight/fast at
 *   the top, loose/laggy at the bottom), which is this implementation's take
 *   on the brief's "leading points target the mouse, trailing points lag
 *   behind" — instead of a literal point-to-point chain, lag is expressed as
 *   a stiffness gradient around one ring, which stays well-defined when the
 *   same ring later needs to mold onto a rectangle. A constant gravity
 *   accel is added every frame (idle only); since spring force at
 *   equilibrium is stiffness * offset, the already-loose bottom points sag
 *   further under the same constant force — gravity and lag reinforce each
 *   other for free.
 * - Hover: every point targets an arc-length-even position on the hovered
 *   element's rounded-rect perimeter, with a single higher uniform
 *   stiffness (no gravity) so it snaps into the shape and holds it.
 *
 * A transient stiffness multiplier spikes on every mode change (hover
 * in/out) and decays back down — that's the "rapidly molds" snap and the
 * "pops back" on release.
 */

const POINT_COUNT = 12;
const REST_RADIUS_MIN = 9;
const REST_RADIUS_MAX = 30;
const REST_CENTER_OFFSET_Y = 12;
const HOVER_CORNER_RADIUS = 16;
const STIFFNESS_TOP = 0.34;
const STIFFNESS_BOTTOM = 0.09;
const HOVER_STIFFNESS = 0.4;
const DAMPING = 0.76;
const GRAVITY = 0.55;
const MAX_SPEED = 100; // px/frame safety clamp — see the comment at its use below

// Keep in sync with the --color-ditto* tokens in index.css.
const REST_COLOR = "#f0abfc";
const HOVER_COLOR = "#c026d3";

interface RingPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
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
    // Reassigned to satisfy TS narrowing inside the tick()/setViewport() closures below.
    const svg: SVGSVGElement = svgEl;
    const path: SVGPathElement = pathEl;

    const previousCursor = document.body.style.cursor;
    document.body.style.cursor = "none";

    const setViewport = () => {
      svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    };
    setViewport();

    const mouse: Vec2 = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let hasMouse = false;
    let hoverEl: Element | null = null;

    const stiffnessMultiplier = { value: 1 };
    let boostTween: gsap.core.Tween | null = null;

    const points: RingPoint[] = Array.from({ length: POINT_COUNT }, () => ({
      x: mouse.x,
      y: mouse.y,
      vx: 0,
      vy: 0,
    }));

    function idleTarget(index: number): Vec2 {
      const angle = (index / POINT_COUNT) * Math.PI * 2;
      const downFactor = (Math.sin(angle) + 1) / 2; // 0 at top, 1 at bottom
      const radius = REST_RADIUS_MIN + (REST_RADIUS_MAX - REST_RADIUS_MIN) * Math.pow(downFactor, 1.4);
      return {
        x: mouse.x + Math.cos(angle) * radius,
        y: mouse.y + REST_CENTER_OFFSET_Y + Math.sin(angle) * radius,
      };
    }

    function stiffnessFor(index: number): number {
      if (hoverEl) return HOVER_STIFFNESS * stiffnessMultiplier.value;
      const angle = (index / POINT_COUNT) * Math.PI * 2;
      const downFactor = (Math.sin(angle) + 1) / 2;
      const base = STIFFNESS_TOP + (STIFFNESS_BOTTOM - STIFFNESS_TOP) * downFactor;
      return base * stiffnessMultiplier.value;
    }

    function targetFor(index: number): Vec2 {
      if (hoverEl) {
        const rect = hoverEl.getBoundingClientRect();
        return pointOnRoundedRect(rect, HOVER_CORNER_RADIUS, index / POINT_COUNT);
      }
      return idleTarget(index);
    }

    function morphTo(target: Element | null) {
      if (target === hoverEl) return;
      hoverEl = target;

      boostTween?.kill();
      stiffnessMultiplier.value = 1.7;
      boostTween = gsap.to(stiffnessMultiplier, { value: 1, duration: 0.35, ease: "power2.out" });

      gsap.to(path, {
        attr: { fill: target ? HOVER_COLOR : REST_COLOR },
        duration: 0.18,
        ease: "power1.out",
      });
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
    window.addEventListener("resize", setViewport);

    path.setAttribute("fill", REST_COLOR);

    let frameId: number;
    let visible = false;
    function tick() {
      for (let i = 0; i < POINT_COUNT; i++) {
        const p = points[i];
        const t = targetFor(i);
        const k = stiffnessFor(i);
        p.vx += (t.x - p.x) * k;
        p.vy += (t.y - p.y) * k;
        if (!hoverEl) p.vy += GRAVITY * (1 - k / STIFFNESS_TOP); // looser points sag more
        p.vx *= DAMPING;
        p.vy *= DAMPING;
        // Guards against a pathological whip/stretch if the target ever jumps a
        // long distance in one frame (e.g. the tab regaining focus after being
        // backgrounded with a stale mouse position, or a monitor-spanning flick).
        const speed = Math.hypot(p.vx, p.vy);
        if (speed > MAX_SPEED) {
          const scale = MAX_SPEED / speed;
          p.vx *= scale;
          p.vy *= scale;
        }
        p.x += p.vx;
        p.y += p.vy;
      }
      path.setAttribute("d", smoothClosedPath(points));

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
      boostTween?.kill();
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerover", handlePointerOver);
      document.removeEventListener("pointerout", handlePointerOut);
      window.removeEventListener("resize", setViewport);
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
