import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { generateShapes, type ShapeSpec } from "./shapes";

/**
 * A physics playground spanning two scroll-snapped sections: the top
 * "terrarium" (zero gravity, zero friction — shapes drift forever, bouncing
 * elastically off its walls, off each other, and off the cursor, which is
 * itself an invisible physical body) and a "floor" section below it. Which
 * mode is active follows the *current* scroll position, not a one-way
 * latch: whenever the floor section is in view, gravity is on, shapes
 * settle (restitution/friction both increase so they actually come to
 * rest instead of bouncing forever), and the cursor stops physically
 * colliding with them (it becomes a sensor — still tracked, just can't
 * knock things around) so you can actually point at and hover a settled
 * shape without shoving it out from under the cursor first. Scrolling back
 * up to the terrarium reverses all of that: gravity off, shapes elastic
 * again, cursor collision back on.
 *
 * Two shape tiers (see ./shapes): a larger population of small decorative
 * ones, and a handful of significantly bigger `interactive` ones — only
 * those darken on hover once settled, since they're the ones meant to
 * eventually double as real page navigation.
 *
 * Matter.js (MIT) rather than custom code: rigid-body elastic collision
 * among several bodies is its home turf. Position/size/color are generated
 * fresh every load (see ./shapes) rather than fixed.
 */

const { Engine, Bodies, Body, Composite, Query } = Matter;

const SMALL_SHAPE_COUNT = 12;
const BIG_SHAPE_COUNT = 5;
const WALL_THICKNESS = 100; // generous, so fast bodies can't tunnel through on one big step
const CURSOR_RADIUS = 14;
const CURSOR_MASS = 60; // heavy relative to the shapes — a paddle, not another puck
const SPAWN_SPEED = 2.2; // px/frame, initial drift speed

const GRAVITY_Y = 1;
// Shapes are perfectly elastic/frictionless while floating; SETTLE_* apply
// only while gravity is engaged, so they actually come to rest on the
// floor instead of bouncing forever. Switching back reverts to these.
const ELASTIC_RESTITUTION = 1;
const ELASTIC_FRICTION = 0;
const ELASTIC_FRICTION_AIR = 0;
const SETTLE_RESTITUTION = 0.4;
const SETTLE_FRICTION = 0.06;
const SETTLE_FRICTION_AIR = 0.02;

const HOVER_FILTER = "brightness(0.72)";

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
    restitution: 1,
    friction: 0,
    frictionAir: 0,
    frictionStatic: 0,
    angle: spec.rotation ?? 0,
  };
  if (spec.kind === "circle") {
    return Bodies.circle(x, y, spec.size, common);
  }
  if (spec.kind === "rect") {
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

export function FloatingShapes() {
  const svgRef = useRef<SVGSVGElement>(null);

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

    // Walls: top + left + right always bound the terrarium section; the
    // "floor" wall sits at the terrarium's bottom until gravity engages,
    // then relocates to the floor section's bottom, opening the terrarium
    // up so anything still airborne falls through into it.
    let wallBodies: Matter.Body[] = [];
    function rebuildWalls() {
      Composite.remove(engine.world, wallBodies);
      const terrarium = getDocRect("[data-terrarium-bounds]");
      const floor = getDocRect("[data-floor-bounds]");
      if (!terrarium) {
        wallBodies = [];
        return;
      }
      const t = WALL_THICKNESS;
      const bottom = gravityEngaged && floor ? floor.bottom : terrarium.bottom;
      const spanTop = terrarium.top;
      const spanHeight = bottom - spanTop;
      const cx = terrarium.left + terrarium.width / 2;
      const wallOpts = { isStatic: true, restitution: 1, friction: 0 };
      wallBodies = [
        Bodies.rectangle(cx, spanTop - t / 2, terrarium.width + t * 2, t, wallOpts), // top
        Bodies.rectangle(cx, bottom + t / 2, terrarium.width + t * 2, t, wallOpts), // floor
        Bodies.rectangle(terrarium.left - t / 2, spanTop + spanHeight / 2, t, spanHeight + t * 2, wallOpts), // left
        Bodies.rectangle(terrarium.right + t / 2, spanTop + spanHeight / 2, t, spanHeight + t * 2, wallOpts), // right
      ];
      Composite.add(engine.world, wallBodies);
    }
    rebuildWalls();

    const handleResize = () => {
      setViewport();
      rebuildWalls();
    };
    window.addEventListener("resize", handleResize);

    // Shape bodies, spread out inside the terrarium with a small random walk
    // of initial velocity — Matter's own solver untangles any initial
    // overlap over the first few frames.
    const terrariumRect = getDocRect("[data-terrarium-bounds]");
    const shapes = generateShapes(SMALL_SHAPE_COUNT, BIG_SHAPE_COUNT);
    const ns = "http://www.w3.org/2000/svg";
    const shapeLayer = document.createElementNS(ns, "g");
    svg.appendChild(shapeLayer);

    const bodies: Matter.Body[] = [];
    const elements: SVGGElement[] = [];
    const interactiveFlags: boolean[] = [];
    shapes.forEach((spec, i) => {
      const cx = terrariumRect ? terrariumRect.left + terrariumRect.width / 2 : window.innerWidth / 2;
      const cy = terrariumRect ? terrariumRect.top + terrariumRect.height / 2 : window.innerHeight / 2;
      const spreadX = terrariumRect ? terrariumRect.width * 0.3 : 200;
      const spreadY = terrariumRect ? terrariumRect.height * 0.3 : 200;
      const angle = (i / shapes.length) * Math.PI * 2;
      const x = cx + Math.cos(angle) * spreadX * (0.5 + 0.5 * Math.random());
      const y = cy + Math.sin(angle) * spreadY * (0.5 + 0.5 * Math.random());

      const body = createShapeBody(spec, x, y);
      const dir = Math.random() * Math.PI * 2;
      Body.setVelocity(body, { x: Math.cos(dir) * SPAWN_SPEED, y: Math.sin(dir) * SPAWN_SPEED });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
      bodies.push(body);
      interactiveFlags.push(spec.interactive);

      const g = document.createElementNS(ns, "g") as SVGGElement;
      g.style.transition = "filter 0.15s ease";
      g.appendChild(createShapeElement(spec));
      shapeLayer.appendChild(g);
      elements.push(g);
    });
    Composite.add(engine.world, bodies);

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

    // Which mode is active follows the *current* scroll position (see the
    // IntersectionObserver below), not a one-way latch — scrolling back up
    // reverses all of it.
    let hoveredIndex = -1;
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
      rebuildWalls();
    }
    const floorEl = document.querySelector("[data-floor-bounds]");
    let observer: IntersectionObserver | null = null;
    if (floorEl) {
      observer = new IntersectionObserver(
        (entries) => {
          const isVisible = entries.some((entry) => entry.isIntersecting);
          setGravityMode(isVisible);
        },
        { threshold: 0.3 },
      );
      observer.observe(floorEl);
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

    const FRAME_MS = 1000 / 60;
    let frameId: number;
    function tick() {
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
        // comment): only once settled, and only the big `interactive`
        // shapes respond — the small ones stay purely decorative.
        if (gravityEngaged) {
          const hits = Query.point(bodies, { x: docMouseX, y: docMouseY });
          const hitIndex = hits.length > 0 ? bodies.indexOf(hits[0]) : -1;
          const newIndex = hitIndex >= 0 && interactiveFlags[hitIndex] ? hitIndex : -1;
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
        elements[i].setAttribute("transform", `translate(${b.position.x.toFixed(2)} ${b.position.y.toFixed(2)}) rotate(${(b.angle * (180 / Math.PI)).toFixed(2)})`);
      }

      frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      document.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      shapeLayer.remove();
    };
  }, []);

  return <svg ref={svgRef} aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-20 w-full" />;
}
