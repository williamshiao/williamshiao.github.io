import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Terrarium } from "./components/layout/Terrarium";
import { TabBar } from "./components/layout/TabBar";
import { ContentPanel } from "./components/layout/ContentPanel";
import { Footer } from "./components/layout/Footer";
import { Hero } from "./components/sections/Hero";
import { NAV_TABS, PANELS, type TabId } from "./config/tabs";

function App() {
  // "about" = home state (Hero showing, no panel). Any other id opens that panel.
  const [activeTabId, setActiveTabId] = useState<TabId>("about");

  const handleSelect = (id: TabId) => {
    if (id === "about") {
      setActiveTabId("about");
      return;
    }
    // Clicking the already-open tab closes it, returning home.
    setActiveTabId((current) => (current === id ? "about" : id));
  };

  const activePanel = PANELS.find((panel) => panel.id === activeTabId);
  const ActiveComponent = activePanel?.component;

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-canvas">
      <Terrarium />
      <Hero />

      <TabBar tabs={NAV_TABS} activeTab={activeTabId} onSelect={handleSelect} />

      <Footer />

      <AnimatePresence>
        {activePanel && ActiveComponent && (
          <ContentPanel
            key={activePanel.id}
            kicker={activePanel.kicker}
            title={activePanel.title}
            onClose={() => setActiveTabId("about")}
          >
            <ActiveComponent />
          </ContentPanel>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
