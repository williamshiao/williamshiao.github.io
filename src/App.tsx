import { Nav } from "./components/layout/Nav";
import { Footer } from "./components/layout/Footer";
import { About } from "./components/sections/About";
import { Artworks } from "./components/sections/Artworks";
import { Internships } from "./components/sections/Internships";

function App() {
  return (
    <div id="top">
      <Nav />
      <main>
        <About />
        <Artworks />
        <Internships />
      </main>
      <Footer />
    </div>
  );
}

export default App;
