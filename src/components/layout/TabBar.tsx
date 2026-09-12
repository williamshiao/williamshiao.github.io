import type { TabConfig, TabId } from "../../config/tabs";

interface TabBarProps {
  tabs: TabConfig[];
  activeTab: TabId | null;
  onSelect: (id: TabId) => void;
}

/**
 * Floating tab dock, pinned to the top edge of the terrarium. Each tab is a
 * `data-blob-target` — the hook the cursor-blob component (built in a later
 * step) queries to know which elements it should mold itself around on hover.
 */
export function TabBar({ tabs, activeTab, onSelect }: TabBarProps) {
  return (
    <div
      className="absolute left-1/2 top-6 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full
                 border border-line bg-surface/90 p-1.5 shadow-sm backdrop-blur-sm sm:top-10"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            data-blob-target
            aria-pressed={isActive}
            onClick={() => onSelect(tab.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              isActive ? "bg-ditto text-white" : "text-ink-soft hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
