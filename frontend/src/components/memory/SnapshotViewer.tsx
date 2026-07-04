import { useState } from "react";
import { useSnapshotList, useMemoryFileRead } from "../../hooks/useMemory";

/** Read-only snapshot list + viewer (FR-032). */
export function SnapshotViewer() {
  const { data: snapshots, isLoading } = useSnapshotList();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { data: fileData } = useMemoryFileRead(selectedPath);

  if (isLoading) {
    return <div className="p-4 text-zinc-400">Loading snapshots...</div>;
  }

  const items = snapshots ?? [];

  return (
    <div className="flex h-full">
      {/* Left panel: snapshot list */}
      <div className="w-64 border-r border-zinc-700 overflow-y-auto">
        <div className="px-3 py-2 border-b border-zinc-700">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Snapshots ({items.length})
          </h3>
        </div>
        {items.length === 0 ? (
          <div className="p-3 text-sm text-zinc-500">No snapshots yet</div>
        ) : (
          <ul role="listbox" aria-label="Snapshot files">
            {items.map((snap) => {
              const path = `snapshots/${snap.filename}`;
              const isSelected = selectedPath === path;
              return (
                <li key={snap.filename}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => setSelectedPath(path)}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-zinc-800 transition-colors ${
                      isSelected
                        ? "bg-zinc-700 text-zinc-100"
                        : "text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    <div className="font-medium">{snap.date}</div>
                    <div className="text-xs text-zinc-500">
                      {snap.entry_count} {snap.entry_count === 1 ? "entry" : "entries"}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Right panel: snapshot content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedPath ? (
          <div className="text-sm text-zinc-500">Select a snapshot to view</div>
        ) : !fileData?.exists ? (
          <div className="text-sm text-zinc-500">File not found</div>
        ) : (
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed">
            {fileData.content}
          </pre>
        )}
      </div>
    </div>
  );
}
