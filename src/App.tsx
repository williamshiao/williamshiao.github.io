import { Terrarium } from "./components/layout/Terrarium";
import { GravityFloor } from "./components/layout/GravityFloor";
import { Footer } from "./components/layout/Footer";
import { Hero } from "./components/sections/Hero";
import { FloatingShapes } from "./components/physics/FloatingShapes";

// Tabs/panels (TabBar, ContentPanel, Artworks, Internships, config/tabs) are
// shelved for now, not deleted — the eventual plan is for the shapes below
// to become that navigation themselves once they've settled. See
// FloatingShapes for the physics (zero-g up here, gravity switches on for
// good once the section below scrolls into view).
function App() {
  return (
    <div className="relative w-full bg-canvas">
      <section className="relative h-dvh w-full">
        <Terrarium />
        <Hero />
      </section>

      <section className="relative h-dvh w-full">
        <GravityFloor />
        <div className="pointer-events-none absolute inset-4 z-10 flex flex-col items-center pt-16 text-center sm:inset-10 sm:pt-24">
          <p className="font-pixel text-xs uppercase tracking-widest text-ditto sm:text-sm">Coming down to land</p>
          <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-4xl">
            {/* TODO(content): once these become real page nav, replace this placeholder. */}
            Soon, these become the site
          </h2>
        </div>
      </section>

      <FloatingShapes />
      <Footer />
    </div>
  );
}

export default App;
