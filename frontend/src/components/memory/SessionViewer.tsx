import { useState } from "react";
import { useSessionList, useMemoryFileRead } from "../../hooks/useMemory";

/** Read-only session list + viewer (FR-033). */
export function SessionViewer() {
  const { data: sessions, isLoading } = useSessionList();
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const { data: fileData } = useMemoryFileRead(selectedPath);

  if (isLoading) {
    return <div className="p-4 text-zinc-400">Loading sessions...</div>;
  }

  const items = sessions ?? [];

  return (
    <div className="flex h-full">
      {/* Left panel: session list */}
      <div className="w-72 border-r border-zinc-700 overflow-y-auto">
        <div className="px-3 py-2 border-b border-zinc-700">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
            Sessions ({items.length})
          </h3>
        </div>
        {items.length === 0 ? (
          <div className="p-3 text-sm text-zinc-500">No sessions yet</div>
        ) : (
          <ul role="listbox" aria-label="Session files">
            {items.map((session) => {
              const path = `sessions/${session.filename}`;
              const isSelected = selectedPath === path;
              return (
                <li key={session.filename}>
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {session.date} {session.time}
                      </span>
                      {session.is_fallback && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-amber-900 text-amber-300">
                          fallback
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                      <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {session.agent || "unknown"}
                      </span>
                      {session.duration_minutes > 0 && (
                        <span>{session.duration_minutes}m</span>
                      )}
                    </div>
                    {session.summary_first_line && (
                      <div className="text-xs text-zinc-500 mt-1 truncate">
                        {session.summary_first_line}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Right panel: session content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedPath ? (
          <div className="text-sm text-zinc-500">Select a session to view</div>
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
