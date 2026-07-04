// T030 — Skill detail dialog
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { CheckCircle2, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import Markdown from 'react-markdown'
import { useSkillsStore } from '@/stores/skillsStore'
import type { Skill } from '@/types/skill'

interface SkillDetailDialogProps {
  skill: Skill
  onClose: () => void
}

export function SkillDetailDialog({ skill, onClose }: SkillDetailDialogProps) {
  const { globalEnabled, toggleSkill } = useSkillsStore()
  const enabled = globalEnabled[skill.id] ?? skill.enabled
  const [config, setConfig] = useState<Record<string, string>>(skill.config)
  const [confirmUninstall, setConfirmUninstall] = useState(false)

  const handleSave = () => {
    // Post-MVP: use useSkillsConfigure() mutation
    toast.success(`${skill.name} configuration saved`)
    onClose()
  }

  const handleUninstall = () => {
    if (!confirmUninstall) {
      setConfirmUninstall(true)
      return
    }
    // Post-MVP: use backend uninstall RPC
    toast.success(`${skill.name} uninstalled`)
    onClose()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-sm">{skill.name}</DialogTitle>
            <Switch checked={enabled} onCheckedChange={(v) => { toggleSkill(skill.id, v); toast.success(`${skill.name} ${v ? 'enabled' : 'disabled'}`); }} className="scale-75" aria-label={`Toggle ${skill.name}`} />
          </div>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{skill.description}</p>

          {skill.body && (
            <div className="bg-muted p-3 rounded text-xs max-h-40 overflow-y-auto prose prose-xs prose-invert max-w-none">
              <Markdown>{skill.body}</Markdown>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px]">{skill.source}</Badge>
            {skill.filePath && <Badge variant="outline" className="text-[10px] font-mono">{skill.filePath}</Badge>}
            {skill.repoUrl && <Badge variant="outline" className="text-[10px] font-mono">{skill.repoUrl}</Badge>}
          </div>

          {skill.tools.length > 0 && (
            <div>
              <Label className="text-xs">Tools ({skill.tools.length})</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {skill.tools.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px] font-mono">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {skill.dependencies.length > 0 && (
            <div>
              <Label className="text-xs">Dependencies</Label>
              <div className="space-y-1 mt-1">
                {skill.dependencies.map((dep) => (
                  <div key={dep.name} className="flex items-center gap-2 text-xs">
                    {dep.met ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-red-500" />}
                    <span className="font-mono">{dep.name}</span>
                    <span className="text-muted-foreground">({dep.type})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(skill.config).length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Configuration</Label>
              {Object.entries(skill.config).map(([key]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-[10px] font-mono">{key}</Label>
                  <Input
                    type="password"
                    value={config[key] ?? ''}
                    onChange={(e) => setConfig((prev) => ({ ...prev, [key]: e.target.value }))}
                    className="h-7 text-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter className="flex justify-between">
          {skill.source === 'installed' && (
            <Button variant="destructive" size="sm" className="text-xs" onClick={handleUninstall}>
              {confirmUninstall ? 'Confirm Uninstall' : 'Uninstall'}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="text-xs" onClick={handleSave}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
