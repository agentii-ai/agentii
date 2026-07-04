import { useState } from "react";
import { AgentiiEditor } from "./AgentiiEditor";
import { StyleEditor } from "./StyleEditor";
import { SnapshotViewer } from "./SnapshotViewer";
import { SessionViewer } from "./SessionViewer";

const TABS = [
  { id: "project", label: "Project", component: AgentiiEditor },
  { id: "style", label: "Style", component: StyleEditor },
  { id: "snapshots", label: "Snapshots", component: SnapshotViewer },
  { id: "sessions", label: "Sessions", component: SessionViewer },
] as const;

type TabId = (typeof TABS)[number]["id"];

/** Container for all memory editors/viewers. Renders as a tab group in the IDE. */
export function MemoryTab() {
  const [activeTab, setActiveTab] = useState<TabId>("project");
  const ActiveComponent = TABS.find((t) => t.id === activeTab)?.component ?? AgentiiEditor;

  return (
    <div className="flex flex-col h-full bg-zinc-900 text-zinc-200">
      {/* Tab bar */}
      <nav
        className="flex border-b border-zinc-700"
        role="tablist"
        aria-label="Memory sections"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "text-zinc-100 border-b-2 border-blue-500"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab panel */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        className="flex-1 overflow-hidden"
      >
        <ActiveComponent />
      </div>
    </div>
  );
}
