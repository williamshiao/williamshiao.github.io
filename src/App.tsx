import { PlaygroundPlate } from "./components/layout/PlaygroundPlate";
import { Footer } from "./components/layout/Footer";
import { Hero } from "./components/sections/Hero";
import { FloatingShapes } from "./components/physics/FloatingShapes";

// Tabs/panels (TabBar, ContentPanel, Artworks, Internships, config/tabs) are
// shelved for now, not deleted — the eventual plan is for the shapes below
// to become that navigation themselves once they've settled. See
// FloatingShapes for the physics (zero-g at the top, gravity engages once
// scrolled down far enough, and the floor then tracks the current viewport
// bottom so settled shapes are never scrolled out of view).
function App() {
  return (
    <div className="relative w-full bg-canvas">
      <div className="relative h-[200dvh] w-full">
        <PlaygroundPlate />

        <div className="absolute inset-x-0 top-0 h-dvh">
          <Hero />
        </div>

        <div className="pointer-events-none absolute inset-x-4 top-[100dvh] z-10 flex h-dvh flex-col items-center pt-16 text-center sm:inset-x-10 sm:pt-24">
          <p className="font-pixel text-xs uppercase tracking-widest text-ditto sm:text-sm">Coming down to land</p>
          <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-4xl">
            {/* TODO(content): once these become real page nav, replace this placeholder. */}
            Soon, these become the site
          </h2>
        </div>
      </div>

      <FloatingShapes />
      <Footer />
    </div>
  );
}

export default App;
