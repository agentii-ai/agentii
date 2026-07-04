interface CitationLinkProps {
  refId: string
  rowNumber: number
  sourceTitle: string
  onClick?: (refId: string, rowNumber: number) => void
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function CitationLink({ refId, rowNumber, sourceTitle, onClick }: CitationLinkProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(refId, rowNumber)}
      className="inline-flex items-center gap-0.5 rounded bg-cyan-500/10 px-1.5 py-0.5 text-xs text-cyan-400 hover:bg-cyan-500/20 transition-colors"
      title={`${sourceTitle} — row ${rowNumber}`}
    >
      📄 {sourceTitle}:{rowNumber}
    </button>
  )
}
