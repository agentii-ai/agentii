import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowUpDown, FileText, MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTerminalStore } from '@/stores/terminalStore'
import type { Project } from '@/types/project'

const col = createColumnHelper<Project>()

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  }).format(new Date(dateStr))
}

interface ProjectTableProps {
  projects: Project[]
}

export function ProjectTable({ projects }: ProjectTableProps) {
  const navigate = useNavigate()
  const activeTerminalProjectId = useTerminalStore((s) => s.projectId)
  const [sorting, setSorting] = useState<SortingState>([])

  const openProject = useCallback((projectId: string) => {
    if (activeTerminalProjectId === projectId) {
      navigate(`/ide?project=${projectId}`)
    } else {
      window.open(`/ide?project=${projectId}`, '_blank')
    }
  }, [activeTerminalProjectId, navigate])

  const columns = useMemo(
    () => [
      col.accessor('name', {
        header: 'Name',
        cell: (info) => <span className="font-medium">{info.getValue()}</span>,
      }),
      col.accessor('ticker_symbols', {
        header: 'Tickers',
        enableSorting: false,
        cell: (info) => (
          <div className="flex flex-wrap gap-1">
            {info.getValue().map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                {t}
              </Badge>
            ))}
          </div>
        ),
      }),
      col.accessor('project_type', {
        header: 'Type',
        cell: (info) => (
          <span className="capitalize text-muted-foreground">{info.getValue()}</span>
        ),
      }),
      col.accessor('updated_at', {
        header: 'Modified',
        cell: (info) => (
          <span className="text-muted-foreground">{formatDate(info.getValue())}</span>
        ),
      }),
      col.accessor('file_count', {
        header: 'Files',
        cell: (info) => (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <FileText className="h-3 w-3" />
            {info.getValue()}
          </span>
        ),
      }),
      col.accessor('session_count', {
        header: 'Sessions',
        cell: (info) => (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <MessageSquare className="h-3 w-3" />
            {info.getValue()}
          </span>
        ),
      }),
    ],
    [],
  )

  const table = useReactTable({
    data: projects,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="border-b bg-muted/50">
              {hg.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-3 py-2 text-left font-medium text-muted-foreground"
                >
                  {header.isPlaceholder ? null : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 hover:text-foreground"
                      onClick={header.column.getToggleSortingHandler()}
                      disabled={!header.column.getCanSort()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <ArrowUpDown className="h-3 w-3" />}
                    </button>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b cursor-pointer transition-colors hover:bg-muted/50"
              onClick={() => openProject(row.original.id)}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  openProject(row.original.id)
                }
              }}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="px-3 py-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
          {table.getRowModel().rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                No projects found
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
