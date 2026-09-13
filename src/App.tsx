import { Terrarium } from "./components/layout/Terrarium";
import { Footer } from "./components/layout/Footer";
import { Hero } from "./components/sections/Hero";
import { FloatingShapes } from "./components/physics/FloatingShapes";

// Tabs/panels (TabBar, ContentPanel, Artworks, Internships, config/tabs) are
// shelved for now, not deleted — this is a deliberate step toward a new
// "shapes = pages" concept, not finished yet. See FloatingShapes for the
// physics playground replacing the old Ditto cursor.
function App() {
  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-canvas">
      <Terrarium />
      <Hero />
      <FloatingShapes />
      <Footer />
    </div>
  );
}

export default App;
