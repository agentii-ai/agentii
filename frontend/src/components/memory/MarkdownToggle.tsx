import { useState } from "react";

interface MarkdownToggleProps {
  isRawMode: boolean;
  onToggle: (raw: boolean) => void;
}

/** Toggle button that switches between structured block view and raw markdown view. */
export function MarkdownToggle({ isRawMode, onToggle }: MarkdownToggleProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(!isRawMode)}
      className="px-3 py-1 text-xs rounded border border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
      aria-label={isRawMode ? "Switch to structured view" : "Switch to raw markdown view"}
    >
      {isRawMode ? "Structured View" : "Raw Markdown"}
    </button>
  );
}

/** Hook to manage the toggle state for MarkdownToggle. */
export function useMarkdownToggle(initial = false) {
  const [isRawMode, setIsRawMode] = useState(initial);
  return { isRawMode, setIsRawMode };
}
