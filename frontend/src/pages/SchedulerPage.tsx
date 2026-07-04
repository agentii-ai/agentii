// T047 — Scheduler page
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Clock, Plus, AlertCircle } from 'lucide-react'
import { useSchedulerStore } from '@/stores/schedulerStore'
import { useSkillsStore } from '@/stores/skillsStore'
import type { ScheduledTask } from '@/types/scheduler'

const CRON_PRESETS = [
  { label: 'Every hour', cron: '0 * * * *', human: 'Every hour' },
  { label: 'Every day at 9:00 AM', cron: '0 9 * * *', human: 'Every day at 9:00 AM' },
  { label: 'Every weekday at 9:00 AM', cron: '0 9 * * 1-5', human: 'Every weekday at 9:00 AM' },
  { label: 'Every Monday at 9:00 AM', cron: '0 9 * * 1', human: 'Every Monday at 9:00 AM' },
  { label: 'Every month on the 1st', cron: '0 9 1 * *', human: 'Every month on the 1st at 9:00 AM' },
  { label: 'Custom', cron: '', human: '' },
]

export default function SchedulerPage() {
  const { tasks, addTask, toggleTask, removeTask } = useSchedulerStore()
  const skills: { id: string; name: string }[] = [] // TODO: populate from useSkillsList() hook when scheduler is wired
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [prompt, setPrompt] = useState('')
  const [skillId, setSkillId] = useState('')
  const [cronPreset, setCronPreset] = useState(CRON_PRESETS[1].label)
  const [customCron, setCustomCron] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null)

  const handleCreate = () => {
    const preset = CRON_PRESETS.find((p) => p.label === cronPreset)
    const cron = preset?.cron || customCron
    const human = preset?.human || customCron
    if (!name || !cron) return
    const task: ScheduledTask = {
      id: crypto.randomUUID(),
      name,
      prompt: prompt || undefined,
      skillId: skillId || undefined,
      cronExpression: cron,
      cronHumanReadable: human,
      enabled: true,
      status: 'pending-backend',
      executions: [],
      createdAt: new Date().toISOString(),
    }
    addTask(task)
    setShowCreate(false)
    setName('')
    setPrompt('')
    setSkillId('')
  }

  if (tasks.length === 0 && !showCreate) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Clock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-sm font-semibold mb-1">No scheduled tasks</h2>
        <p className="text-xs text-muted-foreground max-w-sm mb-4">
          Schedule recurring agent tasks like "check portfolio P&L every morning" or "scan for new SEC filings daily".
        </p>
        <Button size="sm" className="text-xs" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Create Schedule
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-6 overflow-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold">Scheduler</h1>
        <Button size="sm" className="text-xs h-8" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Create Schedule
        </Button>
      </div>

      <div className="space-y-2 max-w-3xl">
        {tasks.map((task) => (
          <Card key={task.id}>
            <CardContent className="p-0">
              <button className="w-full text-left p-4" onClick={() => setExpandedId(expandedId === task.id ? null : task.id)} aria-expanded={expandedId === task.id} aria-label={`Task: ${task.name}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium truncate">{task.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0 flex items-center gap-0.5">
                      <AlertCircle className="h-2.5 w-2.5" /> Pending backend
                    </Badge>
                  </div>
                  <Switch checked={task.enabled} onCheckedChange={(v) => toggleTask(task.id, v)} onClick={(e) => e.stopPropagation()} className="scale-75 shrink-0" aria-label={`Toggle ${task.name}`} />
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-[10px] text-muted-foreground">
                  <span>{task.cronHumanReadable}</span>
                  {task.lastRunAt && <span>Last: {new Date(task.lastRunAt).toLocaleDateString()}</span>}
                </div>
              </button>
              {expandedId === task.id && (
                <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                  <div className="text-xs space-y-1">
                    <p><span className="text-muted-foreground">Cron:</span> <code className="font-mono">{task.cronExpression}</code></p>
                    {task.prompt && <p><span className="text-muted-foreground">Prompt:</span> {task.prompt}</p>}
                    {task.skillId && <p><span className="text-muted-foreground">Skill:</span> {task.skillId}</p>}
                  </div>
                  {task.executions.length > 0 && (
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Execution History</p>
                      {task.executions.slice(0, 5).map((exec) => (
                        <div key={exec.id} className="flex items-center gap-3 text-[10px] py-1 border-b border-border last:border-0">
                          <Badge variant={exec.status === 'success' ? 'default' : 'destructive'} className="text-[9px] px-1 py-0">{exec.status}</Badge>
                          <span className="text-muted-foreground">{new Date(exec.startedAt).toLocaleString()}</span>
                          <span className="text-muted-foreground">{exec.durationMs}ms</span>
                          <span className="truncate">{exec.outputSummary}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <Button variant="destructive" size="sm" className="text-xs h-7" onClick={() => {
                    if (confirmRemoveId === task.id) { removeTask(task.id); setConfirmRemoveId(null) }
                    else setConfirmRemoveId(task.id)
                  }}>
                    {confirmRemoveId === task.id ? 'Confirm Remove' : 'Remove'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Create Scheduled Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" placeholder="e.g. Morning P&L Check" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Skill (optional)</Label>
              <Select value={skillId} onValueChange={setSkillId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select a skill..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="" className="text-xs">None (use prompt)</SelectItem>
                  {skills.filter((s) => s.enabled).map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Prompt (optional)</Label>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="w-full h-20 bg-muted p-2 text-xs rounded border border-border resize-none focus:outline-none focus:ring-1 focus:ring-ring" placeholder="What should the agent do?" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Schedule</Label>
              <Select value={cronPreset} onValueChange={setCronPreset}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CRON_PRESETS.map((p) => (
                    <SelectItem key={p.label} value={p.label} className="text-xs">{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cronPreset === 'Custom' && (
                <Input value={customCron} onChange={(e) => setCustomCron(e.target.value)} className="h-8 text-xs font-mono mt-1" placeholder="0 9 * * 1-5" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button size="sm" className="text-xs" onClick={handleCreate} disabled={!name || (!CRON_PRESETS.find((p) => p.label === cronPreset)?.cron && !customCron)}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
