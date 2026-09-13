import { useLanguage } from "../../context/LanguageContext";

// TODO(content): placeholder bio — replace with real copy once drafted
// (in both languages together — see i18n/strings.ts).
// This is the terrarium's resting/home state — the first thing a visitor
// sees, so it carries far more visual weight than anything in the tab panels.
export function Hero() {
  const { t } = useLanguage();
  return (
    <div className="absolute inset-4 z-10 flex flex-col items-center justify-center overflow-hidden px-6 text-center sm:inset-10">
      {/* Soft color-glow accents — the only decoration on an otherwise plain-type hero. */}
      <div
        aria-hidden
        className="pointer-events-none absolute h-[32rem] w-[32rem] rounded-full bg-pastel-pink/50 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute h-72 w-72 -translate-x-40 translate-y-24 rounded-full bg-pastel-blue/40 blur-3xl"
      />

      {/* flex + items-center centers each line by its own box, independent of
          the others' widths — three separate inline-block siblings here
          previously flowed like inline content (side-by-side when they fit),
          which is what threw the centering off. */}
      <div className="relative flex w-full flex-col items-center">
        <p className="font-pixel text-xs uppercase tracking-widest text-ditto sm:text-sm">{t("heroTagline")}</p>
        {/* data-shape-knockout: FloatingShapes measures *this* element's own
            box (position/width only — never its font) and mirrors it onto a
            separate white copy of the same text that it renders itself,
            genuinely stacked above the shapes layer (not nested in here,
            which sits *below* the shapes — see FloatingShapes' intro comment
            for why a plain z-index on something inside this low-z container
            could never paint above them). That copy uses the exact same
            Tailwind classes as this one, so its own font/line-wrap is real
            CSS, not a JS-guessed approximation — only its left/top/width
            need to be kept in sync, which is just geometry, not fonts. */}
        <h1
          data-shape-knockout
          className="mt-6 text-balance text-center font-display text-7xl font-semibold tracking-tight text-ink sm:text-8xl lg:text-9xl"
        >
          William Shiao
        </h1>
        <p className="mx-auto mt-8 max-w-xl text-balance text-lg text-ink-soft sm:text-xl">{t("heroBio")}</p>
        {/* TODO(content): expand bio further, add a contact/CTA line once decided. */}
      </div>
    </div>
  );
}
