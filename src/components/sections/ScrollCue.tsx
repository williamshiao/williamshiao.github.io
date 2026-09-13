/**
 * The classic "there's more below" affordance — a small bouncing chevron
 * fixed near the bottom of the hero's first screen, the same way the name
 * above it is fixed there. `data-scroll-cue` is the hook FloatingShapes
 * uses to find this element's on-screen position the instant the user
 * first scrolls down: it fades this out and, in its place, spawns a
 * matching triangle into the physics playground — the arrow "breaking
 * off" to join the other shapes for good (see makeArrowShape in
 * ./physics/shapes and FloatingShapes' convertArrowToShape).
 */
export function ScrollCue() {
  return (
    <div data-scroll-cue aria-hidden className="absolute inset-x-0 bottom-10 z-10 flex justify-center sm:bottom-14">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="animate-bounce text-ink-soft/60">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
