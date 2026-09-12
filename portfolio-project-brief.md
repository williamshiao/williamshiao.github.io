# Portfolio Website — Project Brief

## Goal
A personal portfolio site for William, a software engineering graduate and aspiring UI/UX engineer, currently studying usability/UX at Polytechnique Montréal. Audience is a mix of general software engineering recruiters and UI/UX-focused recruiters/studios. The site must simultaneously prove strong engineering fundamentals and strong design/craft sensibility.

## Scope (v1 — deliberately small)
Three sections only:
1. **About / Who I am**
2. **Artworks** — showcase of personal drawings
3. **Internship Experience** — write-up of past internships (DevOps at Frima Studio, QA at Equisoft)

No blog, no extra pages, no CMS. Ship small, ship polished.

## Signature Interaction ("the hook")
A custom cursor replacement: a blob/goo creature (inspired by — not a literal recreation of — Pokémon's Ditto) that:
- By default, droops downward under simulated gravity, as if pinched and held by the cursor.
- When hovering over an interactable element (e.g. the "Artworks" nav item), rapidly molds itself around that element's full bounding box and shifts color to pink/purple.
- On hover-off, pops back off the element and returns to its default drooping blob form, tracking the cursor again.

### Technical approach
- NOT a rigid-body physics engine (ruled out Matter.js — wrong tool, this is soft-body/shape-morphing, not collision).
- Blob represented as multiple control points forming its outline.
- Each control point chases a target position using spring/lerp motion (velocity += (target - position) * stiffness, damping applied each frame) rather than snapping directly to the mouse — this produces the lag/droop/squish look.
- Leading point(s) target the mouse; trailing points target the point ahead of them (more lag = more goop trail).
- Constant small downward force added to simulate gravity at rest.
- On hover over a target: control point targets switch from mouse-position to points along the target element's bounding box perimeter, with a simultaneous color cross-fade.
- On hover-off: targets revert to mouse-chase, spring stiffness naturally "pops" the shape back.
- Candidate implementations: start from the open-source **Blobity** library (supports magnetic hover-morph-to-element out of the box, React-compatible) and customize; or build fully custom via SVG path + control points + GSAP for tweening, with an SVG goo filter (feGaussianBlur + feColorMatrix) if compositing multiple shapes into one blob.
- Everything in 2D (explicit performance decision — no 3D/WebGL needed).

## Visual Direction
- Overall site: clean, mostly white, pastel/low-saturation palette.
- Ditto (the blob cursor) is the visual focus and the most saturated element on the page — pink/purple, standing out clearly against the muted backdrop.
- Important text/headers can carry a bit more visual weight than body content, but should stay within the clean/pastel system.
- Leaning toward a pixel art / game-inspired feel, degree still to be decided. Likely direction: pixel art as accent/detail (icon set, thumbnail framing, header font) rather than a fully retro/8-bit treatment — keep overall layout and type clean/modern, use pixel art in supporting details so it doesn't compete with Ditto for saturation or attention. Not finalized — leave room for this in structure/CSS rather than ruling it in or out.

## Stack
- **React + Vite + TypeScript**
- **Tailwind CSS** for layout/styling
- **GSAP** for the blob's procedural motion/tweening (better fit than Framer Motion for this specific continuous-motion, point-tweening use case)
- **Framer Motion** optionally for standard section/scroll-reveal transitions elsewhere on the site (can coexist with GSAP)
- **Blobity** (open source) as a possible starting point for the cursor-blob mechanic, to be customized/replaced with fully custom implementation if needed
- Deploy target: **Vercel** (free, deploys from GitHub repo, zero-config for Vite)

## Build Order
1. Static structure first: About / Artworks / Internships sections, real content, no animation yet. Get layout and copy right.
2. Layer in section-level motion (scroll reveals, hover states) via Framer Motion.
3. Build the signature blob cursor interaction as its own isolated component, get the droop + mold + pop-back behavior solid in isolation before wiring it to real nav elements.
4. Wire the blob interaction to the real interactable elements (nav items / section links).
5. Polish pass + deploy.

## Open / Not Yet Decided
- Exact degree of pixel art / game-feel styling — accent-level direction is set, specifics (icon set, header font, thumbnail treatment) not yet chosen.
- Copy/content for About and Internship sections — not yet written.
- Starting with Blobity library as the base for the cursor-blob mechanic (decided) — customize from there as needed; open to moving to a fully custom implementation later if Blobity proves limiting.

## Notes on Working With Claude Code
- Planning, content, and copy decisions were made in Claude chat.
- Claude Code (VS Code extension or terminal, run directly against the local project repo) is intended for actual implementation — scaffolding, building components, running the dev server, git.
- Cowork was considered but is better suited to non-code document/knowledge work; not recommended for this project's actual build phase.
