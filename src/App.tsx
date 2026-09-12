import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Terrarium } from "./components/layout/Terrarium";
import { TabBar } from "./components/layout/TabBar";
import { ContentPanel } from "./components/layout/ContentPanel";
import { Footer } from "./components/layout/Footer";
import { TABS, type TabId } from "./config/tabs";

function App() {
  const [activeTabId, setActiveTabId] = useState<TabId | null>(null);

  const handleSelect = (id: TabId) => {
    // Clicking the already-open tab closes it — there's no separate close-only state.
    setActiveTabId((current) => (current === id ? null : id));
  };

  const activeTab = TABS.find((tab) => tab.id === activeTabId);
  const ActiveComponent = activeTab?.component;

  return (
    <div className="relative h-dvh w-dvw overflow-hidden bg-canvas">
      <Terrarium />

      <div
        className="absolute bottom-6 left-6 z-20 font-display text-sm font-semibold tracking-tight
                   text-ink-soft sm:bottom-10 sm:left-10"
      >
        William Shiao
      </div>

      <TabBar tabs={TABS} activeTab={activeTabId} onSelect={handleSelect} />

      <Footer />

      <AnimatePresence>
        {activeTab && ActiveComponent && (
          <ContentPanel
            key={activeTab.id}
            kicker={activeTab.kicker}
            title={activeTab.title}
            onClose={() => setActiveTabId(null)}
          >
            <ActiveComponent />
          </ContentPanel>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
