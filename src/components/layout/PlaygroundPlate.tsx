/**
 * The one continuous white "habitat" the shapes live in — a single element
 * spanning the whole scrollable playground height, not two separate boxes
 * with a gap between them, so scrolling from the zero-g top down to the
 * gravity-settled bottom reads as one seamless space. `data-plate-bounds`
 * is what FloatingShapes reads for wall placement.
 */
export function PlaygroundPlate() {
  return (
    <div
      aria-hidden
      data-plate-bounds
      className="pointer-events-none absolute inset-4 z-0 rounded-[2rem] border border-line
                 bg-surface shadow-[0_1px_2px_rgba(36,31,46,0.04),0_30px_60px_-30px_rgba(36,31,46,0.25)]
                 sm:inset-10 sm:rounded-[2.5rem]"
    />
  );
}
