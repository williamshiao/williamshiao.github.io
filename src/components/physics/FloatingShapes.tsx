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
 * Clicking the one shape tagged with a `pageId` (see ./shapes) once
 * settled grows it in place — via Body.scale + Body.setPosition each
 * frame, so it's a real collider the whole time and physically shoves
 * every other shape out of the way as it expands — into a big rounded
 * panel parked at the center of the viewport, at which point the caller
 * (see onOpenPanel) renders that page's real content on top of it.
 * Clicking outside the panel reverses the animation and swaps the body
 * back to its original shape/size, dropping it back into normal gravity
 * like anything else.
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
 * Matter.js (MIT) rather than custom code: rigid-body elastic collision
 * among several bodies is its home turf. Position/size/color are generated
 * fresh every load (see ./shapes) rather than fixed.
 */

const { Engine, Bodies, Body, Composite, Query } = Matter;

const PLATE_SELECTOR = "[data-plate-bounds]";
// Fewer small shapes than before — with a dozen of them bouncing around in
// a confined space, collisions kept handing velocity back and forth and
// the whole board read as too fast/chaotic even at the same base speed.
const SMALL_SHAPE_COUNT = 7;
const BIG_SHAPE_COUNT = 5;
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

const GRAVITY_Y = 1;
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
// never gets absurd on a huge monitor.
const PANEL_DURATION_MS = 650;
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
  if (spec.kind === "circle" || spec.kind === "glow-button") {
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
}

export function FloatingShapes({ onOpenPanel, onClosePanel }: FloatingShapesProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  // Refs rather than effect deps: the physics world below is built exactly
  // once (see the `[]` dependency array), and re-running all of that just
  // because the parent passed a fresh inline callback would tear down and
  // respawn every shape.
  const onOpenPanelRef = useRef(onOpenPanel);
  const onClosePanelRef = useRef(onClosePanel);
  useEffect(() => {
    onOpenPanelRef.current = onOpenPanel;
    onClosePanelRef.current = onClosePanel;
  }, [onOpenPanel, onClosePanel]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

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
    };
    window.addEventListener("resize", handleResize);

    // Shape bodies, spread out inside the plate's upper (zero-g) area with
    // a small random walk of initial velocity — Matter's own solver
    // untangles any initial overlap over the first few frames.
    const plateRect = getDocRect(PLATE_SELECTOR);
    const shapes = generateShapes(SMALL_SHAPE_COUNT, BIG_SHAPE_COUNT);
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

    const bodies: Matter.Body[] = [];
    const elements: SVGGElement[] = [];
    const specs: ShapeSpec[] = [];
    // Parallel to the above; null for the switch, which skips the glow
    // entirely (see the intro comment).
    const glowElements: (SVGGElement | null)[] = [];

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
    let glowButton: { glassEl: SVGCircleElement } | null = null;
    if (!glowEnabled) glowLayer.style.display = "none";

    function updateGlowButtonVisual() {
      if (!glowButton) return;
      glowButton.glassEl.setAttribute("fill", glowEnabled ? "#fde047" : "#9ca3af");
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

    // A little light bulb — glass, a zigzag filament, and a screw base —
    // that toggles the glow layer on click (see toggleGlow). Same
    // stencil-family outline treatment as the switch: bold var(--color-ink)
    // strokes, a var(--color-surface)-ish base so it always matches the
    // current theme.
    function spawnGlowButton(spec: ShapeSpec, x: number, y: number, vx: number, vy: number) {
      const body = createShapeBody(spec, x, y);
      Body.setVelocity(body, { x: vx, y: vy });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
      bodies.push(body);
      specs.push(spec);
      glowElements.push(null); // no glow — it's UI chrome, not a toy
      Composite.add(engine.world, body);

      const r = spec.size;
      const line = "var(--color-ink)";
      const strokeWidth = Math.max(1.5, r * 0.09);

      const g = document.createElementNS(ns, "g") as SVGGElement;
      g.style.transition = "filter 0.15s ease";

      // The glass bulb — its fill is the on/off state color (see
      // updateGlowButtonVisual), everything else is fixed ink/surface.
      const glassCy = -r * 0.1;
      const glassR = r * 0.6;
      const glassEl = document.createElementNS(ns, "circle") as SVGCircleElement;
      glassEl.setAttribute("cy", String(glassCy));
      glassEl.setAttribute("r", String(glassR));
      glassEl.setAttribute("stroke", line);
      glassEl.setAttribute("stroke-width", String(strokeWidth));
      g.appendChild(glassEl);

      // A simple zigzag filament inside the glass.
      const filamentY = glassCy + glassR * 0.35;
      const filamentTop = glassCy - glassR * 0.35;
      const filament = document.createElementNS(ns, "path");
      filament.setAttribute(
        "d",
        `M ${(-r * 0.2).toFixed(2)} ${filamentY.toFixed(2)} L ${(-r * 0.06).toFixed(2)} ${filamentTop.toFixed(2)} L ${(r * 0.06).toFixed(2)} ${filamentY.toFixed(2)} L ${(r * 0.2).toFixed(2)} ${filamentTop.toFixed(2)}`,
      );
      filament.setAttribute("fill", "none");
      filament.setAttribute("stroke", line);
      filament.setAttribute("stroke-width", String(strokeWidth * 0.55));
      filament.setAttribute("stroke-linecap", "round");
      filament.setAttribute("stroke-linejoin", "round");
      g.appendChild(filament);

      // Screw base — drawn last so it overlaps the bottom of the glass.
      const baseW = r * 0.56;
      const baseH = r * 0.34;
      const baseY = r * 0.26;
      const base = document.createElementNS(ns, "rect");
      base.setAttribute("x", String(-baseW / 2));
      base.setAttribute("y", String(baseY));
      base.setAttribute("width", String(baseW));
      base.setAttribute("height", String(baseH));
      base.setAttribute("rx", String(r * 0.06));
      base.setAttribute("fill", spec.color);
      base.setAttribute("stroke", line);
      base.setAttribute("stroke-width", String(strokeWidth * 0.85));
      g.appendChild(base);

      for (const ty of [baseY + baseH * 0.35, baseY + baseH * 0.68]) {
        const thread = document.createElementNS(ns, "line");
        thread.setAttribute("x1", String(-baseW / 2 + strokeWidth));
        thread.setAttribute("y1", String(ty));
        thread.setAttribute("x2", String(baseW / 2 - strokeWidth));
        thread.setAttribute("y2", String(ty));
        thread.setAttribute("stroke", line);
        thread.setAttribute("stroke-width", String(strokeWidth * 0.5));
        g.appendChild(thread);
      }

      shapeLayer.appendChild(g);
      elements.push(g);

      glowButton = { glassEl };
      updateGlowButtonVisual();
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
      const speed = i < SMALL_SHAPE_COUNT ? SPAWN_SPEED_SMALL : SPAWN_SPEED_BIG;
      const vx = Math.cos(dir) * speed;
      const vy = Math.sin(dir) * speed;
      if (spec.kind === "ditto") {
        spawnDittoBlob(spec, x, y, vx, vy);
      } else if (spec.kind === "switch") {
        spawnLightSwitch(spec, x, y, vx, vy);
      } else if (spec.kind === "glow-button") {
        spawnGlowButton(spec, x, y, vx, vy);
      } else {
        spawnShape(spec, x, y, vx, vy);
      }
    });

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
    // PANEL_DURATION_MS, scaling the real physics body every frame (so it
    // keeps shoving other bodies out of its growing footprint) and
    // updating the <rect>'s attributes to match — position/rotation are
    // already handled every frame by the main tick() loop below, since
    // bodies[index] is this same body.
    function animatePanelTo(toHw: number, toHh: number, toX: number, toY: number, onDone?: () => void) {
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
        const t = Math.min(1, (now - startTime) / PANEL_DURATION_MS);
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
      // A glowing UI panel would read as a bug, not a feature.
      if (glowElements[index]) glowElements[index]!.style.display = "none";

      panelState = { index, spec, rectEl, originX: x, originY: y, originHw: hw, originHh: hh, hw, hh, x, y };

      const targetHw = Math.min(window.innerWidth * 0.43, PANEL_MAX_WIDTH / 2);
      const targetHh = Math.min(window.innerHeight * 0.39, PANEL_MAX_HEIGHT / 2);
      const targetX = window.scrollX + window.innerWidth / 2;
      const targetY = window.scrollY + window.innerHeight / 2;

      animatePanelTo(targetHw, targetHh, targetX, targetY, () => {
        rectEl.style.fill = "var(--color-surface)";
        rectEl.setAttribute("stroke", spec.color);
        rectEl.setAttribute("stroke-width", "3");
        onOpenPanelRef.current?.(spec.pageId!, spec.color);
      });
    }

    function beginShrink() {
      const ps = panelState;
      if (!ps) return;
      ps.rectEl.style.fill = ps.spec.color;
      ps.rectEl.removeAttribute("stroke");
      onClosePanelRef.current?.();

      animatePanelTo(ps.originHw, ps.originHh, ps.originX, ps.originY, () => {
        const restored = createShapeBody(ps.spec, ps.x, ps.y);
        replaceBodyAt(ps.index, restored);
        elements[ps.index].replaceChildren(createShapeElement(ps.spec));
        if (glowElements[ps.index]) glowElements[ps.index]!.style.display = "";
        panelState = null;
      });
    }

    function handlePointerDown(e: PointerEvent) {
      if (transitioning) return;
      if (panelState) {
        const target = e.target as Element | null;
        if (target?.closest("[data-panel-overlay]")) return; // a click inside the content itself
        beginShrink();
        return;
      }
      if (!gravityEngaged) return; // only clickable once settled, same as hover
      const docX = e.clientX + window.scrollX;
      const docY = e.clientY + window.scrollY;
      const hits = Query.point(bodies, { x: docX, y: docY });
      const hitIndex = hits.length > 0 ? bodies.indexOf(hits[0]) : -1;
      if (hitIndex < 0) return;
      if (specs[hitIndex].pageId) {
        beginExpand(hitIndex);
      } else if (specs[hitIndex].kind === "switch") {
        toggleNightMode();
      } else if (specs[hitIndex].kind === "glow-button") {
        toggleGlow();
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

    function handleWheel(e: WheelEvent) {
      e.preventDefault();
      if (transitioning || panelState || Math.abs(e.deltaY) < WHEEL_DEADZONE) return;
      if (e.deltaY > 0 && atTop) {
        atTop = false;
        animateScrollTo(window.innerHeight);
      } else if (e.deltaY < 0 && !atTop) {
        atTop = true;
        manualGravityOverride = false;
        launchShapesUpward();
        animateScrollTo(0, () => {
          manualGravityOverride = null;
        });
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
        }
      } else {
        Engine.update(engine, FRAME_MS);
      }

      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        const transform = `translate(${b.position.x.toFixed(2)} ${b.position.y.toFixed(2)}) rotate(${(b.angle * (180 / Math.PI)).toFixed(2)})`;
        glowElements[i]?.setAttribute("transform", transform);
        if (dittoBlob && i === dittoIndex) {
          // The blob's path/face are drawn in absolute coordinates and
          // updated directly (see stepDittoBlob) — no <g> transform here,
          // that would double up with the translate it already bakes in.
          stepDittoBlob(dittoBlob, b.position.x, b.position.y, b.angle);
          continue;
        }
        elements[i].setAttribute("transform", transform);
      }

      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      if (scrollAnimFrame !== null) cancelAnimationFrame(scrollAnimFrame);
      if (cooldownTimer !== null) clearTimeout(cooldownTimer);
      if (panelAnimFrame !== null) cancelAnimationFrame(panelAnimFrame);
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("wheel", handleWheel);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      defs.remove();
      glowLayer.remove();
      shapeLayer.remove();
    };
  }, []);

  return <svg ref={svgRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 w-full" />;
}
