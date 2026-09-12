import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import {
  DEFAULT_LIMB_BUMPS,
  pointOnRoundedRect,
  smoothClosedPath,
  teardropRingPoint,
  type Vec2,
} from "./blobMath";

/**
 * Ditto's idle shape comes from two physics points, not many independent
 * ones (see blobMath's comment for why): a "head" that tracks the cursor
 * fairly closely, and a "body" that hangs below it on a much softer spring.
 * When the head moves quickly, the body — heavier, more damped — falls
 * behind and to the side, tilting the head->body "spine" off vertical.
 * That tilt is what reads as Ditto swaying from the cursor's momentum
 * (a plumb bob effect) instead of the whole outline rippling.
 *
 * A ring of points is generated fresh every frame from that spine (teardrop
 * width profile + a few fixed limb bumps, see blobMath), so there's no
 * per-outline-point lag to fight — only the head/body pair carries physics.
 *
 * Hovering a `[data-blob-target]` element blends the ring (via a single
 * eased 0->1 value, not per-point springs) from that idle shape to the
 * element's rounded-rect perimeter, and eases back on leave.
 */

const POINT_COUNT = 20;
const BASE_RADIUS = 19; // half-width of the teardrop at its widest
const REST_DROOP = 64; // idle head-to-body distance — taller than wide, a hanging drop
const MIN_SPINE = REST_DROOP * 0.65;
const MAX_SPINE = REST_DROOP * 1.35;

const HEAD_STIFFNESS = 0.3;
const HEAD_DAMPING = 0.82;
const BODY_STIFFNESS = 0.045;
const BODY_DAMPING = 0.9;
const MAX_SPEED = 120; // px/frame safety clamp against pathological jumps

const HOVER_CORNER_RADIUS = 16;
const HOVER_IN_DURATION = 0.18;
const HOVER_OUT_DURATION = 0.5;

// Keep in sync with the --color-ditto* tokens in index.css.
const REST_COLOR = "#f0abfc";
const HOVER_COLOR = "#c026d3";

interface SpringPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function springStep(p: SpringPoint, targetX: number, targetY: number, stiffness: number, damping: number) {
  p.vx += (targetX - p.x) * stiffness;
  p.vy += (targetY - p.y) * stiffness;
  p.vx *= damping;
  p.vy *= damping;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed;
    p.vx *= scale;
    p.vy *= scale;
  }
  p.x += p.vx;
  p.y += p.vy;
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

    const head: SpringPoint = { x: mouse.x, y: mouse.y, vx: 0, vy: 0 };
    const body: SpringPoint = { x: mouse.x, y: mouse.y + REST_DROOP, vx: 0, vy: 0 };

    const hoverBlend = { value: 0 };
    let blendTween: gsap.core.Tween | null = null;

    function morphTo(target: Element | null) {
      if (target === hoverEl) return;
      hoverEl = target;

      blendTween?.kill();
      blendTween = gsap.to(hoverBlend, {
        value: target ? 1 : 0,
        duration: target ? HOVER_IN_DURATION : HOVER_OUT_DURATION,
        ease: target ? "power2.out" : "back.out(1.6)",
      });

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

    const ring: Vec2[] = Array.from({ length: POINT_COUNT }, () => ({ x: head.x, y: head.y }));

    let frameId: number;
    let visible = false;
    function tick() {
      const rect = hoverEl ? hoverEl.getBoundingClientRect() : null;

      // Head chases the cursor (or the hovered element's center); body
      // chases a fixed offset below the head's *current* position, on a
      // much softer spring — that lag is the sway.
      const headTargetX = rect ? rect.x + rect.width / 2 : mouse.x;
      const headTargetY = rect ? rect.y + rect.height / 2 : mouse.y;
      springStep(head, headTargetX, headTargetY, HEAD_STIFFNESS, HEAD_DAMPING);
      springStep(body, head.x, head.y + REST_DROOP, BODY_STIFFNESS, BODY_DAMPING);

      let dx = body.x - head.x;
      let dy = body.y - head.y;
      let len = Math.hypot(dx, dy);
      if (len < 0.0001) {
        dx = 0;
        dy = 1;
        len = 1;
      }
      const tailDir: Vec2 = { x: dx / len, y: dy / len };
      const spineLength = Math.max(MIN_SPINE, Math.min(MAX_SPINE, len));

      const blend = Math.max(0, Math.min(1, hoverBlend.value));

      for (let i = 0; i < POINT_COUNT; i++) {
        const idle = teardropRingPoint(i, POINT_COUNT, head, tailDir, spineLength, BASE_RADIUS, DEFAULT_LIMB_BUMPS);
        if (rect && blend > 0) {
          const onRect = pointOnRoundedRect(rect, HOVER_CORNER_RADIUS, i / POINT_COUNT);
          ring[i].x = idle.x + (onRect.x - idle.x) * blend;
          ring[i].y = idle.y + (onRect.y - idle.y) * blend;
        } else {
          ring[i].x = idle.x;
          ring[i].y = idle.y;
        }
      }

      path.setAttribute("d", smoothClosedPath(ring));

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
