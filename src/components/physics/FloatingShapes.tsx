import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { generateShapes, type ShapeSpec } from "./shapes";
import {
  createDittoNodes,
  computeRestEdgeLengths,
  stepDittoBlob,
  appendDittoFace,
  DITTO_BODY_HALF_EXTENT_RATIO,
  type DittoBlobState,
} from "./dittoBlob";
import { STRINGS, type Lang } from "../../i18n/strings";

/**
 * A physics playground spanning one continuous, seamless plate (see
 * PlaygroundPlate): zero gravity, zero friction near the top — shapes drift
 * forever, bouncing elastically off the plate's walls, off each other, and
 * off the cursor, which is itself an invisible physical body. Scrolling
 * down engages gravity for as long as you're scrolled past a threshold
 * (scrolling back up disengages it — not a one-way latch): shapes settle
 * (restitution/friction both increase so they actually come to rest
 * instead of bouncing forever), and the cursor stops physically colliding
 * with them (it becomes a sensor — still tracked, just can't knock things
 * around) so you can actually point at and hover a settled shape without
 * shoving it out from under the cursor first.
 *
 * While gravity is engaged, the floor itself continuously tracks the
 * *current* viewport's bottom edge (clamped to the plate's actual bottom)
 * rather than sitting at a fixed document position — so settled shapes are
 * never left behind, scrolled out of view: scrolling down lets them keep
 * falling further, and scrolling up pushes the floor back up through them,
 * carrying them back into view.
 *
 * Two shape tiers (see ./shapes): a larger population of small decorative
 * ones, and a handful of significantly bigger `interactive` ones — only
 * those darken on hover once settled, since they're the ones meant to
 * eventually double as real page navigation.
 *
 * The page itself is only ever fully at the top or fully at the bottom —
 * one wheel gesture snap-scrolls the whole way there (see the wheel
 * listener below), rather than requiring continuous scrolling. Snapping
 * back up to the zero-g section also relaunches every shape upward on the
 * spot (see launchShapesUpward) so the "whimsical floating" feeling
 * restarts immediately instead of shapes just sitting wherever gravity
 * left them.
 *
 * Once at the bottom, scrolling becomes a timeline through every pageId
 * shape in turn (see pageShapeIndices/goToPageShape/goToHero, all in the
 * wheel listener below): down steps to the next one — closing whatever's
 * currently open and opening the next in the same motion, not two separate
 * close-then-click steps — up steps back, and stepping up from the very
 * first page returns to the hero. `pageIndex` (0 = hero, 1..N = which page)
 * is the one source of truth for where the timeline currently is, kept in
 * sync by manual clicks (see handlePointerDown) too, so scrolling
 * afterward always continues on from wherever a click just left off.
 *
 * Clicking any shape tagged with a `pageId` (see ./shapes — always forced
 * to `kind: "rect"`, so growing it never has to visibly snap from
 * round/triangular to rectangular the instant it starts) once settled
 * grows it in place — via Body.scale + Body.setPosition each frame, so
 * it's a real collider the whole time and physically shoves every other
 * shape out of the way as it expands — into a big rounded panel parked
 * at the center of the viewport, at which point the caller (see
 * onOpenPanel) renders that page's real content on top of it. Clicking
 * outside the panel reverses the animation and swaps the body back to
 * its original shape/size, dropping it back into normal gravity like
 * anything else. Its label (see createLabelElement) only starts its slow
 * fade-in the instant the shape actually touches the floor (a real
 * collisionStart against floorWall, see handleFloorCollision) — not the
 * instant gravity merely turns on, which happens while it's still
 * mid-air near the top of the fall. Labeling something before it can be
 * clicked would be confusing, and the extra beat of "falls, lands, *then*
 * lights up" reads as a much more deliberate reveal than a plain
 * opacity snap the moment gravity engages. The system cursor turns into
 * a pointer over anything that really does something on click (a pageId
 * shape, the switch, the glow button), not just anything that merely
 * darkens on hover. The Internships shape specifically also opens
 * *itself*, no click needed, the moment it collides with anything once
 * it's down on the second page (see handleInternshipsAutoOpen) — a
 * one-time demonstration that clicking a shape does something real,
 * rather than leaving a visitor to discover that on their own; Contact
 * (below) doesn't get that same auto-open, just the regular click.
 *
 * A second special shape — a small rocker-switch rectangle (see
 * makeLightSwitchShape) — toggles the site's night mode on click: flips
 * a `data-theme="dark"` attribute on <html>, which every color token in
 * index.css redefines, so it repaints the whole site without any
 * component needing to know night mode exists.
 *
 * Every shape (except the switch, which reads as UI chrome rather than a
 * toy) also emits a soft blurred glow in its own color, on a separate
 * layer *behind* the solid shapes — just a blurred, translucent, enlarged
 * copy of its own silhouette, composited normally (no blend mode). An
 * earlier version blended overlapping glows together via
 * `mix-blend-mode: plus-lighter` inside an isolated layer, which looked
 * nice but forced the browser to composite the whole glow layer in its
 * own isolated pass every frame — with several blurred, constantly-moving
 * elements that measurably cost frame rate, so it was removed in favor of
 * plain layered transparency.
 *
 * A third special shape — a light bulb (see makeGlowButtonShape/
 * spawnGlowButton) — toggles that whole glow layer on/off, the same
 * click path as the switch and the pageId panel.
 *
 * A second pageId shape, Contact, works exactly like Internships (see
 * above) — it's what an envelope shape and a `</>` code-badge shape used
 * to be, before they were folded into one real page instead of firing off
 * a mailto: link and a GitHub tab directly; see ../sections/Contact.tsx
 * for what's actually inside once it's open.
 *
 * One more: a little globe (see makeLanguageToggleShape/toggleLanguage)
 * flips the site's language — FloatingShapes owns reading/writing that
 * choice (localStorage, same as night mode/glow) and just reports the new
 * value up via onToggleLanguage so LanguageProvider (see
 * context/LanguageContext.tsx), which owns the actual translated copy,
 * knows to re-render.
 *
 * Matter.js (MIT) rather than custom code: rigid-body elastic collision
 * among several bodies is its home turf. Position/size/color are generated
 * fresh every load (see ./shapes) rather than fixed.
 */

const { Engine, Bodies, Body, Composite, Query, Events } = Matter;

const PLATE_SELECTOR = "[data-plate-bounds]";
// The element tagged with this (see Hero.tsx) gets a live white "knockout"
// copy painted above the shapes (see the setup effect below), clipped every
// frame to their current silhouettes.
const KNOCKOUT_SELECTOR = "[data-shape-knockout]";
// The knockout clip geometry (see createClipShapeElement/updateClipShapeElement)
// is drawn slightly *smaller* than the shape's actual silhouette. Even
// though its position/size math is exact, it's a CSS clip-path on a plain
// HTML element referencing an external SVG resource, which Chrome doesn't
// always repaint in perfect lockstep with the shape's own (differently
// scheduled) attribute update — a moving/rotating shape can show the white
// a frame behind, poking past its edge for an instant. Shrinking the clip
// keeps that slack safely inside the shape instead.
const KNOCKOUT_CLIP_SHRINK = 0.85;
const WALL_THICKNESS = 100; // generous, so fast bodies can't tunnel through on one big step
const CURSOR_RADIUS = 14;
const CURSOR_MASS = 60; // heavy relative to the shapes — a paddle, not another puck
// Small shapes drift slower than big ones — at the small tier's size,
// the same speed as the big shapes read as noticeably more frantic (a
// smaller object crossing the same distance in the same time just looks
// faster), especially once several of them start trading momentum in
// collisions.
const SPAWN_SPEED_SMALL = 1.2;
const SPAWN_SPEED_BIG = 2.2; // px/frame, initial drift speed

// Scrolling past this fraction of a viewport height engages gravity.
const GRAVITY_TRIGGER_FRACTION = 0.4;
// Floor tracking: kept a little above the literal bottom edge of the
// viewport, and its own movement is capped per frame (rather than jumping
// straight to the target) so a big scroll jump can't let it tunnel clean
// through a resting shape without a collision ever being detected.
const FLOOR_MARGIN = 24;
const MAX_FLOOR_STEP = 40;

// Strong enough that shapes actually reach the floor in a couple of
// seconds rather than drifting down for ages — matters a lot more now that
// scrolling doubles as a page-to-page timeline (see handleWheel): nobody
// wants to sit and wait for Internships to fall before it can auto-open.
const GRAVITY_Y = 4;
// Shapes bounce elastically off everything while floating (collisions
// never lose energy — ELASTIC_RESTITUTION/FRICTION), but a small amount
// of air resistance still bleeds a little speed out of the system over
// time. Without it, nothing ever removes energy: every bump off the
// cursor or another shape just keeps adding up, and the whole board
// gradually turns into a blur. This is deliberately much gentler than
// Matter's own default (0.01) — enough to cap that runaway buildup
// without ever visibly slowing shapes to a crawl on their own. SETTLE_*
// apply only while gravity is engaged, so shapes actually come to rest
// on the floor instead of bouncing forever; switching back reverts to
// these.
const ELASTIC_RESTITUTION = 1;
const ELASTIC_FRICTION = 0;
const ELASTIC_FRICTION_AIR = 0.006;
const SETTLE_RESTITUTION = 0.4;
const SETTLE_FRICTION = 0.06;
const SETTLE_FRICTION_AIR = 0.02;

const HOVER_FILTER = "brightness(0.72)";

// A labeled shape's reveal-on-landing is slow and deliberate; every other
// opacity change on it (hiding again, expand/shrink) stays snappy.
const LABEL_REVEAL_MS = 1400;
const LABEL_HIDE_MS = 200;
// Internships opens itself the instant it collides with anything on the
// second page (see handleInternshipsAutoOpen) — 0ms, not actually
// synchronous: it's still deferred a tick via setTimeout rather than
// called straight from the collision callback, since that callback runs
// *inside* Matter's own Engine.update, and beginExpand mutates the world
// (swaps the body) — doing that reentrantly, mid-step, is asking for
// trouble. A macrotask later is still well within the same frame the user
// sees, so it reads as instant.
const AUTO_EXPAND_DELAY_MS = 0;

// Every shape's soft color glow — see the intro comment for how the
// overlap-blending actually works. Modeled on the Hero's own background
// glow blobs (see Hero.tsx: huge blur relative to size, low opacity) so
// it reads as the same kind of soft ambient light, not a crisp colored
// ring — bigger shapes get a proportionally wider blur so it still fades
// out fully rather than looking like a smaller, tighter version.
const GLOW_SCALE = 1.45;
const GLOW_OPACITY = 0.22;
const GLOW_BLUR_SMALL = 16;
const GLOW_BLUR_BIG = 34;

// One wheel notch/flick snaps the whole way to the other section — smooth,
// not instant, and not a fast snap either.
const SNAP_DURATION_MS = 900;
// Swallows the trailing inertial wheel events a trackpad keeps firing after
// the finger lifts, so momentum from the gesture that just landed can't
// immediately trigger another one.
const SNAP_COOLDOWN_MS = 250;
const WHEEL_DEADZONE = 4;
// Upward relaunch speed range (px/frame) when snapping back to zero-g.
const LAUNCH_SPEED_MIN = 9;
const LAUNCH_SPEED_MAX = 16;

// The expand/shrink panel animation and its resting size, capped so it
// never gets absurd on a huge monitor. Closing is deliberately much
// quicker than opening — opening is the reveal, worth lingering on;
// closing (including the shrink half of a page-to-page swap, see
// goToPageShape) is just clearing the way for what's next, and dragging
// that out only makes the whole timeline feel sluggish to navigate.
const PANEL_OPEN_DURATION_MS = 650;
const PANEL_CLOSE_DURATION_MS = 260;
const PANEL_MAX_WIDTH = 760;
const PANEL_MAX_HEIGHT = 640;
const PANEL_RADIUS = 32;

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getDocRect(selector: string): DOMRect | null {
  const el = document.querySelector(selector);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return new DOMRect(r.left + window.scrollX, r.top + window.scrollY, r.width, r.height);
}

function regularPolygonVertices(sides: number, radius: number, rotationOffset = -Math.PI / 2) {
  const verts: Matter.Vector[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = rotationOffset + (i / sides) * Math.PI * 2;
    verts.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return verts;
}

/** One shape's silhouette as a plain SVG geometry element for use inside a
 * <clipPath> (see the knockout setup below) — every kind maps to the shape
 * it can actually be touched/overlapped by (mirrors createShapeBody's kind
 * → collider-shape mapping) rather than its drawn icon, since e.g. the
 * switch/envelope/code-badge/globe are all bespoke icons that never go
 * through createShapeElement themselves.
 *
 * Deliberately a circle or a polygon, never a <rect>, and updateClipShapeElement
 * below always writes *absolute* coordinates (cx/cy, or a fresh points list)
 * rather than putting a translate+rotate transform on the element or a
 * wrapping <g> — Chrome does not honor transforms on a <clipPath>'s children
 * when that clipPath is referenced via CSS `clip-path: url(#id)` from a
 * plain HTML element (only from another SVG element), so anything relying
 * on one silently fails to clip at all. Baking the current position/angle
 * into plain coordinates every frame sidesteps that entirely. */
function createClipShapeElement(spec: ShapeSpec): SVGCircleElement | SVGPolygonElement {
  const ns = "http://www.w3.org/2000/svg";
  if (spec.kind === "circle" || spec.kind === "glow-button" || spec.kind === "language-toggle") {
    const el = document.createElementNS(ns, "circle");
    el.setAttribute("r", String(spec.size * KNOCKOUT_CLIP_SHRINK));
    return el;
  }
  return document.createElementNS(ns, "polygon");
}

/** Recomputes one clip shape element's geometry in place from the body's
 * current world position/angle, offset into the knockout copy's own local
 * coordinate space (originX/originY) — see createClipShapeElement for why
 * this bakes absolute numbers rather than using a transform. */
function updateClipShapeElement(
  el: SVGCircleElement | SVGPolygonElement,
  spec: ShapeSpec,
  cx: number,
  cy: number,
  angle: number,
  originX: number,
  originY: number,
) {
  const x = cx - originX;
  const y = cy - originY;
  if (el instanceof SVGCircleElement) {
    el.setAttribute("cx", x.toFixed(1));
    el.setAttribute("cy", y.toFixed(1));
    return;
  }
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const rotate = (dx: number, dy: number) => `${(x + dx * cos - dy * sin).toFixed(1)},${(y + dx * sin + dy * cos).toFixed(1)}`;
  if (spec.kind === "triangle") {
    el.setAttribute(
      "points",
      regularPolygonVertices(3, spec.size * KNOCKOUT_CLIP_SHRINK).map((p) => rotate(p.x, p.y)).join(" "),
    );
    return;
  }
  // rect/switch/ditto — all rectangular colliders (see createShapeBody).
  // Sharp corners rather than chamfered; a small approximation that
  // doesn't matter at this scale.
  const hw = spec.size * KNOCKOUT_CLIP_SHRINK;
  const hh = (spec.size2 ?? spec.size) * KNOCKOUT_CLIP_SHRINK;
  const corners: [number, number][] = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ];
  el.setAttribute("points", corners.map(([dx, dy]) => rotate(dx, dy)).join(" "));
}

function createShapeBody(spec: ShapeSpec, x: number, y: number): Matter.Body {
  const common = {
    restitution: ELASTIC_RESTITUTION,
    friction: ELASTIC_FRICTION,
    // Every shape spawns into the zero-g section, so it should start with
    // the elastic-mode drag rather than 0 — setGravityMode only re-applies
    // this on an actual mode *change*, and a freshly spawned body hasn't
    // been through one yet.
    frictionAir: ELASTIC_FRICTION_AIR,
    frictionStatic: 0,
    angle: spec.rotation ?? 0,
  };
  if (spec.kind === "circle" || spec.kind === "glow-button" || spec.kind === "language-toggle") {
    return Bodies.circle(x, y, spec.size, common);
  }
  if (spec.kind === "ditto") {
    // A square collider (chamfered like any other rect shape) rather than
    // a circle, sized to roughly match the squircle skin's own footprint
    // — see dittoBlob's DITTO_BODY_HALF_EXTENT_RATIO.
    const half = spec.size * DITTO_BODY_HALF_EXTENT_RATIO;
    return Bodies.rectangle(x, y, half * 2, half * 2, { ...common, chamfer: { radius: half * 0.3 } });
  }
  if (spec.kind === "switch" || spec.kind === "rect") {
    return Bodies.rectangle(x, y, spec.size * 2, (spec.size2 ?? spec.size) * 2, {
      ...common,
      chamfer: { radius: Math.min(spec.size, spec.size2 ?? spec.size) * 0.35 },
    });
  }
  // triangle
  return Bodies.fromVertices(x, y, [regularPolygonVertices(3, spec.size)], common, true);
}

/** SVG element for a shape's *local* geometry (centered at the origin) — position/rotation are applied via a wrapping <g> transform each frame, so this never needs to change after creation. */
function createShapeElement(spec: ShapeSpec): SVGGraphicsElement {
  const ns = "http://www.w3.org/2000/svg";
  if (spec.kind === "circle") {
    const el = document.createElementNS(ns, "circle");
    el.setAttribute("r", String(spec.size));
    el.setAttribute("fill", spec.color);
    return el;
  }
  // Note: "ditto" doesn't go through this function — it gets its own
  // soft-body path + face group (see spawnDittoBlob below).
  if (spec.kind === "rect") {
    const el = document.createElementNS(ns, "rect");
    const w = spec.size * 2;
    const h = (spec.size2 ?? spec.size) * 2;
    el.setAttribute("x", String(-spec.size));
    el.setAttribute("y", String(-(spec.size2 ?? spec.size)));
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
    el.setAttribute("rx", String(Math.min(spec.size, spec.size2 ?? spec.size) * 0.35));
    el.setAttribute("fill", spec.color);
    return el;
  }
  const el = document.createElementNS(ns, "polygon");
  const points = regularPolygonVertices(3, spec.size)
    .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
  el.setAttribute("points", points);
  el.setAttribute("fill", spec.color);
  return el;
}

/** A blurred, enlarged, translucent silhouette in the shape's own color,
 * composited normally (no blend mode — see the intro comment for why).
 * Ditto draws as a plain circle here (its actual body is a circle too —
 * see createShapeBody — the soft-body skin is a purely visual layer on
 * top, no need to chase its wobble for something this soft-edged
 * anyway). */
function createGlowElement(spec: ShapeSpec, filterId: string): SVGGElement {
  const ns = "http://www.w3.org/2000/svg";
  const g = document.createElementNS(ns, "g") as SVGGElement;
  g.setAttribute("filter", `url(#${filterId})`);
  g.setAttribute("opacity", String(GLOW_OPACITY));

  if (spec.kind === "rect") {
    const w = spec.size * GLOW_SCALE;
    const h = (spec.size2 ?? spec.size) * GLOW_SCALE;
    const el = document.createElementNS(ns, "rect");
    el.setAttribute("x", String(-w));
    el.setAttribute("y", String(-h));
    el.setAttribute("width", String(w * 2));
    el.setAttribute("height", String(h * 2));
    el.setAttribute("rx", String(Math.min(w, h) * 0.35));
    el.setAttribute("fill", spec.color);
    g.appendChild(el);
    return g;
  }
  if (spec.kind === "triangle") {
    const el = document.createElementNS(ns, "polygon");
    el.setAttribute(
      "points",
      regularPolygonVertices(3, spec.size * GLOW_SCALE)
        .map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`)
        .join(" "),
    );
    el.setAttribute("fill", spec.color);
    g.appendChild(el);
    return g;
  }
  // circle + ditto
  const el = document.createElementNS(ns, "circle");
  el.setAttribute("r", String(spec.size * GLOW_SCALE));
  el.setAttribute("fill", spec.color);
  g.appendChild(el);
  return g;
}

/** Whether hovering this shape should turn the cursor into a pointer —
 * i.e. whether clicking it actually does something, not just "eligible
 * for hover darken" (every big shape is that, see ShapeSpec.interactive,
 * even the ones with no real page yet). */
function isClickableSpec(spec: ShapeSpec): boolean {
  return Boolean(spec.pageId) || Boolean(spec.hasClickAction);
}

/** A label for a clickable "page" shape (see ShapeSpec.label) — white
 * text with a dark outline (paint-order stroke, not just a fill) so it
 * stays legible over any of the site's randomized shape colors, not just
 * the ones it happens to contrast with. Starts invisible: FloatingShapes
 * fades it in slowly (see the floor-collision listener) the moment the
 * shape actually lands, rather than the instant gravity merely turns on
 * — labeling something mid-fall, before it can be clicked, would be
 * confusing, and revealing it as a quick snap would undersell the
 * moment. Returns null for any shape without a label, so callers can
 * push the result straight into their parallel array without a separate
 * branch. */
function createLabelElement(spec: ShapeSpec): SVGGElement | null {
  if (!spec.label) return null;
  const ns = "http://www.w3.org/2000/svg";
  const g = document.createElementNS(ns, "g") as SVGGElement;
  g.setAttribute("aria-hidden", "true");
  g.style.opacity = "0";
  // Duration is set per-trigger (see handleFloorCollision vs. the various
  // hide points below) rather than fixed here — only the floor-landing
  // reveal itself should be slow/dramatic; hiding it again (scrolling
  // back up, opening its panel) should stay snappy.
  g.style.transition = `opacity ${LABEL_HIDE_MS}ms ease`;
  const text = document.createElementNS(ns, "text");
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "central");
  text.setAttribute("font-family", "var(--font-display)");
  text.setAttribute("font-weight", "600");
  text.setAttribute("font-size", String(Math.max(13, spec.size * 0.2)));
  text.setAttribute("fill", "#ffffff");
  text.setAttribute("stroke", "var(--color-ink)");
  text.setAttribute("stroke-width", "3");
  text.setAttribute("stroke-linejoin", "round");
  text.setAttribute("paint-order", "stroke");
  text.textContent = spec.label;
  g.appendChild(text);
  return g;
}

interface FloatingShapesProps {
  /** Called once a clicked shape finishes expanding into its panel — the
   * caller is responsible for rendering that page's actual content on top
   * of it (see App.tsx). `accentColor` is the shape's own color, handed
   * back so the content overlay can echo it (e.g. as a border). */
  onOpenPanel?: (pageId: string, accentColor: string) => void;
  /** Called the instant the user clicks outside the panel — before the
   * shrink animation finishes, so the caller can hide its content overlay
   * right away rather than waiting on the physics. */
  onClosePanel?: () => void;
  /** Called the instant the language-toggle shape is clicked, with the
   * *new* language — FloatingShapes owns reading/writing the localStorage
   * key itself (see toggleLanguage), this just tells the rest of the app
   * (LanguageProvider) to re-render with the new copy. */
  onToggleLanguage?: (lang: Lang) => void;
}

export function FloatingShapes({ onOpenPanel, onClosePanel, onToggleLanguage }: FloatingShapesProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const knockoutCopyRef = useRef<HTMLHeadingElement>(null);
  // Refs rather than effect deps: the physics world below is built exactly
  // once (see the `[]` dependency array), and re-running all of that just
  // because the parent passed a fresh inline callback would tear down and
  // respawn every shape.
  const onOpenPanelRef = useRef(onOpenPanel);
  const onClosePanelRef = useRef(onClosePanel);
  const onToggleLanguageRef = useRef(onToggleLanguage);
  useEffect(() => {
    onOpenPanelRef.current = onOpenPanel;
    onClosePanelRef.current = onClosePanel;
    onToggleLanguageRef.current = onToggleLanguage;
  }, [onOpenPanel, onClosePanel, onToggleLanguage]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    let cancelled = false;

    const setViewport = () => {
      const height = Math.max(document.documentElement.scrollHeight, window.innerHeight);
      svg.setAttribute("width", String(window.innerWidth));
      svg.setAttribute("height", String(height));
      svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${height}`);
      svg.style.height = `${height}px`;
    };
    setViewport();

    const engine = Engine.create({ gravity: { x: 0, y: 0 } });
    let gravityEngaged = false;

    // Walls are persistent bodies, not rebuilt every time something
    // changes — top/left/right are fixed to the plate's bounds and only
    // move on resize; the floor is repositioned every frame (see
    // updateFloor) while gravity is engaged, tracking the viewport.
    let topWall: Matter.Body | null = null;
    let leftWall: Matter.Body | null = null;
    let rightWall: Matter.Body | null = null;
    let floorWall: Matter.Body | null = null;

    function buildWalls() {
      const existing = [topWall, leftWall, rightWall, floorWall].filter((b): b is Matter.Body => b !== null);
      if (existing.length) Composite.remove(engine.world, existing);

      const plate = getDocRect(PLATE_SELECTOR);
      if (!plate) {
        topWall = leftWall = rightWall = floorWall = null;
        return;
      }
      const t = WALL_THICKNESS;
      const cx = plate.left + plate.width / 2;
      const wallOpts = { isStatic: true, restitution: 1, friction: 0 };
      topWall = Bodies.rectangle(cx, plate.top - t / 2, plate.width + t * 2, t, wallOpts);
      leftWall = Bodies.rectangle(plate.left - t / 2, plate.top + plate.height / 2, t, plate.height + t * 2, wallOpts);
      rightWall = Bodies.rectangle(plate.right + t / 2, plate.top + plate.height / 2, t, plate.height + t * 2, wallOpts);
      floorWall = Bodies.rectangle(cx, plate.bottom + t / 2, plate.width + t * 2, t, wallOpts);
      Composite.add(engine.world, [topWall, leftWall, rightWall, floorWall]);
      snapFloorToTarget();
    }

    // The current viewport's bottom edge is always a solid floor — not just
    // once gravity engages — so zero-g shapes can never drift down past
    // what's actually on screen and go missing until you scroll to find
    // them. Still clamped to the plate's real bottom so it never floats
    // below the habitat itself near the very end of the page.
    function floorTargetBottom(): number {
      const plate = getDocRect(PLATE_SELECTOR);
      const plateBottom = plate ? plate.bottom : window.scrollY + window.innerHeight;
      return Math.min(window.scrollY + window.innerHeight - FLOOR_MARGIN, plateBottom);
    }

    // Used right after (re)building walls, and on a gravity-mode switch —
    // skips the per-frame step cap so it doesn't visibly crawl into place.
    function snapFloorToTarget() {
      if (!floorWall) return;
      Body.setPosition(floorWall, { x: floorWall.position.x, y: floorTargetBottom() + WALL_THICKNESS / 2 });
    }

    // Called every frame while gravity is engaged: eases the floor toward
    // the current viewport bottom rather than jumping straight there, so a
    // big scroll delta in one frame can't let it tunnel through a resting
    // shape without a collision ever being detected.
    function updateFloor() {
      if (!floorWall) return;
      const targetY = floorTargetBottom() + WALL_THICKNESS / 2;
      const dy = targetY - floorWall.position.y;
      const clamped = Math.max(-MAX_FLOOR_STEP, Math.min(MAX_FLOOR_STEP, dy));
      if (clamped !== 0) Body.setPosition(floorWall, { x: floorWall.position.x, y: floorWall.position.y + clamped });
    }

    buildWalls();

    const handleResize = () => {
      setViewport();
      buildWalls();
      // Tailwind's responsive breakpoints can change the knockout source's
      // own position/width (see Hero.tsx's sm:/lg: classes) — layoutKnockoutCopy
      // is defined further down, but this only ever runs from the listener
      // below, never synchronously during setup.
      layoutKnockoutCopy();
    };
    window.addEventListener("resize", handleResize);

    // Shape bodies, spread out inside the plate's upper (zero-g) area with
    // a small random walk of initial velocity — Matter's own solver
    // untangles any initial overlap over the first few frames.
    const plateRect = getDocRect(PLATE_SELECTOR);
    // Sizes and decorative-shape counts both scale from the current
    // viewport (see shapes.ts' computeShapeScale) — read once here at
    // mount, same as everything else about the initial layout; resizing
    // afterward adjusts the walls/floor (see handleResize above) but
    // doesn't respawn shapes out from under whatever's already happening.
    const shapes = generateShapes(window.innerWidth, window.innerHeight);
    const ns = "http://www.w3.org/2000/svg";

    function makeBlurFilter(id: string, stdDeviation: number): SVGFilterElement {
      const filter = document.createElementNS(ns, "filter") as unknown as SVGFilterElement;
      filter.setAttribute("id", id);
      // Generous margin so the blur isn't clipped to the element's own
      // tight bounding box, which would cut it off with a hard edge.
      filter.setAttribute("x", "-150%");
      filter.setAttribute("y", "-150%");
      filter.setAttribute("width", "400%");
      filter.setAttribute("height", "400%");
      const blur = document.createElementNS(ns, "feGaussianBlur");
      blur.setAttribute("stdDeviation", String(stdDeviation));
      filter.appendChild(blur);
      return filter;
    }
    const defs = document.createElementNS(ns, "defs");
    defs.appendChild(makeBlurFilter("glow-blur-small", GLOW_BLUR_SMALL));
    defs.appendChild(makeBlurFilter("glow-blur-big", GLOW_BLUR_BIG));
    svg.appendChild(defs);

    // Glows live behind the solid shapes, layered with plain transparency
    // (see the intro comment for why this isn't a blend-mode/isolated
    // stacking context anymore).
    const glowLayer = document.createElementNS(ns, "g");
    svg.appendChild(glowLayer);

    const shapeLayer = document.createElementNS(ns, "g");
    svg.appendChild(shapeLayer);

    // Labels for clickable "page" shapes live on top of everything else,
    // so they're never occluded by a neighboring shape drifting over them.
    const labelLayer = document.createElementNS(ns, "g");
    svg.appendChild(labelLayer);

    const bodies: Matter.Body[] = [];
    const elements: SVGGElement[] = [];
    const specs: ShapeSpec[] = [];
    // Parallel to the above; null for the switch, which skips the glow
    // entirely (see the intro comment).
    const glowElements: (SVGGElement | null)[] = [];
    // Parallel too; non-null only for the one shape with a pageId/label
    // (see spawnLabelFor). Faded in slowly the moment its shape actually
    // lands on the floor (see the collisionStart listener below), hidden
    // again while its panel is open (see beginExpand/beginShrink) or once
    // it's relaunched back into zero-g.
    const labelElements: (SVGGElement | null)[] = [];
    // Which labeled shapes have already played their landing reveal
    // during the *current* fall — cleared on every disengage so the same
    // dramatic beat replays each time it scrolls down and lands again.
    const landedLabelIndices = new Set<number>();
    // Pending auto-open of Internships (see handleInternshipsAutoOpen) —
    // tracked so scrolling back up before it fires can cancel it instead of
    // popping the panel open after the user's already left.
    let autoExpandTimer: ReturnType<typeof setTimeout> | null = null;

    // Ditto gets a real rigid circle body too (see createShapeBody) so it
    // collides with everything normally, but its *visual* is a soft-body
    // skin driven by that body instead of a plain circle — see
    // dittoBlob.ts. dittoIndex is which slot in bodies/elements/specs it
    // lives in, so the render loop below can special-case just that one.
    let dittoBlob: DittoBlobState | null = null;
    let dittoIndex = -1;

    // Night mode: the single source of truth is the <html> attribute
    // itself (index.html's inline script already applies a saved
    // preference before first paint), so the switch's initial visual just
    // reads that back rather than tracking its own separate boolean that
    // could drift out of sync with it.
    let nightMode = document.documentElement.dataset.theme === "dark";
    let lightSwitch: { toggleGroup: SVGGElement; toggleShape: SVGPolygonElement } | null = null;

    function updateSwitchVisual() {
      if (!lightSwitch) return;
      const { toggleGroup, toggleShape } = lightSwitch;
      // The toggle bat is drawn once, angled head at the top (see
      // spawnLightSwitch) — night mode just flips it upside down around
      // its own center instead of redrawing it, so the head ends up at
      // the bottom like a real switch flipped off.
      toggleGroup.setAttribute("transform", nightMode ? "scale(1,-1)" : "scale(1,1)");
      toggleShape.setAttribute("fill", nightMode ? "#4c4a63" : "#fbbf24");
    }

    function toggleNightMode() {
      nightMode = !nightMode;
      if (nightMode) {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
      try {
        localStorage.setItem("ditto-night-mode", String(nightMode));
      } catch {
        // Private browsing/storage disabled — the toggle still works for
        // this visit, it just won't be remembered next time.
      }
      updateSwitchVisual();
    }

    // Glow on/off, toggled by the push-button (see spawnGlowButton) —
    // just hides the whole glowLayer rather than tearing down/rebuilding
    // its contents, so turning it back on is instant.
    let glowEnabled = (() => {
      try {
        return localStorage.getItem("ditto-glow-enabled") !== "false";
      } catch {
        return true;
      }
    })();
    let glowButton: { glassEl: SVGCircleElement; rayEls: SVGLineElement[] } | null = null;
    if (!glowEnabled) glowLayer.style.display = "none";

    function updateGlowButtonVisual() {
      if (!glowButton) return;
      glowButton.glassEl.setAttribute("fill", glowEnabled ? "#fde047" : "var(--color-surface)");
      // The rays are the light actually being emitted — only make sense
      // to show while the glow itself is on.
      for (const ray of glowButton.rayEls) {
        ray.style.display = glowEnabled ? "" : "none";
      }
    }

    function toggleGlow() {
      glowEnabled = !glowEnabled;
      glowLayer.style.display = glowEnabled ? "" : "none";
      try {
        localStorage.setItem("ditto-glow-enabled", String(glowEnabled));
      } catch {
        // Private browsing/storage disabled — same as night mode above.
      }
      updateGlowButtonVisual();
    }

    // Language, toggled by the globe shape (see spawnLanguageToggle).
    // FloatingShapes owns reading/writing localStorage itself here (same
    // as night mode/glow), and just reports the new value upward
    // (onToggleLanguage) so the rest of the app — which owns the actual
    // translated copy — knows to re-render.
    let currentLang: Lang = (() => {
      try {
        return localStorage.getItem("ditto-lang") === "fr" ? "fr" : "en";
      } catch {
        return "en";
      }
    })();
    let languageToggle: { textEl: SVGTextElement } | null = null;

    function updateLanguageVisual() {
      if (!languageToggle) return;
      languageToggle.textEl.textContent = currentLang.toUpperCase();
    }

    // A small hardcoded lookup rather than threading a labelKey through
    // ShapeSpec — there are only ever as many entries here as there are
    // real pages.
    function pageLabelKeyFor(pageId: string): "internshipsLabel" | "contactLabel" | null {
      if (pageId === "internships") return "internshipsLabel";
      if (pageId === "contact") return "contactLabel";
      return null;
    }

    function toggleLanguage() {
      currentLang = currentLang === "en" ? "fr" : "en";
      try {
        localStorage.setItem("ditto-lang", currentLang);
      } catch {
        // Private browsing/storage disabled — same as night mode above.
      }
      updateLanguageVisual();
      for (let i = 0; i < specs.length; i++) {
        const key = specs[i].pageId ? pageLabelKeyFor(specs[i].pageId!) : null;
        if (!key) continue;
        const textEl = labelElements[i]?.querySelector("text");
        if (textEl) textEl.textContent = STRINGS[currentLang][key];
      }
      onToggleLanguageRef.current?.(currentLang);
    }

    // Pushes a label (or the null placeholder) for the shape just added
    // at the end of bodies/specs/etc — called once per spawn, from every
    // spawn function, so labelElements always stays index-aligned with
    // them even though most shapes never have a real label.
    function spawnLabelFor(spec: ShapeSpec) {
      const label = createLabelElement(spec);
      if (label) {
        // spec.label is only ever the English default (see ./shapes) —
        // a returning visitor whose saved preference is French should see
        // the label in French from the very first frame, not just after
        // they next toggle it themselves.
        const key = spec.pageId ? pageLabelKeyFor(spec.pageId) : null;
        if (key) {
          const textEl = label.querySelector("text");
          if (textEl) textEl.textContent = STRINGS[currentLang][key];
        }
        labelLayer.appendChild(label);
      }
      labelElements.push(label);
    }

    // Adds one shape to every parallel array/the world/the SVG at once —
    // used for the initial spawn below (index i's specs/bodies/elements
    // always refer to the same shape, which the click-to-expand code
    // below relies on for lookup/restore).
    function spawnShape(spec: ShapeSpec, x: number, y: number, vx: number, vy: number) {
      const body = createShapeBody(spec, x, y);
      Body.setVelocity(body, { x: vx, y: vy });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
      bodies.push(body);
      specs.push(spec);
      Composite.add(engine.world, body);

      const glow = createGlowElement(spec, spec.interactive ? "glow-blur-big" : "glow-blur-small");
      glowLayer.appendChild(glow);
      glowElements.push(glow);
      spawnLabelFor(spec);

      const g = document.createElementNS(ns, "g") as SVGGElement;
      g.style.transition = "filter 0.15s ease";
      g.appendChild(createShapeElement(spec));
      shapeLayer.appendChild(g);
      elements.push(g);
    }

    function spawnDittoBlob(spec: ShapeSpec, x: number, y: number, vx: number, vy: number) {
      const body = createShapeBody(spec, x, y);
      Body.setVelocity(body, { x: vx, y: vy });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
      bodies.push(body);
      specs.push(spec);
      Composite.add(engine.world, body);

      const glow = createGlowElement(spec, "glow-blur-small");
      glowLayer.appendChild(glow);
      glowElements.push(glow);
      spawnLabelFor(spec);

      const g = document.createElementNS(ns, "g") as SVGGElement;
      const pathEl = document.createElementNS(ns, "path") as SVGPathElement;
      pathEl.setAttribute("fill", spec.color);
      g.appendChild(pathEl);
      const faceEl = document.createElementNS(ns, "g") as SVGGElement;
      appendDittoFace(faceEl, spec.size);
      g.appendChild(faceEl);
      shapeLayer.appendChild(g);
      elements.push(g);

      dittoIndex = bodies.length - 1;
      const dittoNodes = createDittoNodes(x, y, spec.size);
      dittoBlob = { nodes: dittoNodes, restEdgeLengths: computeRestEdgeLengths(dittoNodes), pathEl, faceEl };
    }

    // Styled after a traditional stencil-icon light switch: a bold-outline
    // rounded plate, a plus-slot screw at top and bottom, and a chunky
    // toggle bat with an angled 3D-ish head. Plate/screw/outline color is
    // var(--color-ink) — always the current theme's text color — so the
    // icon reads as dark-on-light in day mode and light-on-dark in night
    // mode, like a stencil cut the opposite way. The toggle's own fill
    // still color-codes the state (warm "lit" yellow vs. muted slate).
    function spawnLightSwitch(spec: ShapeSpec, x: number, y: number, vx: number, vy: number) {
      const body = createShapeBody(spec, x, y);
      Body.setVelocity(body, { x: vx, y: vy });
      // Tumbles and spins like any other shape now (it used to be pinned
      // upright via infinite inertia so "up = light, down = dark" always
      // read correctly, but that made it look rigid/out of place next to
      // everything else — worth it for the visual consistency).
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
      bodies.push(body);
      specs.push(spec);
      glowElements.push(null); // no glow — reads as UI chrome, not a toy
      spawnLabelFor(spec);
      Composite.add(engine.world, body);

      const hw = spec.size;
      const hh = spec.size2 ?? spec.size;
      const line = "var(--color-ink)";
      const strokeWidth = Math.max(1.5, hw * 0.09);

      const g = document.createElementNS(ns, "g") as SVGGElement;
      g.style.transition = "filter 0.15s ease";

      const plate = document.createElementNS(ns, "rect");
      plate.setAttribute("x", String(-hw));
      plate.setAttribute("y", String(-hh));
      plate.setAttribute("width", String(hw * 2));
      plate.setAttribute("height", String(hh * 2));
      plate.setAttribute("rx", String(hw * 0.22));
      plate.setAttribute("fill", spec.color);
      plate.setAttribute("stroke", line);
      plate.setAttribute("stroke-width", String(strokeWidth));
      g.appendChild(plate);

      // Two plus-slot screws, top and bottom center.
      const screwR = hw * 0.16;
      for (const screwY of [-hh * 0.72, hh * 0.72]) {
        const screw = document.createElementNS(ns, "circle");
        screw.setAttribute("cy", String(screwY));
        screw.setAttribute("r", String(screwR));
        screw.setAttribute("fill", spec.color);
        screw.setAttribute("stroke", line);
        screw.setAttribute("stroke-width", String(strokeWidth * 0.6));
        g.appendChild(screw);

        const slot = document.createElementNS(ns, "path");
        slot.setAttribute(
          "d",
          `M 0 ${(screwY - screwR * 0.55).toFixed(2)} V ${(screwY + screwR * 0.55).toFixed(2)} M ${(-screwR * 0.55).toFixed(2)} ${screwY} H ${(screwR * 0.55).toFixed(2)}`,
        );
        slot.setAttribute("stroke", line);
        slot.setAttribute("stroke-width", String(strokeWidth * 0.5));
        g.appendChild(slot);
      }

      // The toggle bat: a vertical shaft with an angled, wider head at the
      // top (the pseudo-3D "flipped this way" look from the reference
      // icon). Defined once with the head at the top; updateSwitchVisual
      // flips the whole group upside down for night mode rather than
      // redrawing it.
      const toggleGroup = document.createElementNS(ns, "g") as SVGGElement;
      const shaftHalfW = hw * 0.17;
      const headHalfW = hw * 0.4;
      const topY = -hh * 0.44;
      const midY = -hh * 0.06;
      const bottomY = hh * 0.44;
      const points = [
        [-shaftHalfW, midY],
        [-shaftHalfW, topY],
        [headHalfW, topY + (midY - topY) * 0.68],
        [shaftHalfW, midY],
        [shaftHalfW, bottomY],
        [-shaftHalfW, bottomY],
      ];
      const toggleShape = document.createElementNS(ns, "polygon") as SVGPolygonElement;
      toggleShape.setAttribute("points", points.map(([px, py]) => `${px.toFixed(2)},${py.toFixed(2)}`).join(" "));
      toggleShape.setAttribute("stroke", line);
      toggleShape.setAttribute("stroke-width", String(strokeWidth * 0.8));
      toggleShape.setAttribute("stroke-linejoin", "round");
      toggleGroup.appendChild(toggleShape);
      g.appendChild(toggleGroup);

      shapeLayer.appendChild(g);
      elements.push(g);

      lightSwitch = { toggleGroup, toggleShape };
      updateSwitchVisual();
    }

    // A little light bulb — radiating rays, glass, a coiled filament, and
    // a ridged screw base — that toggles the glow layer on click (see
    // toggleGlow). Same stencil-family outline treatment as the switch:
    // bold var(--color-ink) strokes, a var(--color-surface)-ish base and
    // shadow so it always matches the current theme.
    function spawnGlowButton(spec: ShapeSpec, x: number, y: number, vx: number, vy: number) {
      const body = createShapeBody(spec, x, y);
      Body.setVelocity(body, { x: vx, y: vy });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
      bodies.push(body);
      specs.push(spec);
      glowElements.push(null); // no glow — it's UI chrome, not a toy
      spawnLabelFor(spec);
      Composite.add(engine.world, body);

      const r = spec.size;
      const line = "var(--color-ink)";
      const strokeWidth = Math.max(1.2, r * 0.075);

      const g = document.createElementNS(ns, "g") as SVGGElement;
      g.style.transition = "filter 0.15s ease";

      // A soft resting shadow beneath the whole icon.
      const shadow = document.createElementNS(ns, "ellipse");
      shadow.setAttribute("cy", String(r * 0.82));
      shadow.setAttribute("rx", String(r * 0.34));
      shadow.setAttribute("ry", String(r * 0.06));
      shadow.setAttribute("fill", line);
      shadow.setAttribute("opacity", "0.15");
      g.appendChild(shadow);

      const glassCy = -r * 0.18;
      const glassR = r * 0.52;

      // Rays — the light actually being emitted, so they only exist while
      // the glow is on (see updateGlowButtonVisual). Skips straight down,
      // where the base sits.
      const rayEls: SVGLineElement[] = [];
      const rayInner = glassR + r * 0.1;
      const rayOuter = glassR + r * 0.34;
      for (const deg of [-90, -45, 0, 45, 135, 180, -135]) {
        const rad = (deg * Math.PI) / 180;
        const c = Math.cos(rad);
        const s = Math.sin(rad);
        const ray = document.createElementNS(ns, "line") as SVGLineElement;
        ray.setAttribute("x1", (c * rayInner).toFixed(2));
        ray.setAttribute("y1", (glassCy + s * rayInner).toFixed(2));
        ray.setAttribute("x2", (c * rayOuter).toFixed(2));
        ray.setAttribute("y2", (glassCy + s * rayOuter).toFixed(2));
        ray.setAttribute("stroke", line);
        ray.setAttribute("stroke-width", String(strokeWidth));
        ray.setAttribute("stroke-linecap", "round");
        g.appendChild(ray);
        rayEls.push(ray);
      }

      // The glass bulb — its fill is the on/off state color (see
      // updateGlowButtonVisual), everything else is fixed ink/surface.
      const glassEl = document.createElementNS(ns, "circle") as SVGCircleElement;
      glassEl.setAttribute("cy", String(glassCy));
      glassEl.setAttribute("r", String(glassR));
      glassEl.setAttribute("stroke", line);
      glassEl.setAttribute("stroke-width", String(strokeWidth));
      g.appendChild(glassEl);

      // A coiled filament inside the glass — two loops, not a plain
      // zigzag, so it actually reads as a wire spring rather than a
      // lightning bolt.
      const fw = glassR * 0.38;
      const topY = glassCy - glassR * 0.25;
      const midY = glassCy - glassR * 0.02;
      const botY = glassCy + glassR * 0.45;
      const filament = document.createElementNS(ns, "path");
      filament.setAttribute(
        "d",
        `M ${(-fw * 0.75).toFixed(2)} ${botY.toFixed(2)} ` +
          `C ${(-fw * 1.15).toFixed(2)} ${(glassCy + glassR * 0.05).toFixed(2)}, ${(-fw * 0.5).toFixed(2)} ${topY.toFixed(2)}, 0 ${midY.toFixed(2)} ` +
          `C ${(fw * 0.5).toFixed(2)} ${topY.toFixed(2)}, ${(fw * 1.15).toFixed(2)} ${(glassCy + glassR * 0.05).toFixed(2)}, ${(fw * 0.75).toFixed(2)} ${botY.toFixed(2)}`,
      );
      filament.setAttribute("fill", "none");
      filament.setAttribute("stroke", line);
      filament.setAttribute("stroke-width", String(strokeWidth * 0.75));
      filament.setAttribute("stroke-linecap", "round");
      g.appendChild(filament);

      // Ridged screw base — several stacked bands tapering slightly,
      // rather than one plate with a couple of lines across it, plus a
      // flat bottom cap.
      const bandCount = 4;
      const bandH = r * 0.09;
      const bandGap = r * 0.045;
      let bandY = glassCy + glassR * 0.86;
      let bandW = r * 0.6;
      for (let i = 0; i < bandCount; i++) {
        const band = document.createElementNS(ns, "rect");
        band.setAttribute("x", String(-bandW / 2));
        band.setAttribute("y", bandY.toFixed(2));
        band.setAttribute("width", String(bandW));
        band.setAttribute("height", String(bandH));
        band.setAttribute("rx", String(bandH * 0.3));
        band.setAttribute("fill", spec.color);
        band.setAttribute("stroke", line);
        band.setAttribute("stroke-width", String(strokeWidth * 0.75));
        g.appendChild(band);
        bandY += bandH + bandGap;
        bandW *= 0.94;
      }
      const cap = document.createElementNS(ns, "rect");
      cap.setAttribute("x", String(-bandW / 2));
      cap.setAttribute("y", bandY.toFixed(2));
      cap.setAttribute("width", String(bandW));
      cap.setAttribute("height", String(r * 0.08));
      cap.setAttribute("rx", String(r * 0.02));
      cap.setAttribute("fill", spec.color);
      cap.setAttribute("stroke", line);
      cap.setAttribute("stroke-width", String(strokeWidth * 0.75));
      g.appendChild(cap);

      shapeLayer.appendChild(g);
      elements.push(g);

      glowButton = { glassEl, rayEls };
      updateGlowButtonVisual();
    }

    // A little globe — toggles the site's language on click (see
    // toggleLanguage) and shows the *current* language as a short code
    // rendered right on the icon, the same way the switch/bulb show
    // their own state.
    function spawnLanguageToggle(spec: ShapeSpec, x: number, y: number, vx: number, vy: number) {
      const body = createShapeBody(spec, x, y);
      Body.setVelocity(body, { x: vx, y: vy });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
      bodies.push(body);
      specs.push(spec);
      glowElements.push(null);
      spawnLabelFor(spec);
      Composite.add(engine.world, body);

      const r = spec.size;
      const line = "var(--color-ink)";
      const strokeWidth = Math.max(1.3, r * 0.08);

      const g = document.createElementNS(ns, "g") as SVGGElement;
      g.style.transition = "filter 0.15s ease";

      const globeEl = document.createElementNS(ns, "circle");
      globeEl.setAttribute("r", String(r));
      globeEl.setAttribute("fill", spec.color);
      globeEl.setAttribute("stroke", line);
      globeEl.setAttribute("stroke-width", String(strokeWidth));
      g.appendChild(globeEl);

      const meridian = document.createElementNS(ns, "ellipse");
      meridian.setAttribute("rx", String(r * 0.42));
      meridian.setAttribute("ry", String(r));
      meridian.setAttribute("fill", "none");
      meridian.setAttribute("stroke", line);
      meridian.setAttribute("stroke-width", String(strokeWidth * 0.7));
      g.appendChild(meridian);

      const equator = document.createElementNS(ns, "line");
      equator.setAttribute("x1", String(-r));
      equator.setAttribute("y1", "0");
      equator.setAttribute("x2", String(r));
      equator.setAttribute("y2", "0");
      equator.setAttribute("stroke", line);
      equator.setAttribute("stroke-width", String(strokeWidth * 0.7));
      g.appendChild(equator);

      // Same "white fill, dark outline" treatment as the page labels, so
      // the language code reads clearly against the shape's own color.
      const textEl = document.createElementNS(ns, "text") as SVGTextElement;
      textEl.setAttribute("text-anchor", "middle");
      textEl.setAttribute("dominant-baseline", "central");
      textEl.setAttribute("font-family", "var(--font-display)");
      textEl.setAttribute("font-weight", "700");
      textEl.setAttribute("font-size", String(r * 0.42));
      textEl.setAttribute("fill", "#ffffff");
      textEl.setAttribute("stroke", line);
      textEl.setAttribute("stroke-width", "2.2");
      textEl.setAttribute("paint-order", "stroke");
      g.appendChild(textEl);

      shapeLayer.appendChild(g);
      elements.push(g);

      languageToggle = { textEl };
      updateLanguageVisual();
    }

    shapes.forEach((spec, i) => {
      const cx = plateRect ? plateRect.left + plateRect.width / 2 : window.innerWidth / 2;
      const cy = plateRect ? plateRect.top + window.innerHeight / 2 : window.innerHeight / 2;
      const spreadX = plateRect ? plateRect.width * 0.3 : 200;
      const spreadY = window.innerHeight * 0.3;
      const angle = (i / shapes.length) * Math.PI * 2;
      const x = cx + Math.cos(angle) * spreadX * (0.5 + 0.5 * Math.random());
      const y = cy + Math.sin(angle) * spreadY * (0.5 + 0.5 * Math.random());
      const dir = Math.random() * Math.PI * 2;
      const speed = spec.sizeTier === "small" ? SPAWN_SPEED_SMALL : SPAWN_SPEED_BIG;
      const vx = Math.cos(dir) * speed;
      const vy = Math.sin(dir) * speed;
      if (spec.kind === "ditto") {
        spawnDittoBlob(spec, x, y, vx, vy);
      } else if (spec.kind === "switch") {
        spawnLightSwitch(spec, x, y, vx, vy);
      } else if (spec.kind === "glow-button") {
        spawnGlowButton(spec, x, y, vx, vy);
      } else if (spec.kind === "language-toggle") {
        spawnLanguageToggle(spec, x, y, vx, vy);
      } else {
        spawnShape(spec, x, y, vx, vy);
      }
    });

    // The white "knockout" copy of the element tagged data-shape-knockout
    // (see Hero.tsx) is knockoutCopyRef below — a second, genuinely
    // top-level <h1> (a sibling of Hero, not nested inside it) with the
    // exact same Tailwind classes, just white. It has to live outside
    // Hero's own low z-index container: Hero sits *below* the shapes (see
    // its own z-index) so the shape can visually occlude the source text,
    // but nothing painted *inside* that same low-z box — no matter its own
    // z-index — can ever appear in front of the shapes layer, which is a
    // sibling positioned above it. Real Tailwind classes (not JS-measured
    // font metrics — an earlier version tried that, and it was fragile
    // against web-font-swap timing) means only *position* needs to be kept
    // in sync here, which is just geometry: measured on mount, on resize,
    // and once more when document.fonts.ready resolves (a web font
    // finishing its swap-in can itself change the source's own natural
    // width without firing a resize).
    const knockoutSource = document.querySelector<HTMLElement>(KNOCKOUT_SELECTOR);
    const knockoutCopy = knockoutCopyRef.current;
    let knockoutOriginX = 0;
    let knockoutOriginY = 0;
    // One per body — kept updated in place every frame (see the tick loop
    // and updateClipShapeElement) rather than moved via a transform.
    let knockoutClipShapeEls: (SVGCircleElement | SVGPolygonElement)[] = [];

    function layoutKnockoutCopy() {
      if (!knockoutSource || !knockoutCopy) return;
      const rect = knockoutSource.getBoundingClientRect();
      knockoutOriginX = rect.left + window.scrollX;
      knockoutOriginY = rect.top + window.scrollY;
      knockoutCopy.style.left = `${knockoutOriginX}px`;
      knockoutCopy.style.top = `${knockoutOriginY}px`;
      knockoutCopy.style.width = `${rect.width}px`;
    }

    if (knockoutSource && knockoutCopy) {
      const clipPathEl = document.createElementNS(ns, "clipPath");
      clipPathEl.setAttribute("id", "shape-knockout-clip");
      knockoutClipShapeEls = specs.map((spec) => {
        const el = createClipShapeElement(spec);
        clipPathEl.appendChild(el);
        return el;
      });
      defs.appendChild(clipPathEl);
      knockoutCopy.style.clipPath = "url(#shape-knockout-clip)";
      layoutKnockoutCopy();
      document.fonts.ready.then(() => {
        if (!cancelled) layoutKnockoutCopy();
      });
    }

    // The dramatic reveal: the moment a labeled shape actually touches the
    // ground (a real physics collision, not just "gravity is on now" —
    // that fires the instant it's still mid-air near the top of its
    // fall), its label starts its slow fade-in (see createLabelElement's
    // transition). "The ground" means the floor or another shape it's
    // come to rest on — shapes settle into a pile, not a neat row all
    // touching the floor directly, so a resting shape may only ever touch
    // its neighbors. Side/top walls and the cursor (a sensor once
    // settled, not something you "land" on) don't count. Guarded by
    // landedLabelIndices so the *first* touch is what triggers it, not
    // every subsequent micro-bounce while it settles.
    function handleFloorCollision(event: Matter.IEventCollision<Matter.Engine>) {
      if (!gravityEngaged) return;
      const notGround: (Matter.Body | null)[] = [cursorBody, topWall, leftWall, rightWall];
      for (const pair of event.pairs) {
        if (notGround.includes(pair.bodyA) || notGround.includes(pair.bodyB)) continue;
        for (const candidate of [pair.bodyA, pair.bodyB]) {
          const index = bodies.indexOf(candidate);
          if (index < 0 || !labelElements[index] || landedLabelIndices.has(index)) continue;
          landedLabelIndices.add(index);
          const label = labelElements[index]!;
          label.style.transitionDuration = `${LABEL_REVEAL_MS}ms`;
          label.style.opacity = "1";
        }
      }
    }
    Events.on(engine, "collisionStart", handleFloorCollision);

    // Internships opens itself once it's down on the second page — see the
    // FloatingShapes intro comment for why (demonstrating the click-to-open
    // trick rather than leaving a visitor to find it). Deliberately *not*
    // tied to the same "real ground landing" collisionStart the label
    // reveal above uses: waiting for one single fresh contact transition
    // turned out not to fire reliably (a body already resting against
    // something from a previous fall can re-engage gravity without ever
    // separating first, so no new collisionStart ever comes). Watching
    // collisionActive instead — which fires every step for any pair that's
    // *currently* touching, not just the instant contact begins — catches
    // it regardless of exactly when or how contact started. Only the
    // cursor doesn't count as "anything"; every wall and every other shape
    // does, per "the moment it collides with anything" once it's arrived.
    // Every pageId shape, in spawn order (Internships, then Contact, then
    // whatever gets added after it in ./shapes) — the scroll-driven
    // timeline below (see handleWheel/goToPageShape) steps through these
    // one at a time, in order, regardless of where each one actually
    // happens to be sitting on the board.
    const pageShapeIndices = specs.reduce<number[]>((acc, s, i) => {
      if (s.pageId) acc.push(i);
      return acc;
    }, []);
    const maxPageIndex = pageShapeIndices.length;
    // 0 = the hero/landing section, nothing open; 1..maxPageIndex = which
    // page's shape should be open. Kept in sync by both the wheel-driven
    // timeline and any manual click (see handlePointerDown) so the two
    // ways of navigating never disagree about where the visitor is.
    let pageIndex = 0;
    // True for the whole close-then-open chain a page-to-page step runs
    // (see goToPageShape/goToHero) — blocks another wheel tick from
    // landing mid-chain, the same way `transitioning` blocks another
    // hero<->bottom snap mid-animation.
    let panelNavigating = false;

    const internshipsIndex = specs.findIndex((s) => s.pageId === "internships");
    let internshipsAutoOpened = false;
    function handleInternshipsAutoOpen(event: Matter.IEventCollision<Matter.Engine>) {
      if (!gravityEngaged || internshipsAutoOpened || internshipsIndex < 0) return;
      const index = internshipsIndex;
      const body = bodies[index];
      for (const pair of event.pairs) {
        if (pair.bodyA !== body && pair.bodyB !== body) continue;
        const other = pair.bodyA === body ? pair.bodyB : pair.bodyA;
        if (other === cursorBody) continue;
        internshipsAutoOpened = true;
        if (!autoExpandTimer) {
          // Deferred a tick (see AUTO_EXPAND_DELAY_MS) rather than called
          // straight from here — this callback runs *inside* Matter's own
          // Engine.update, and beginExpand mutates the world (swaps the
          // body), which is asking for trouble done reentrantly, mid-step.
          autoExpandTimer = setTimeout(() => {
            autoExpandTimer = null;
            if (gravityEngaged && !panelState && !transitioning) {
              pageIndex = 1; // should already be 1 (see handleWheel) — belt and suspenders
              beginExpand(index);
            }
          }, AUTO_EXPAND_DELAY_MS);
        }
        return;
      }
    }
    Events.on(engine, "collisionActive", handleInternshipsAutoOpen);
    Events.on(engine, "collisionStart", handleInternshipsAutoOpen);

    // The cursor is a real physics body — heavy relative to the shapes, and
    // manually driven to the mouse's *document* position every frame
    // (rather than left to the engine's own integration) so it always
    // tracks exactly, while still handing off realistic velocity to
    // whatever it hits. It's a sensor (no physical collision response)
    // whenever gravity is engaged, so you can actually hover/click a
    // settled shape without the cursor shoving it away first.
    const cursorBody = Bodies.circle(-9999, -9999, CURSOR_RADIUS, {
      restitution: 1,
      friction: 0,
      frictionAir: 0,
      inertia: Infinity, // don't let collisions spin the paddle
      mass: CURSOR_MASS,
    });
    Composite.add(engine.world, cursorBody);

    // Which mode is active normally just follows the *current* scroll
    // position (checked every frame, see tick) — not a one-way latch,
    // scrolling back up reverses all of it. The snap-scroll handler below
    // briefly overrides that with an explicit value instead (see
    // manualGravityOverride) so re-entering zero-g and the upward launch
    // happen in the same instant, rather than gravity staying on for the
    // first few frames of the scroll-up animation and immediately
    // flattening the launch.
    let hoveredIndex = -1;
    let manualGravityOverride: boolean | null = null;
    function setGravityMode(enabled: boolean) {
      if (enabled === gravityEngaged) return;
      gravityEngaged = enabled;
      engine.gravity.y = enabled ? GRAVITY_Y : 0;
      Body.set(cursorBody, { isSensor: enabled });
      const restitution = enabled ? SETTLE_RESTITUTION : ELASTIC_RESTITUTION;
      const friction = enabled ? SETTLE_FRICTION : ELASTIC_FRICTION;
      const frictionAir = enabled ? SETTLE_FRICTION_AIR : ELASTIC_FRICTION_AIR;
      for (const body of bodies) {
        Body.set(body, { restitution, friction, frictionAir });
      }
      if (!enabled && hoveredIndex >= 0) {
        elements[hoveredIndex].style.filter = "";
        hoveredIndex = -1;
      }
      // Labels don't fade in just because gravity turned on (see the
      // collisionStart listener below for when they actually do) — but
      // they do need to disappear immediately on disengage, and forget
      // that they'd already landed, so scrolling down again replays the
      // same reveal rather than the label just being there from the start.
      if (!enabled) {
        for (let i = 0; i < labelElements.length; i++) {
          const label = labelElements[i];
          if (!label) continue;
          label.style.transitionDuration = `${LABEL_HIDE_MS}ms`;
          label.style.opacity = "0";
        }
        landedLabelIndices.clear();
        // Scrolling back up before the auto-open beat fires (see
        // handleInternshipsAutoOpen) cancels it — it should never pop the
        // panel open once the shape's already been launched back into
        // zero-g, and it should replay next time it comes back down.
        internshipsAutoOpened = false;
        if (autoExpandTimer) {
          clearTimeout(autoExpandTimer);
          autoExpandTimer = null;
        }
      }
    }

    let lastClientX = -9999;
    let lastClientY = -9999;
    let hasMouse = false;
    let lastCommandedX = -9999;
    let lastCommandedY = -9999;
    function handlePointerMove(e: PointerEvent) {
      // First-ever move is the cursor "appearing" from off-screen — snap
      // straight there rather than sweeping a giant one-time jump through
      // the whole board.
      if (!hasMouse) {
        lastCommandedX = e.clientX + window.scrollX;
        lastCommandedY = e.clientY + window.scrollY;
      }
      lastClientX = e.clientX;
      lastClientY = e.clientY;
      hasMouse = true;
    }
    document.addEventListener("pointermove", handlePointerMove);

    // Sends every shape flying upward with a bit of random sideways
    // scatter — restarts the "whimsical floating" feeling the instant you
    // scroll back up, rather than leaving them wherever gravity settled
    // them. They bounce off the top wall and each other from there, same
    // as freshly spawned ones.
    function launchShapesUpward() {
      for (const body of bodies) {
        const speed = LAUNCH_SPEED_MIN + Math.random() * (LAUNCH_SPEED_MAX - LAUNCH_SPEED_MIN);
        const sideways = (Math.random() - 0.5) * 8;
        Body.setVelocity(body, { x: sideways, y: -speed });
        Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.12);
      }
    }

    // Click-to-expand: the one shape tagged with a pageId (see ./shapes)
    // grows in place into a big rounded panel, shoving every other shape
    // out of the way as it does (it's a real, solid collider throughout —
    // see animatePanelTo), then hands off to the caller to render that
    // page's content on top. `panelState` being non-null is also what
    // blocks scrolling and other-shape hover/click while a panel is open.
    interface PanelState {
      index: number;
      spec: ShapeSpec;
      rectEl: SVGRectElement;
      // The shape's original footprint/position, to animate back to on close.
      originX: number;
      originY: number;
      originHw: number;
      originHh: number;
      // Live values, updated every animation frame in either direction.
      hw: number;
      hh: number;
      x: number;
      y: number;
    }
    let panelState: PanelState | null = null;
    let panelAnimFrame: number | null = null;

    function halfExtentsOf(spec: ShapeSpec): { hw: number; hh: number } {
      if (spec.kind === "rect") return { hw: spec.size, hh: spec.size2 ?? spec.size };
      // Circle radius / triangle circumradius are both already a
      // reasonable half-extent approximation for a starting rectangle.
      return { hw: spec.size, hh: spec.size };
    }

    function replaceBodyAt(index: number, next: Matter.Body) {
      Composite.remove(engine.world, bodies[index]);
      bodies[index] = next;
      Composite.add(engine.world, next);
    }

    // Drives both expand and shrink: eases the panel body's size/position
    // from panelState's current live values to the given target over
    // `durationMs` (see PANEL_OPEN_DURATION_MS/PANEL_CLOSE_DURATION_MS),
    // scaling the real physics body every frame (so it keeps shoving other
    // bodies out of its growing footprint) and updating the <rect>'s
    // attributes to match — position/rotation are already handled every
    // frame by the main tick() loop below, since bodies[index] is this
    // same body.
    function animatePanelTo(toHw: number, toHh: number, toX: number, toY: number, durationMs: number, onDone?: () => void) {
      const ps = panelState;
      if (!ps) return;
      const body = bodies[ps.index];
      const fromHw = ps.hw;
      const fromHh = ps.hh;
      const fromX = ps.x;
      const fromY = ps.y;
      if (panelAnimFrame !== null) cancelAnimationFrame(panelAnimFrame);
      const startTime = performance.now();
      let prevHw = fromHw;
      let prevHh = fromHh;
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / durationMs);
        const eased = easeInOutCubic(t);
        const hw = fromHw + (toHw - fromHw) * eased;
        const hh = fromHh + (toHh - fromHh) * eased;
        const x = fromX + (toX - fromX) * eased;
        const y = fromY + (toY - fromY) * eased;

        const scaleX = hw / prevHw;
        const scaleY = hh / prevHh;
        if (scaleX !== 1 || scaleY !== 1) Body.scale(body, scaleX, scaleY);
        Body.setPosition(body, { x, y });
        prevHw = hw;
        prevHh = hh;

        ps.hw = hw;
        ps.hh = hh;
        ps.x = x;
        ps.y = y;
        ps.rectEl.setAttribute("width", String(hw * 2));
        ps.rectEl.setAttribute("height", String(hh * 2));
        ps.rectEl.setAttribute("x", String(-hw));
        ps.rectEl.setAttribute("y", String(-hh));
        ps.rectEl.setAttribute("rx", String(Math.min(hw, hh, PANEL_RADIUS)));

        if (t < 1) {
          panelAnimFrame = requestAnimationFrame(step);
        } else {
          panelAnimFrame = null;
          onDone?.();
        }
      };
      panelAnimFrame = requestAnimationFrame(step);
    }

    function beginExpand(index: number) {
      if (panelState || transitioning) return;
      const spec = specs[index];
      if (!spec.pageId) return;
      // A manual click beats the auto-open beat (see
      // handleInternshipsAutoOpen) — without this, closing a manually-
      // opened panel just before that timer fires would have it pop back
      // open on its own right after.
      if (autoExpandTimer) {
        clearTimeout(autoExpandTimer);
        autoExpandTimer = null;
      }
      if (hoveredIndex === index) {
        elements[index].style.filter = "";
        hoveredIndex = -1;
      }

      const body = bodies[index];
      const { hw, hh } = halfExtentsOf(spec);
      const x = body.position.x;
      const y = body.position.y;

      // Swap to a plain rectangle body seeded at the original footprint
      // (rather than trying to smoothly morph a circle/triangle's actual
      // vertices) so the very first frame of growth is seamless regardless
      // of the original shape's kind, and stays a simple, predictable
      // collider for the rest of the animation.
      const rectBody = Bodies.rectangle(x, y, hw * 2, hh * 2, { isStatic: true, restitution: 0, friction: 0 });
      replaceBodyAt(index, rectBody);

      const rectEl = document.createElementNS(ns, "rect") as SVGRectElement;
      rectEl.setAttribute("width", String(hw * 2));
      rectEl.setAttribute("height", String(hh * 2));
      rectEl.setAttribute("x", String(-hw));
      rectEl.setAttribute("y", String(-hh));
      rectEl.setAttribute("rx", String(Math.min(hw, hh, PANEL_RADIUS)));
      rectEl.setAttribute("fill", spec.color);
      rectEl.style.transition = "fill 0.35s ease";
      elements[index].replaceChildren(rectEl);
      // A glowing UI panel would read as a bug, not a feature, and the
      // label's job is done the instant it's actually been clicked.
      if (glowElements[index]) glowElements[index]!.style.display = "none";
      if (labelElements[index]) {
        labelElements[index]!.style.transitionDuration = `${LABEL_HIDE_MS}ms`;
        labelElements[index]!.style.opacity = "0";
      }

      panelState = { index, spec, rectEl, originX: x, originY: y, originHw: hw, originHh: hh, hw, hh, x, y };

      const targetHw = Math.min(window.innerWidth * 0.43, PANEL_MAX_WIDTH / 2);
      const targetHh = Math.min(window.innerHeight * 0.39, PANEL_MAX_HEIGHT / 2);
      const targetX = window.scrollX + window.innerWidth / 2;
      const targetY = window.scrollY + window.innerHeight / 2;

      animatePanelTo(targetHw, targetHh, targetX, targetY, PANEL_OPEN_DURATION_MS, () => {
        rectEl.style.fill = "var(--color-surface)";
        rectEl.setAttribute("stroke", spec.color);
        rectEl.setAttribute("stroke-width", "3");
        onOpenPanelRef.current?.(spec.pageId!, spec.color);
      });
    }

    // onDone (used by handlePointerDown below) lets a click on a *different*
    // pageId shape swap panels directly — close, then immediately open the
    // new one — instead of forcing a click-to-close and a separate click-
    // to-open.
    function beginShrink(onDone?: () => void) {
      const ps = panelState;
      if (!ps) return;
      ps.rectEl.style.fill = ps.spec.color;
      ps.rectEl.removeAttribute("stroke");
      onClosePanelRef.current?.();

      animatePanelTo(ps.originHw, ps.originHh, ps.originX, ps.originY, PANEL_CLOSE_DURATION_MS, () => {
        const restored = createShapeBody(ps.spec, ps.x, ps.y);
        replaceBodyAt(ps.index, restored);
        elements[ps.index].replaceChildren(createShapeElement(ps.spec));
        if (glowElements[ps.index]) glowElements[ps.index]!.style.display = "";
        // Still settled at this point (gravityEngaged never toggled off
        // during an expand/shrink) and it already played its landing
        // reveal well before it was ever clicked, so just show it again
        // quickly rather than replaying the slow version.
        if (labelElements[ps.index]) {
          labelElements[ps.index]!.style.transitionDuration = `${LABEL_HIDE_MS}ms`;
          labelElements[ps.index]!.style.opacity = "1";
        }
        panelState = null;
        onDone?.();
      });
    }

    function handlePointerDown(e: PointerEvent) {
      if (transitioning) return;
      if (panelState) {
        const target = e.target as Element | null;
        if (target?.closest("[data-panel-overlay]")) return; // a click inside the content itself
        // A click that lands on a *different* pageId shape (the open
        // panel's own body has been shoved elsewhere/shrunk to make room,
        // so plenty of the board is still clickable around it) swaps
        // straight to that one instead of requiring a separate close-then-
        // reopen — see beginShrink's onDone.
        const openIndex = panelState.index;
        const docX = e.clientX + window.scrollX;
        const docY = e.clientY + window.scrollY;
        const hits = Query.point(bodies, { x: docX, y: docY });
        const hitIndex = hits.length > 0 ? bodies.indexOf(hits[0]) : -1;
        const hitSpec = hitIndex >= 0 ? specs[hitIndex] : null;
        if (hitSpec?.pageId && hitIndex !== openIndex) {
          // Keeps the wheel-driven timeline (see handleWheel) in step with
          // wherever a manual click just took the visitor, so scrolling
          // afterward continues on from *here* rather than from wherever
          // it last was.
          const nav = pageShapeIndices.indexOf(hitIndex) + 1;
          if (nav > 0) pageIndex = nav;
          beginShrink(() => beginExpand(hitIndex));
        } else {
          beginShrink();
        }
        return;
      }
      if (!gravityEngaged) return; // only clickable once settled, same as hover
      const docX = e.clientX + window.scrollX;
      const docY = e.clientY + window.scrollY;
      const hits = Query.point(bodies, { x: docX, y: docY });
      const hitIndex = hits.length > 0 ? bodies.indexOf(hits[0]) : -1;
      if (hitIndex < 0) return;
      const hitSpec = specs[hitIndex];
      if (hitSpec.pageId) {
        const nav = pageShapeIndices.indexOf(hitIndex) + 1;
        if (nav > 0) pageIndex = nav;
        beginExpand(hitIndex);
      } else if (hitSpec.kind === "switch") {
        toggleNightMode();
      } else if (hitSpec.kind === "glow-button") {
        toggleGlow();
      } else if (hitSpec.kind === "language-toggle") {
        toggleLanguage();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);

    // Snap-scroll: the page is only ever fully docked at the top (zero-g
    // hero) or fully at the bottom (gravity-settled) section — one wheel
    // gesture animates the whole way there instead of requiring continuous
    // scrolling. `transitioning` locks out further wheel input (including
    // a trackpad's trailing inertial events, via SNAP_COOLDOWN_MS after
    // landing) so one gesture can't double-trigger or get interrupted
    // partway.
    let atTop = window.scrollY < window.innerHeight / 2;
    let transitioning = false;
    let scrollAnimFrame: number | null = null;
    let cooldownTimer: ReturnType<typeof setTimeout> | null = null;

    function animateScrollTo(targetY: number, onDone?: () => void) {
      transitioning = true;
      const startY = window.scrollY;
      const distance = targetY - startY;
      const startTime = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / SNAP_DURATION_MS);
        window.scrollTo(0, startY + distance * easeInOutCubic(t));
        if (t < 1) {
          scrollAnimFrame = requestAnimationFrame(step);
        } else {
          scrollAnimFrame = null;
          onDone?.();
          cooldownTimer = setTimeout(() => {
            transitioning = false;
            cooldownTimer = null;
          }, SNAP_COOLDOWN_MS);
        }
      };
      scrollAnimFrame = requestAnimationFrame(step);
    }

    // Opens the `nav`th page (1-based — nav 1 is pageShapeIndices[0], and
    // so on), closing whatever's currently open first if anything is —
    // this is what turns a wheel tick into "close the current page, open
    // the next/previous one" instead of requiring a separate click. Used
    // for every page-to-page step; the hero<->page-1 step is handled
    // separately in handleWheel since that one also has to scroll.
    function goToPageShape(nav: number) {
      const shapeIndex = pageShapeIndices[nav - 1];
      if (shapeIndex === undefined) return;
      pageIndex = nav;
      if (panelState) {
        panelNavigating = true;
        beginShrink(() => {
          panelNavigating = false;
          beginExpand(shapeIndex);
        });
      } else {
        beginExpand(shapeIndex);
      }
    }

    // The hero end of the timeline: closes whatever page is open (if any),
    // scrolls back up, and relaunches the shapes upward, all together —
    // same as the original scroll-up-from-the-bottom behavior, just also
    // reachable from a couple of pages deep instead of only the first one.
    function goToHero() {
      pageIndex = 0;
      atTop = true;
      manualGravityOverride = false;
      if (panelState) {
        panelNavigating = true;
        beginShrink(() => {
          panelNavigating = false;
        });
      }
      launchShapesUpward();
      animateScrollTo(0, () => {
        manualGravityOverride = null;
      });
    }

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (transitioning || panelNavigating || Math.abs(e.deltaY) < WHEEL_DEADZONE) return;
      if (e.deltaY > 0) {
        if (atTop) {
          // hero -> page 1: Internships opens itself once it actually
          // lands (see handleInternshipsAutoOpen), not from here directly.
          atTop = false;
          pageIndex = 1;
          animateScrollTo(window.innerHeight);
        } else if (!panelState) {
          // Nothing open right now — either the current page's shape is
          // still mid-fall (pageIndex was already set heading into the
          // bottom section, above) or a panel was closed manually. Either
          // way, make sure *that* one opens rather than skipping past it.
          goToPageShape(Math.max(1, pageIndex));
        } else if (pageIndex < maxPageIndex) {
          goToPageShape(pageIndex + 1);
        }
      } else if (pageIndex > 1) {
        goToPageShape(pageIndex - 1);
      } else if (!atTop) {
        goToHero();
      }
    }
    window.addEventListener("wheel", handleWheel, { passive: false });

    const FRAME_MS = 1000 / 60;
    let frameId: number;
    function tick() {
      const shouldEngageGravity =
        manualGravityOverride ?? window.scrollY > window.innerHeight * GRAVITY_TRIGGER_FRACTION;
      setGravityMode(shouldEngageGravity);
      updateFloor();

      if (hasMouse) {
        // Read scroll position fresh each frame — the document point under
        // the cursor changes when the page scrolls even without a new
        // pointermove event.
        const docMouseX = lastClientX + window.scrollX;
        const docMouseY = lastClientY + window.scrollY;

        // Sub-step the cursor's movement so a large jump between two
        // updates (a fast flick, or scrolling) can't tunnel straight
        // through a shape without the discrete collision check ever seeing
        // an overlap — each step advances the cursor no further than its
        // own radius. Each substep gets a proportional slice of the
        // frame's timestep, so overall simulation speed doesn't change
        // with the step count.
        const dx = docMouseX - lastCommandedX;
        const dy = docMouseY - lastCommandedY;
        const dist = Math.hypot(dx, dy);
        const steps = Math.min(20, Math.max(1, Math.ceil(dist / CURSOR_RADIUS)));
        const stepDelta = FRAME_MS / steps;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          Body.setVelocity(cursorBody, { x: dx / steps, y: dy / steps });
          Body.setPosition(cursorBody, { x: lastCommandedX + dx * t, y: lastCommandedY + dy * t });
          Engine.update(engine, stepDelta);
        }
        lastCommandedX = docMouseX;
        lastCommandedY = docMouseY;

        // Hover feedback (a stand-in for "clickable" — see the intro
        // comment): only once settled, only the big `interactive` shapes
        // respond, and not while a panel is already open (its body is
        // technically still hit-testable, but it's a UI panel now, not a
        // shape to darken).
        if (gravityEngaged && !panelState) {
          const hits = Query.point(bodies, { x: docMouseX, y: docMouseY });
          const hitIndex = hits.length > 0 ? bodies.indexOf(hits[0]) : -1;
          const newIndex = hitIndex >= 0 && specs[hitIndex].interactive ? hitIndex : -1;
          if (newIndex !== hoveredIndex) {
            if (hoveredIndex >= 0) elements[hoveredIndex].style.filter = "";
            if (newIndex >= 0) elements[newIndex].style.filter = HOVER_FILTER;
            hoveredIndex = newIndex;
          }
          // The SVG itself is pointer-events-none (the cursor is a real
          // physics body, not a native hover target), so the *visible*
          // system cursor has to be set on something that actually is
          // hit-testable — the page body underneath it all.
          document.body.style.cursor = hitIndex >= 0 && isClickableSpec(specs[hitIndex]) ? "pointer" : "";
        } else if (document.body.style.cursor === "pointer") {
          document.body.style.cursor = "";
        }
      } else {
        Engine.update(engine, FRAME_MS);
      }

      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const transform = `translate(${b.position.x.toFixed(2)} ${b.position.y.toFixed(2)}) rotate(${(b.angle * (180 / Math.PI)).toFixed(2)})`;
        glowElements[i]?.setAttribute("transform", transform);
        // Position-only, no rotation — a label should stay upright and
        // legible even if the shape it's riding on settles at an angle.
        labelElements[i]?.setAttribute("transform", `translate(${b.position.x.toFixed(2)} ${b.position.y.toFixed(2)})`);
        if (dittoBlob && i === dittoIndex) {
          // The blob's path/face are drawn in absolute coordinates and
          // updated directly (see stepDittoBlob) — no <g> transform here,
          // that would double up with the translate it already bakes in.
          stepDittoBlob(dittoBlob, b.position.x, b.position.y, b.angle);
          continue;
        }
        elements[i].setAttribute("transform", transform);
        if (knockoutClipShapeEls[i]) {
          updateClipShapeElement(knockoutClipShapeEls[i], specs[i], b.position.x, b.position.y, b.angle, knockoutOriginX, knockoutOriginY);
        }
      }

      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
      if (scrollAnimFrame !== null) cancelAnimationFrame(scrollAnimFrame);
      if (cooldownTimer !== null) clearTimeout(cooldownTimer);
      if (autoExpandTimer !== null) clearTimeout(autoExpandTimer);
      if (panelAnimFrame !== null) cancelAnimationFrame(panelAnimFrame);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("wheel", handleWheel);
      Events.off(engine, "collisionStart", handleFloorCollision);
      Events.off(engine, "collisionActive", handleInternshipsAutoOpen);
      Events.off(engine, "collisionStart", handleInternshipsAutoOpen);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      defs.remove();
      glowLayer.remove();
      shapeLayer.remove();
      labelLayer.remove();
      if (knockoutCopy) knockoutCopy.style.clipPath = "";
      if (document.body.style.cursor === "pointer") document.body.style.cursor = "";
    };
  }, []);

  return (
    <>
      <svg ref={svgRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 w-full" />
      {/* The white knockout copy of Hero's name (see the setup effect
          above) — same Tailwind classes as the real one, just white, and a
          genuine top-level sibling here (not nested in Hero, which sits
          *below* the shapes) so it can actually paint above them. Position
          is set by the effect (layoutKnockoutCopy); the clip-path starts
          empty so nothing shows before that JS attaches. */}
      <h1
        ref={knockoutCopyRef}
        aria-hidden
        style={{ clipPath: "circle(0px at 0px 0px)" }}
        className="pointer-events-none absolute z-[25] text-balance text-center font-display text-7xl font-semibold tracking-tight text-white sm:text-8xl lg:text-9xl"
      >
        William Shiao
      </h1>
    </>
  );
}
