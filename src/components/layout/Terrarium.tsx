/**
 * The fixed white "habitat" plate Ditto lives in. Purely decorative — sits
 * behind everything else, never intercepts clicks.
 */
export function Terrarium() {
  return (
    <div
      aria-hidden
      data-terrarium-bounds
      className="pointer-events-none absolute inset-4 z-0 rounded-[2rem] border border-line
                 bg-surface shadow-[0_1px_2px_rgba(36,31,46,0.04),0_30px_60px_-30px_rgba(36,31,46,0.25)]
                 sm:inset-10 sm:rounded-[2.5rem]"
    />
  );
}
