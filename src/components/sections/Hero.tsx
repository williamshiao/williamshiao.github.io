import { useLanguage } from "../../context/LanguageContext";

// TODO(content): placeholder bio — replace with real copy once drafted
// (in both languages together — see i18n/strings.ts).
// This is the terrarium's resting/home state — the first thing a visitor
// sees, so it carries far more visual weight than anything in the tab panels.
export function Hero() {
  const { t } = useLanguage();
  return (
    <div className="absolute inset-4 z-30 flex flex-col items-center justify-center overflow-hidden px-6 text-center sm:inset-10">
      {/* Soft color-glow accents — the only decoration on an otherwise plain-type hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[32rem] w-[32rem] rounded-full bg-pastel-pink/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-72 w-72 -translate-x-40 translate-y-24 rounded-full bg-pastel-blue/20 blur-3xl"
      />

      {/* flex + items-center centers each line by its own box, independent of
          the others' widths — three separate inline-block siblings here
          previously flowed like inline content (side-by-side when they fit),
          which is what threw the centering off. */}
      <div className="relative flex w-full flex-col items-center">
        {/* text-white + mix-blend-difference: against the plain background
            this inverts to a normal dark readable color, but wherever a
            physics shape passes underneath, the blend flips to that
            shape's own inverse color — the "knockout" effect from the
            hand-drawn mockup. Needs to paint above FloatingShapes' SVG
            (z-20), hence this whole section sitting at z-30. */}
        <p
          data-blob-target="text"
          className="mix-blend-difference font-pixel text-xs uppercase tracking-widest text-white sm:text-sm"
        >
          {t("heroTagline")}
        </p>
        <h1
          data-blob-target="text"
          className="mix-blend-difference mt-6 text-balance text-center font-display text-7xl font-semibold tracking-tight text-white sm:text-8xl lg:text-9xl"
        >
          William Shiao
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-balance text-lg text-ink-soft sm:text-xl">{t("heroBio")}</p>
        {/* TODO(content): expand bio further, add a contact/CTA line once decided. */}
      </div>
    </div>
  );
}
