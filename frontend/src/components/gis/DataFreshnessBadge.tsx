interface DataFreshnessBadgeProps {
  lastUpdated: string | Date | null | undefined
  maxStalenessMinutes: number
  label?: string
}

export function DataFreshnessBadge({ lastUpdated, maxStalenessMinutes, label }: DataFreshnessBadgeProps) {
  if (!lastUpdated) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />
        {label ? `${label}: ` : ''}No data
      </span>
    )
  }

  const updatedAt = typeof lastUpdated === 'string' ? new Date(lastUpdated) : lastUpdated
  const ageMinutes = (Date.now() - updatedAt.getTime()) / 60_000
  const isStale = ageMinutes > maxStalenessMinutes

  const timeAgo = ageMinutes < 1
    ? 'just now'
    : ageMinutes < 60
      ? `${Math.floor(ageMinutes)}m ago`
      : ageMinutes < 1440
        ? `${Math.floor(ageMinutes / 60)}h ago`
        : `${Math.floor(ageMinutes / 1440)}d ago`

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${isStale ? 'text-amber-500' : 'text-muted-foreground'}`}
      title={`Last updated: ${updatedAt.toISOString()}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isStale ? 'bg-amber-500' : 'bg-green-500'}`} />
      {label ? `${label}: ` : ''}{timeAgo}
      {isStale && ' (stale)'}
    </span>
  )
}
