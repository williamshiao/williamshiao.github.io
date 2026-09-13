/**
 * The second "page" — a plate matching the Terrarium's look, sized to its
 * own viewport-tall section. Once scrolled into view, gravity switches on
 * (see FloatingShapes) and the shapes that were floating up in the
 * Terrarium fall down through into this space and settle here, where
 * they'll eventually double as page navigation. `data-floor-bounds` marks
 * where FloatingShapes should place this section's floor/walls.
 */
export function GravityFloor() {
  return (
    <div
      aria-hidden
      data-floor-bounds
      className="pointer-events-none absolute inset-4 z-0 rounded-[2rem] border border-line
                 bg-surface shadow-[0_1px_2px_rgba(36,31,46,0.04),0_30px_60px_-30px_rgba(36,31,46,0.25)]
                 sm:inset-10 sm:rounded-[2.5rem]"
    />
  );
}
