import { useState, useCallback, useRef, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useProjects } from '@/hooks/useProjects'
import type { ProjectType } from '@/types/project'

interface ProjectCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const projectTypes: { value: ProjectType; label: string }[] = [
  { value: 'us_stock', label: 'US Stock' },
  { value: 'us_stock_option', label: 'US Stock Option' },
  { value: 'crypto', label: 'Crypto' },
  { value: 'predictive_market', label: 'Predictive Market' },
]

const SEPARATORS = /[,;\s/|]+/

function parseTicker(raw: string): string {
  return raw.replace(/[^A-Za-z0-9.^-]/g, '').toUpperCase()
}

export function ProjectCreateDialog({ open, onOpenChange }: ProjectCreateDialogProps) {
  const navigate = useNavigate()
  const { createProject } = useProjects()
  const [name, setName] = useState('')
  const [tickerTags, setTickerTags] = useState<string[]>([])
  const [tickerInput, setTickerInput] = useState('')
  const [projectType, setProjectType] = useState<ProjectType>('us_stock')
  const [description, setDescription] = useState('')
  const [sector, setSector] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const tickerRef = useRef<HTMLInputElement>(null)

  const addTickers = useCallback((raw: string) => {
    const newTickers = raw
      .split(SEPARATORS)
      .map(parseTicker)
      .filter((t) => t.length > 0)

    if (newTickers.length === 0) return
    setTickerTags((prev) => {
      const set = new Set(prev)
      for (const t of newTickers) set.add(t)
      return [...set]
    })
  }, [])

  const removeTicker = useCallback((ticker: string) => {
    setTickerTags((prev) => prev.filter((t) => t !== ticker))
  }, [])

  const handleTickerInputChange = (value: string) => {
    // Check if the last character is a separator
    if (value.length > 0 && SEPARATORS.test(value[value.length - 1])) {
      addTickers(value)
      setTickerInput('')
      return
    }
    // Check if pasted text contains separators (multi-ticker paste)
    if (SEPARATORS.test(value)) {
      addTickers(value)
      setTickerInput('')
      return
    }
    setTickerInput(value)
  }

  const handleTickerKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (tickerInput.trim()) {
        addTickers(tickerInput)
        setTickerInput('')
      }
    }
    if (e.key === 'Backspace' && tickerInput === '' && tickerTags.length > 0) {
      setTickerTags((prev) => prev.slice(0, -1))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setIsSubmitting(true)
    try {
      // Flush any remaining input as a tag
      const finalTickers = [...tickerTags]
      const remaining = parseTicker(tickerInput)
      if (remaining && !finalTickers.includes(remaining)) {
        finalTickers.push(remaining)
      }

      const project = await createProject({
        name: name.trim(),
        ticker_symbols: finalTickers,
        project_type: projectType,
        description: description.trim() || null,
        sector: sector.trim() || null,
      })

      onOpenChange(false)
      setName('')
      setTickerTags([])
      setTickerInput('')
      setProjectType('us_stock')
      setDescription('')
      setSector('')
      navigate(`/ide?project=${project.id}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
          <DialogDescription>Create a new trading project.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              placeholder="NVDA Earnings Play"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-tickers">Ticker Symbols</Label>
            <div
              className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
              onClick={() => tickerRef.current?.focus()}
            >
              {tickerTags.map((ticker) => (
                <Badge
                  key={ticker}
                  variant="secondary"
                  className="gap-0.5 pl-2 pr-1 py-0 text-xs font-medium"
                >
                  {ticker}
                  <button
                    type="button"
                    className="ml-0.5 rounded-sm opacity-60 hover:opacity-100 focus:outline-none"
                    onClick={(e) => {
                      e.stopPropagation()
                      removeTicker(ticker)
                    }}
                    aria-label={`Remove ${ticker}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <input
                ref={tickerRef}
                id="project-tickers"
                className="flex-1 min-w-[80px] bg-transparent outline-none placeholder:text-muted-foreground"
                placeholder={tickerTags.length === 0 ? 'AAPL, MSFT, GOOGL' : ''}
                value={tickerInput}
                onChange={(e) => handleTickerInputChange(e.target.value)}
                onKeyDown={handleTickerKeyDown}
                onBlur={() => {
                  if (tickerInput.trim()) {
                    addTickers(tickerInput)
                    setTickerInput('')
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Type a symbol and press comma, space, or Enter to add
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-type">Type</Label>
            <Select value={projectType} onValueChange={(v) => setProjectType(v as ProjectType)}>
              <SelectTrigger id="project-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projectTypes.map((pt) => (
                  <SelectItem key={pt.value} value={pt.value}>
                    {pt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-sector">Sector (optional)</Label>
            <Input
              id="project-sector"
              placeholder="Technology, Healthcare, Energy, etc."
              value={sector}
              onChange={(e) => setSector(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="project-description">Description (optional)</Label>
            <Input
              id="project-description"
              placeholder="Brief description of the project"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
