import { useEffect, useRef } from "react";
import Matter from "matter-js";
import { SHAPES, type ShapeSpec } from "./shapes";

/**
 * A zero-gravity, frictionless physics playground: a handful of solid-
 * colored shapes drift inside the terrarium, bouncing elastically off its
 * walls and off each other, and the cursor itself is a physical (invisible)
 * body that knocks them around on contact — an air-hockey table, not a
 * character. This replaces the earlier Ditto cursor concept for now (that
 * soft-body mesh code is banked, not deleted — recoverable from git log —
 * since it solved a different problem: one deformable body, not many rigid
 * ones bouncing off each other).
 *
 * Matter.js (MIT, no license concern) rather than custom code this time:
 * rigid-body elastic collision among several bodies is exactly its home
 * turf, and after the debugging spent getting a custom soft-body mesh
 * stable, reaching for a mature, widely-used engine for a *different* kind
 * of physics problem was the more sensible call.
 */

const { Engine, Bodies, Body, Composite } = Matter;

const WALL_THICKNESS = 100; // generous, so fast bodies can't tunnel through on one big step
const CURSOR_RADIUS = 14;
const CURSOR_MASS = 60; // heavy relative to the shapes — a paddle, not another puck
const SPAWN_SPEED = 2.2; // px/frame, initial drift speed

function getTerrariumRect(): DOMRect | null {
  const el = document.querySelector("[data-terrarium-bounds]");
  return el ? el.getBoundingClientRect() : null;
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
      svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    };
    setViewport();

    const engine = Engine.create({ gravity: { x: 0, y: 0 } });

    // Walls: rebuilt to match the terrarium's bounds whenever it resizes.
    let wallBodies: Matter.Body[] = [];
    function rebuildWalls() {
      Composite.remove(engine.world, wallBodies);
      const rect = getTerrariumRect();
      if (!rect) {
        wallBodies = [];
        return;
      }
      const t = WALL_THICKNESS;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const wallOpts = { isStatic: true, restitution: 1, friction: 0 };
      wallBodies = [
        Bodies.rectangle(cx, rect.top - t / 2, rect.width + t * 2, t, wallOpts), // top
        Bodies.rectangle(cx, rect.bottom + t / 2, rect.width + t * 2, t, wallOpts), // bottom
        Bodies.rectangle(rect.left - t / 2, cy, t, rect.height + t * 2, wallOpts), // left
        Bodies.rectangle(rect.right + t / 2, cy, t, rect.height + t * 2, wallOpts), // right
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
    const rect = getTerrariumRect();
    const ns = "http://www.w3.org/2000/svg";
    const shapeLayer = document.createElementNS(ns, "g");
    svg.appendChild(shapeLayer);

    const bodies: Matter.Body[] = [];
    const elements: SVGGElement[] = [];
    SHAPES.forEach((spec, i) => {
      const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      const spreadX = rect ? rect.width * 0.3 : 200;
      const spreadY = rect ? rect.height * 0.3 : 200;
      const angle = (i / SHAPES.length) * Math.PI * 2;
      const x = cx + Math.cos(angle) * spreadX * (0.5 + 0.5 * Math.random());
      const y = cy + Math.sin(angle) * spreadY * (0.5 + 0.5 * Math.random());

      const body = createShapeBody(spec, x, y);
      const dir = Math.random() * Math.PI * 2;
      Body.setVelocity(body, { x: Math.cos(dir) * SPAWN_SPEED, y: Math.sin(dir) * SPAWN_SPEED });
      Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
      bodies.push(body);

      const g = document.createElementNS(ns, "g") as SVGGElement;
      g.appendChild(createShapeElement(spec));
      shapeLayer.appendChild(g);
      elements.push(g);
    });
    Composite.add(engine.world, bodies);

    // The cursor is a real physics body — heavy relative to the shapes, and
    // manually driven to the mouse position every frame (rather than left
    // to the engine's own integration) so it always tracks exactly, while
    // still handing off realistic velocity to whatever it hits.
    const cursorBody = Bodies.circle(-9999, -9999, CURSOR_RADIUS, {
      restitution: 1,
      friction: 0,
      frictionAir: 0,
      inertia: Infinity, // don't let collisions spin the paddle
      mass: CURSOR_MASS,
    });
    Composite.add(engine.world, cursorBody);

    let mouseX = -9999;
    let mouseY = -9999;
    let hasMouse = false;
    let lastCommandedX = mouseX;
    let lastCommandedY = mouseY;
    function handlePointerMove(e: PointerEvent) {
      // First-ever move is the cursor "appearing" from off-screen — snap
      // straight there rather than sweeping a giant one-time jump through
      // the whole board.
      if (!hasMouse) {
        lastCommandedX = e.clientX;
        lastCommandedY = e.clientY;
      }
      mouseX = e.clientX;
      mouseY = e.clientY;
      hasMouse = true;
    }
    document.addEventListener("pointermove", handlePointerMove);

    const FRAME_MS = 1000 / 60;
    let frameId: number;
    function tick() {
      if (hasMouse) {
        // Sub-step the cursor's movement so a large jump between two
        // pointermove events (a fast flick, or several queued moves
        // arriving between animation frames) can't tunnel straight through
        // a shape without the discrete collision check ever seeing an
        // overlap — each step advances the cursor no further than its own
        // radius. Each substep gets a proportional slice of the frame's
        // timestep, so overall simulation speed doesn't change with the
        // step count — only the cursor's own path gets finer-grained.
        const dx = mouseX - lastCommandedX;
        const dy = mouseY - lastCommandedY;
        const dist = Math.hypot(dx, dy);
        const steps = Math.min(20, Math.max(1, Math.ceil(dist / CURSOR_RADIUS)));
        const stepDelta = FRAME_MS / steps;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          Body.setVelocity(cursorBody, { x: dx / steps, y: dy / steps });
          Body.setPosition(cursorBody, { x: lastCommandedX + dx * t, y: lastCommandedY + dy * t });
          Engine.update(engine, stepDelta);
        }
        lastCommandedX = mouseX;
        lastCommandedY = mouseY;
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
      document.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      shapeLayer.remove();
    };
  }, []);

  return <svg ref={svgRef} aria-hidden className="pointer-events-none fixed inset-0 z-20 h-screen w-screen" />;
}
