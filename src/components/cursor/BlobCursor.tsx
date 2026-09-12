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
 * A small secondary "jiggle" scalar, kicked by sudden changes in the head's
 * velocity and spring-damped back to zero, pulses the body's radius —
 * that's the jelly/fluid wobble on top of the droop + sway.
 *
 * The head's target is clamped to the terrarium's inner bounds (see
 * `[data-terrarium-bounds]`) before the spring chases it, and the head's
 * resting position is hard-clamped there too as a backstop — Ditto cannot
 * cross the terrarium walls.
 *
 * Hovering a `[data-blob-target]` element blends the ring (via a single
 * eased 0->1 value, not per-point springs) from the idle shape to the
 * element's rounded-rect perimeter, and eases back on leave. Two flavors,
 * chosen by the attribute's value:
 * - `data-blob-target` / `="shape"`: Ditto solidly covers the element (nav
 *   tabs, artwork tiles) — he's "become" that control.
 * - `data-blob-target="text"`: Ditto hugs the text at low opacity (so it
 *   stays legible) and the text itself recolors to the ditto color — he's
 *   "attached" to it, not hiding it.
 */

const POINT_COUNT = 24;
const BASE_RADIUS = 27; // half-width of the teardrop at its widest
const REST_DROOP = 88; // idle head-to-body distance — taller than wide, a hanging drop
const MIN_SPINE = REST_DROOP * 0.65;
const MAX_SPINE = REST_DROOP * 1.35;

const HEAD_STIFFNESS = 0.3;
const HEAD_DAMPING = 0.82;
const BODY_STIFFNESS = 0.045;
const BODY_DAMPING = 0.87;
const MAX_SPEED = 140; // px/frame safety clamp against pathological jumps

// Jiggle: a 1D damped spring, kicked by sudden changes in the head's
// velocity (jerk), that pulses the body's effective radius — Ditto's
// jelly/surface-tension wobble after a sudden stop or direction change.
const JIGGLE_KICK = 0.05;
const JIGGLE_STIFFNESS = 0.22;
const JIGGLE_DAMPING = 0.8;
const JIGGLE_MAX = 0.4;

// Wall collision: how far the head is kept from the terrarium's inner edge,
// accounting for the body's typical extent below/beside it.
const WALL_MARGIN_X = BASE_RADIUS * 1.5;
const WALL_MARGIN_TOP = BASE_RADIUS * 0.6;
const WALL_MARGIN_BOTTOM = MAX_SPINE + BASE_RADIUS;

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
    // Reassigned to satisfy TS narrowing inside the tick()/setViewport() closures below.
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

    const head: SpringPoint = { x: mouse.x, y: mouse.y, vx: 0, vy: 0 };
    const body: SpringPoint = { x: mouse.x, y: mouse.y + REST_DROOP, vx: 0, vy: 0 };
    let jiggle = 0;
    let jiggleVel = 0;
    let prevHeadVx = 0;
    let prevHeadVy = 0;

    const hoverBlend = { value: 0 };
    let blendTween: gsap.core.Tween | null = null;

    function clearTint() {
      if (!tintedEl) return;
      tintedEl.style.color = "";
      tintedEl = null;
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
        clearTint();
        target.style.transition = "color 0.18s ease";
        target.style.color = HOVER_COLOR;
        tintedEl = target;
      } else {
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

    const ring: Vec2[] = Array.from({ length: POINT_COUNT }, () => ({ x: head.x, y: head.y }));

    let frameId: number;
    let visible = false;
    function tick() {
      const rect = hoverEl ? hoverEl.getBoundingClientRect() : null;

      // Head chases the cursor (or the hovered element's center), clamped to
      // the terrarium's inner bounds so it can't chase the mouse through a
      // wall.
      let headTargetX = rect ? rect.x + rect.width / 2 : mouse.x;
      let headTargetY = rect ? rect.y + rect.height / 2 : mouse.y;
      if (wallRect) {
        headTargetX = Math.min(
          Math.max(headTargetX, wallRect.left + WALL_MARGIN_X),
          wallRect.right - WALL_MARGIN_X,
        );
        headTargetY = Math.min(
          Math.max(headTargetY, wallRect.top + WALL_MARGIN_TOP),
          wallRect.bottom - WALL_MARGIN_BOTTOM,
        );
      }
      springStep(head, headTargetX, headTargetY, HEAD_STIFFNESS, HEAD_DAMPING);

      // Hard backstop in case spring overshoot would otherwise carry the
      // head past the wall — zero the outward velocity component so it
      // reads as a soft bump, not a rubber-band snap back.
      if (wallRect) {
        const minX = wallRect.left + WALL_MARGIN_X;
        const maxX = wallRect.right - WALL_MARGIN_X;
        const minY = wallRect.top + WALL_MARGIN_TOP;
        const maxY = wallRect.bottom - WALL_MARGIN_BOTTOM;
        if (head.x < minX) {
          head.x = minX;
          head.vx = Math.max(0, head.vx);
        } else if (head.x > maxX) {
          head.x = maxX;
          head.vx = Math.min(0, head.vx);
        }
        if (head.y < minY) {
          head.y = minY;
          head.vy = Math.max(0, head.vy);
        } else if (head.y > maxY) {
          head.y = maxY;
          head.vy = Math.min(0, head.vy);
        }
      }

      springStep(body, head.x, head.y + REST_DROOP, BODY_STIFFNESS, BODY_DAMPING);

      // Jiggle: excited by how sharply the head's velocity just changed,
      // pulled back to rest by its own small spring.
      const jerk = Math.hypot(head.vx - prevHeadVx, head.vy - prevHeadVy);
      prevHeadVx = head.vx;
      prevHeadVy = head.vy;
      jiggleVel += jerk * JIGGLE_KICK;
      jiggleVel += (0 - jiggle) * JIGGLE_STIFFNESS;
      jiggleVel *= JIGGLE_DAMPING;
      jiggle = Math.max(-JIGGLE_MAX, Math.min(JIGGLE_MAX, jiggle + jiggleVel));

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
      const jiggledRadius = BASE_RADIUS * (1 + jiggle);

      const blend = Math.max(0, Math.min(1, hoverBlend.value));
      const cornerRadius = hoverMode === "text" ? TEXT_CORNER_RADIUS : SHAPE_CORNER_RADIUS;

      for (let i = 0; i < POINT_COUNT; i++) {
        const idle = teardropRingPoint(i, POINT_COUNT, head, tailDir, spineLength, jiggledRadius, DEFAULT_LIMB_BUMPS);
        if (rect && blend > 0) {
          const onRect = pointOnRoundedRect(rect, cornerRadius, i / POINT_COUNT);
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
      clearTint();
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
