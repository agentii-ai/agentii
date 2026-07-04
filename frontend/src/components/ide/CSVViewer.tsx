import { useMemo, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

interface CSVEditorProps {
  content: string
  onChange?: (value: string) => void
  onSave?: (value: string) => void
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n')
  if (lines.length === 0) return { headers: [], rows: [] }
  const headers = lines[0].split(',').map((h) => h.trim())
  const rows = lines.slice(1).map((line) => line.split(',').map((c) => c.trim()))
  return { headers, rows }
}

function serializeCSV(headers: string[], rows: string[][]): string {
  const headerLine = headers.join(',')
  const dataLines = rows.map((row) => row.join(','))
  return [headerLine, ...dataLines].join('\n')
}

interface EditingCell {
  row: number
  col: number
}

export function CSVEditor({ content, onChange, onSave }: CSVEditorProps) {
  const parsed = useMemo(() => parseCSV(content), [content])
  const [headers, setHeaders] = useState(parsed.headers)
  const [rows, setRows] = useState(parsed.rows)
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortAsc, setSortAsc] = useState(true)
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const [editValue, setEditValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; row: number; col: number } | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows
    return [...rows].sort((a, b) => {
      const va = a[sortCol] ?? ''
      const vb = b[sortCol] ?? ''
      const na = parseFloat(va)
      const nb = parseFloat(vb)
      if (!isNaN(na) && !isNaN(nb)) return sortAsc ? na - nb : nb - na
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va)
    })
  }, [rows, sortCol, sortAsc])

  const handleSort = (col: number) => {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  const emitChange = useCallback((newHeaders: string[], newRows: string[][]) => {
    setIsDirty(true)
    const csv = serializeCSV(newHeaders, newRows)
    onChange?.(csv)
  }, [onChange])

  const handleCellDoubleClick = (row: number, col: number) => {
    setEditing({ row, col })
    setEditValue(rows[row]?.[col] ?? '')
  }

  const handleCellConfirm = () => {
    if (!editing) return
    const newRows = rows.map((r, i) =>
      i === editing.row ? r.map((c, j) => (j === editing.col ? editValue : c)) : r,
    )
    setRows(newRows)
    emitChange(headers, newRows)
    setEditing(null)
  }

  const handleCellCancel = () => {
    setEditing(null)
  }

  const handleContextMenu = (e: React.MouseEvent, row: number, col: number) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, row, col })
  }

  const insertRowAbove = () => {
    if (!contextMenu) return
    const newRow = headers.map(() => '')
    const newRows = [...rows.slice(0, contextMenu.row), newRow, ...rows.slice(contextMenu.row)]
    setRows(newRows)
    emitChange(headers, newRows)
    setContextMenu(null)
  }

  const insertRowBelow = () => {
    if (!contextMenu) return
    const newRow = headers.map(() => '')
    const newRows = [...rows.slice(0, contextMenu.row + 1), newRow, ...rows.slice(contextMenu.row + 1)]
    setRows(newRows)
    emitChange(headers, newRows)
    setContextMenu(null)
  }

  const deleteRow = () => {
    if (!contextMenu) return
    const newRows = rows.filter((_, i) => i !== contextMenu.row)
    setRows(newRows)
    emitChange(headers, newRows)
    setContextMenu(null)
  }

  const insertColLeft = () => {
    if (!contextMenu) return
    const col = contextMenu.col
    const newHeaders = [...headers.slice(0, col), `col_${headers.length + 1}`, ...headers.slice(col)]
    const newRows = rows.map((r) => [...r.slice(0, col), '', ...r.slice(col)])
    setHeaders(newHeaders)
    setRows(newRows)
    emitChange(newHeaders, newRows)
    setContextMenu(null)
  }

  const insertColRight = () => {
    if (!contextMenu) return
    const col = contextMenu.col + 1
    const newHeaders = [...headers.slice(0, col), `col_${headers.length + 1}`, ...headers.slice(col)]
    const newRows = rows.map((r) => [...r.slice(0, col), '', ...r.slice(col)])
    setHeaders(newHeaders)
    setRows(newRows)
    emitChange(newHeaders, newRows)
    setContextMenu(null)
  }

  const deleteCol = () => {
    if (!contextMenu) return
    const col = contextMenu.col
    const newHeaders = headers.filter((_, i) => i !== col)
    const newRows = rows.map((r) => r.filter((_, i) => i !== col))
    setHeaders(newHeaders)
    setRows(newRows)
    emitChange(newHeaders, newRows)
    setContextMenu(null)
  }

  const handleSave = useCallback(() => {
    const csv = serializeCSV(headers, rows)
    onSave?.(csv)
    setIsDirty(false)
  }, [headers, rows, onSave])

  // ⌘+S to save
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      handleSave()
    }
  }, [handleSave])

  if (headers.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">Empty CSV</div>
  }

  return (
    <div className="h-full overflow-auto" onKeyDown={handleKeyDown} tabIndex={0}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/80 backdrop-blur">
          <tr>
            {headers.map((h, i) => (
              <th
                key={`h-${i}`}
                onClick={() => handleSort(i)}
                className="cursor-pointer border-b border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                {h}
                {sortCol === i && <span className="ml-1">{sortAsc ? '↑' : '↓'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, ri) => (
            <tr key={`r-${ri}`} className="border-b border-border/50 hover:bg-accent/30">
              {row.map((cell, ci) => (
                <td
                  key={`c-${ri}-${ci}`}
                  className={cn(
                    'px-3 py-1.5 text-sm',
                    !isNaN(parseFloat(cell)) && 'text-right tabular-nums',
                  )}
                  onDoubleClick={() => handleCellDoubleClick(ri, ci)}
                  onContextMenu={(e) => handleContextMenu(e, ri, ci)}
                >
                  {editing?.row === ri && editing?.col === ci ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleCellConfirm()
                        if (e.key === 'Escape') handleCellCancel()
                      }}
                      onBlur={handleCellConfirm}
                      className="w-full rounded border border-primary bg-background px-1 py-0.5 text-sm outline-none"
                      autoFocus
                    />
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-[160px] rounded-md border border-border bg-popover py-1 shadow-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {[
            { label: 'Insert Row Above', action: insertRowAbove },
            { label: 'Insert Row Below', action: insertRowBelow },
            { label: 'Delete Row', action: deleteRow },
            { label: '—', action: () => {} },
            { label: 'Insert Column Left', action: insertColLeft },
            { label: 'Insert Column Right', action: insertColRight },
            { label: 'Delete Column', action: deleteCol },
          ].map((item, idx) =>
            item.label === '—' ? (
              <div key={`sep-${idx}`} className="my-1 border-t border-border" />
            ) : (
              <button
                key={item.label}
                type="button"
                onClick={() => { item.action(); setContextMenu(null) }}
                className="flex w-full px-3 py-1.5 text-xs hover:bg-accent"
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      )}

      {/* Click outside to close context menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
      )}
    </div>
  )
}

// Keep backward compat export
export { CSVEditor as CSVViewer }
