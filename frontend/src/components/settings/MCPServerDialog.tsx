// T033 — MCP Server add/edit dialog
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useMCPStore } from '@/stores/mcpStore'
import type { MCPServer, MCPTransport } from '@/types/mcp'

interface MCPServerDialogProps {
  server?: MCPServer
  onClose: () => void
}

export function MCPServerDialog({ server, onClose }: MCPServerDialogProps) {
  // Post-MVP: MCPServerDialog is replaced by inline ConfigForm in MCPServersSection.
  // This stub is retained for backward compatibility with any remaining references.
  const isEdit = !!server

  const [name, setName] = useState(server?.name ?? '')
  const [description, setDescription] = useState(server?.description ?? '')
  const [transport, setTransport] = useState<MCPTransport>(server?.transport ?? 'stdio')
  const [command, setCommand] = useState(server?.command ?? '')
  const [args, setArgs] = useState(server?.args?.join(' ') ?? '')
  const [url, setUrl] = useState(server?.url ?? '')
  const [timeout, setTimeout_] = useState(String(server?.timeout ?? 30000))
  const [envVars, setEnvVars] = useState<[string, string][]>(
    server?.envVars ? Object.entries(server.envVars) : [],
  )
  const [headers, setHeaders] = useState<[string, string][]>(
    server?.headers ? Object.entries(server.headers) : [],
  )

  const handleSave = () => {
    // Post-MVP: MCPServerDialog is replaced by inline ConfigForm in MCPServersSection
    toast.success(`${name} saved`)
    onClose()
  }

  const [confirmRemove, setConfirmRemove] = useState(false)

  const handleRemove = () => {
    if (!confirmRemove) {
      setConfirmRemove(true)
      return
    }
    // Post-MVP: use backend uninstall RPC
    toast.success(`${server?.name ?? 'Server'} removed`)
    onClose()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{isEdit ? 'Edit MCP Server' : 'Add MCP Server'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" placeholder="e.g. edgartools" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 text-xs" placeholder="Optional description" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Transport</Label>
            <Select value={transport} onValueChange={(v) => setTransport(v as MCPTransport)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio" className="text-xs">Stdio</SelectItem>
                <SelectItem value="sse" className="text-xs">SSE</SelectItem>
                <SelectItem value="streamable-http" className="text-xs">Streamable HTTP</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {transport === 'stdio' ? (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Command</Label>
                <Input value={command} onChange={(e) => setCommand(e.target.value)} className="h-8 text-xs font-mono" placeholder="e.g. npx, uvx, python" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Arguments</Label>
                <Input value={args} onChange={(e) => setArgs(e.target.value)} className="h-8 text-xs font-mono" placeholder="e.g. -y @modelcontextprotocol/server-memory" />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <Label className="text-xs">URL</Label>
              <Input value={url} onChange={(e) => setUrl(e.target.value)} className="h-8 text-xs font-mono" placeholder="e.g. http://localhost:3001/sse" />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-xs">Timeout (ms)</Label>
            <Input value={timeout} onChange={(e) => setTimeout_(e.target.value)} className="h-8 text-xs" type="number" />
          </div>
          {transport === 'streamable-http' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Headers</Label>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setHeaders([...headers, ['', '']])}>
                  <Plus className="h-3 w-3 mr-0.5" /> Add
                </Button>
              </div>
              {headers.map(([key, val], i) => (
                <div key={i} className="flex gap-1.5">
                  <Input value={key} onChange={(e) => { const n = [...headers]; n[i] = [e.target.value, val]; setHeaders(n) }} className="h-7 text-xs font-mono flex-1" placeholder="Header-Name" />
                  <Input value={val} onChange={(e) => { const n = [...headers]; n[i] = [key, e.target.value]; setHeaders(n) }} className="h-7 text-xs font-mono flex-1" placeholder="value" />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setHeaders(headers.filter((_, j) => j !== i))} aria-label="Remove header">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Environment Variables</Label>
              <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setEnvVars([...envVars, ['', '']])}>
                <Plus className="h-3 w-3 mr-0.5" /> Add
              </Button>
            </div>
            {envVars.map(([key, val], i) => (
              <div key={i} className="flex gap-1.5">
                <Input value={key} onChange={(e) => { const n = [...envVars]; n[i] = [e.target.value, val]; setEnvVars(n) }} className="h-7 text-xs font-mono flex-1" placeholder="KEY" />
                <Input value={val} onChange={(e) => { const n = [...envVars]; n[i] = [key, e.target.value]; setEnvVars(n) }} className="h-7 text-xs font-mono flex-1" placeholder="value" type="password" />
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEnvVars(envVars.filter((_, j) => j !== i))} aria-label="Remove environment variable">
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter className="flex justify-between">
          {isEdit && <Button variant="destructive" size="sm" className="text-xs" onClick={handleRemove}>{confirmRemove ? 'Confirm Remove' : 'Remove'}</Button>}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="text-xs" onClick={handleSave} disabled={!name}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
