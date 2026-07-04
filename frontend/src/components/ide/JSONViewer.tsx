import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface JSONViewerProps {
  content: string
}

function JSONNode({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2)

  if (value === null) {
    return (
      <div style={{ paddingLeft: `${depth * 16}px` }} className="flex items-center gap-1 py-0.5 text-sm font-mono">
        {name && <span className="text-purple-400">{name}: </span>}
        <span className="text-muted-foreground">null</span>
      </div>
    )
  }

  if (typeof value === 'object' && value !== null) {
    const isArray = Array.isArray(value)
    const entries = isArray ? (value as unknown[]).map((v, i) => [String(i), v] as const) : Object.entries(value as Record<string, unknown>)
    const bracket = isArray ? ['[', ']'] : ['{', '}']

    return (
      <div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          style={{ paddingLeft: `${depth * 16}px` }}
          className="flex items-center gap-1 py-0.5 text-sm font-mono hover:bg-accent/50 w-full text-left"
        >
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {name && <span className="text-purple-400">{name}: </span>}
          <span className="text-muted-foreground">
            {bracket[0]}{!expanded && `...${bracket[1]} (${entries.length})`}
          </span>
        </button>
        {expanded && (
          <>
            {entries.map(([k, v]) => (
              <JSONNode key={k} name={isArray ? undefined : k} value={v} depth={depth + 1} />
            ))}
            <div style={{ paddingLeft: `${depth * 16}px` }} className="text-sm font-mono text-muted-foreground py-0.5">
              {bracket[1]}
            </div>
          </>
        )}
      </div>
    )
  }

  const color = typeof value === 'string' ? 'text-green-400' : typeof value === 'number' ? 'text-blue-400' : typeof value === 'boolean' ? 'text-amber-400' : 'text-foreground'

  return (
    <div style={{ paddingLeft: `${depth * 16}px` }} className="flex items-center gap-1 py-0.5 text-sm font-mono">
      {name && <span className="text-purple-400">{name}: </span>}
      <span className={cn(color)}>
        {typeof value === 'string' ? `"${value}"` : String(value)}
      </span>
    </div>
  )
}

export function JSONViewer({ content }: JSONViewerProps) {
  const parsed = useMemo(() => {
    try {
      return JSON.parse(content)
    } catch {
      return null
    }
  }, [content])

  if (parsed === null) {
    return <div className="p-4 text-sm text-destructive">Invalid JSON</div>
  }

  return (
    <div className="h-full overflow-auto p-2">
      <JSONNode value={parsed} depth={0} />
    </div>
  )
}
