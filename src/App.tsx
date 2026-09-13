import { useState } from "react";
import { PlaygroundPlate } from "./components/layout/PlaygroundPlate";
import { Footer } from "./components/layout/Footer";
import { Hero } from "./components/sections/Hero";
import { Internships } from "./components/sections/Internships";
import { Contact } from "./components/sections/Contact";
import { FloatingShapes } from "./components/physics/FloatingShapes";
import { useLanguage } from "./context/LanguageContext";

interface OpenPanel {
  pageId: string;
  accentColor: string;
}

// Tabs/panels (TabBar, ContentPanel, Artworks, config/tabs) are shelved for
// now, not deleted — Internships is the first one wired up for real, via
// FloatingShapes' click-to-expand: clicking its shape grows it in place
// into a panel and reports back here (onOpenPanel) once that finishes, at
// which point this renders the actual page content on top of it. See
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
  const { t, setLang } = useLanguage();

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
            style={{ borderColor: openPanel.accentColor }}
            className="pointer-events-auto max-h-[78vh] w-full max-w-[760px] overflow-y-auto rounded-[2rem] border-[3px] bg-surface p-8 shadow-[0_30px_60px_-20px_rgba(36,31,46,0.35)] sm:p-10"
          >
            {openPanel.pageId === "internships" && (
              <>
                <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{t("internshipsTitle")}</h2>
                <div className="mt-8">
                  <Internships />
                </div>
              </>
            )}
            {openPanel.pageId === "contact" && (
              <>
                <h2 className="font-display text-2xl font-semibold text-ink sm:text-3xl">{t("contactTitle")}</h2>
                <div className="mt-8">
                  <Contact />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
