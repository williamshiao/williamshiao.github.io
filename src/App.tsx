import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { PlaygroundPlate } from "./components/layout/PlaygroundPlate";
import { Footer } from "./components/layout/Footer";
import { Hero } from "./components/sections/Hero";
import { Internships } from "./components/sections/Internships";
import { Contact } from "./components/sections/Contact";
import { Artworks } from "./components/sections/Artworks";
import { FloatingShapes } from "./components/physics/FloatingShapes";
import { useLanguage } from "./context/LanguageContext";
import { panelBackgroundTint } from "./utils/color";

interface OpenPanel {
  pageId: string;
  accentColor: string;
}

// The old tab-bar-driven layout (TabBar, ContentPanel, config/tabs) is
// shelved, not deleted — every real page (Internships, Contact, Artworks)
// is wired up instead via FloatingShapes' click-to-expand: clicking its
// shape grows it in place into a panel and reports back here (onOpenPanel)
// once that finishes, at which point this renders the actual page content
// on top of it. See
// FloatingShapes for the rest of the physics (zero-g at the top, gravity
// engages once scrolled down far enough, and the floor then tracks the
// current viewport bottom so settled shapes are never scrolled out of view).
//
// Language is owned up in LanguageProvider (see main.tsx), not here — the
// language-toggle shape reads/writes the same localStorage key on its own
// and just reports forward (onToggleLanguage) when it flips, the same
// pattern the panel/night-mode/glow shapes already use for the things
// *they* own.
function App() {
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);
  // Which page (if any) FloatingShapes wants a size measurement for right
  // now — see measurePanel below. Only ever set for the handful of
  // synchronous instants that function runs in; never lingers alongside a
  // genuinely open panel.
  const [measuringPageId, setMeasuringPageId] = useState<string | null>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const { t, setLang } = useLanguage();

  // Shared between the real, visible panel and the invisible measurement
  // clone below it (see measurePanel) so the two are guaranteed to render
  // identically — any drift between them would defeat the whole point of
  // measuring in the first place.
  function renderPanelBody(pageId: string) {
    if (pageId === "internships") {
      return (
        <>
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{t("internshipsTitle")}</h2>
          <div className="mt-8">
            <Internships />
          </div>
        </>
      );
    }
    if (pageId === "contact") {
      return (
        <>
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{t("contactTitle")}</h2>
          <div className="mt-8">
            <Contact />
          </div>
        </>
      );
    }
    if (pageId === "artworks") {
      return (
        <>
          <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{t("artworksTitle")}</h2>
          <div className="mt-8">
            <Artworks />
          </div>
        </>
      );
    }
    return null;
  }

  // Called by FloatingShapes the instant a shape starts growing (see its
  // onMeasurePanel doc comment) — renders that page's real content into an
  // identical, invisible clone of the real panel (same classes, so the
  // same max-w-[760px]/max-h-[78vh] constraints apply), then reads back
  // its actual rendered pixel size synchronously so the grow animation can
  // target that exact box instead of a generic guess. flushSync forces
  // React to commit and lay out the clone before this function returns —
  // without it the state update would just be scheduled, and there'd be
  // nothing to measure yet.
  function measurePanel(pageId: string): { width: number; height: number } | null {
    flushSync(() => setMeasuringPageId(pageId));
    const rect = measureRef.current?.getBoundingClientRect();
    // Done with it immediately — the clone only ever needs to exist for
    // this one synchronous measurement, not to linger until the real
    // panel replaces it.
    setMeasuringPageId(null);
    return rect ? { width: rect.width, height: rect.height } : null;
  }

  return (
    <div className="relative w-full bg-canvas">
      <div className="relative h-[200dvh] w-full">
        <PlaygroundPlate />

        <div className="absolute inset-x-0 top-0 h-dvh">
          <Hero />
        </div>

        <div className="pointer-events-none absolute inset-x-4 top-[100dvh] z-10 flex h-dvh flex-col items-center pt-16 text-center sm:inset-x-10 sm:pt-24">
          <p className="font-pixel text-xs uppercase tracking-widest text-ditto sm:text-sm">{t("comingDownToLand")}</p>
          <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-4xl">
            {/* TODO(content): once every shape has a real page, replace this placeholder. */}
            {t("soonSite")}
          </h2>
        </div>
      </div>

      <FloatingShapes
        onOpenPanel={(pageId, accentColor) => setOpenPanel({ pageId, accentColor })}
        onClosePanel={() => setOpenPanel(null)}
        onToggleLanguage={setLang}
        onMeasurePanel={measurePanel}
      />
      <Footer />

      {/* The growing/shrinking and shoving-other-shapes-aside all happens
          as a real physics body inside FloatingShapes — this only renders
          the page content once that animation reports itself done. The
          outer layer is pointer-events-none so a click on the empty space
          around the card falls through to the shapes/backdrop underneath,
          which FloatingShapes reads as "clicked outside" and treats as the
          cue to shrink back down. */}
      {openPanel && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center p-6">
          <div
            data-panel-overlay
            style={{ borderColor: openPanel.accentColor, backgroundColor: panelBackgroundTint(openPanel.accentColor) }}
            // overscroll-contain matters here, not just niceness: without it,
            // once this panel's own content is scrolled to its top or bottom
            // edge (e.g. after browsing all the way through a long Artworks
            // gallery), a further wheel gesture in the same direction has
            // nowhere left to go *inside* this div, so the browser's native
            // overscroll-chaining hands the rest of that scroll straight to
            // the outer page — completely bypassing FloatingShapes' wheel
            // handler (see its "let the panel's own scroll behave normally"
            // exclusion), which is the one place pageIndex/panelState stay
            // in sync with window.scrollY. That desync is exactly what let
            // a chained scroll silently carry the page back to the hero
            // section while this panel was still reporting itself open.
            className="pointer-events-auto max-h-[78vh] w-full max-w-[760px] overflow-y-auto overscroll-contain rounded-[2rem] border-[3px] p-8 shadow-[0_30px_60px_-20px_rgba(36,31,46,0.35)] sm:p-10"
          >
            {/* Fades in on every mount (a fresh one each time a panel opens
                — see FloatingShapes' beginExpand/beginShrink comments for
                why this box's own background is a plain, already-settled
                color rather than something that also needs animating: the
                shape's fill has already smoothly transitioned to this exact
                color, in parallel with the grow animation, by the time this
                mounts) so the actual readable content still arrives gently
                rather than snapping in the instant the shape finishes
                growing. See index.css's panel-content-in keyframes. */}
            <div key={openPanel.pageId} className="animate-[panel-content-in_320ms_ease_both]">
              {renderPanelBody(openPanel.pageId)}
            </div>
          </div>
        </div>
      )}

      {/* An invisible twin of the panel above, used only to measure a
          page's real content size before FloatingShapes' grow animation
          starts (see measurePanel) — same wrapper/classes so the measured
          size matches the real panel exactly, `visibility: hidden` rather
          than `display: none` so it still lays out (and can be measured)
          without being painted, and pointer-events-none/aria-hidden since
          it's never meant to be seen or interacted with. */}
      {measuringPageId && (
        <div className="pointer-events-none fixed inset-0 z-0 flex items-center justify-center p-6" style={{ visibility: "hidden" }} aria-hidden>
          <div
            ref={measureRef}
            className="w-full max-w-[760px] max-h-[78vh] overflow-y-auto rounded-[2rem] border-[3px] p-8 sm:p-10"
          >
            {renderPanelBody(measuringPageId)}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
