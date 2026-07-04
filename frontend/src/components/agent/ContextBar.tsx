interface ContextBarProps {
  attachments: { filePath: string; fileName: string }[]
  chartSelection?: { ticker: string; from: number; to: number } | null
  projectPath?: string | null
  onRemoveAttachment: (filePath: string) => void
  onClearChartSelection?: () => void
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function ContextBar({ attachments, chartSelection, projectPath, onRemoveAttachment, onClearChartSelection }: ContextBarProps) {
  const hasItems = attachments.length > 0 || chartSelection || projectPath

  if (!hasItems) return null

  return (
    <div className="flex items-center gap-1.5 border-t border-border px-3 py-1.5 overflow-x-auto">
      {projectPath && (
        <span className="flex-shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {projectPath.split('/').pop()}
        </span>
      )}
      {attachments.map((a) => (
        <span key={a.filePath} className="flex items-center gap-1 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] text-blue-400">
          {a.fileName}
          <button
            type="button"
            onClick={() => onRemoveAttachment(a.filePath)}
            className="hover:text-blue-300"
            aria-label={`Remove ${a.fileName}`}
          >
            ×
          </button>
        </span>
      ))}
      {chartSelection && (
        <span className="flex items-center gap-1 rounded bg-purple-500/10 px-1.5 py-0.5 text-[10px] text-purple-400">
          {chartSelection.ticker} range
          <button
            type="button"
            onClick={onClearChartSelection}
            className="hover:text-purple-300"
            aria-label="Clear chart selection"
          >
            ×
          </button>
        </span>
      )}
    </div>
  )
}
