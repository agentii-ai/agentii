// T027 — Data Provider credential dialog
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDataProviderKeys } from '@/hooks/useDataProviderKeys'
import type { DataProviderDefinition } from '@/types/data-provider'

interface DataProviderDialogProps {
  provider: DataProviderDefinition
  onClose: () => void
}

export function DataProviderDialog({ provider, onClose }: DataProviderDialogProps) {
  const { keys, validateAndSave, deleteKey } = useDataProviderKeys()
  const keyInfo = keys.find((k) => k.providerId === provider.id)
  const isConfigured = keyInfo?.status !== 'not-configured'

  const [credentials, setCredentials] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    try {
      await validateAndSave(provider.id, credentials)
      toast.success(`${provider.name} API key saved`)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    await deleteKey(provider.id)
    toast.success(`${provider.name} API key removed`)
    onClose()
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">{provider.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">{provider.description}</p>
          <a href={provider.portalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="h-3 w-3" /> Developer Portal
          </a>
          {provider.credentialFields.map((field) => (
            <div key={field.name} className="space-y-1">
              <Label className="text-xs">{field.label}</Label>
              <Input
                type={field.type}
                placeholder={field.placeholder}
                value={credentials[field.name] ?? ''}
                onChange={(e) => setCredentials((prev) => ({ ...prev, [field.name]: e.target.value }))}
                className="h-8 text-xs"
              />
            </div>
          ))}
          {provider.providerType === 'first-party' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Base URL (read-only)</Label>
              <Input value={provider.baseUrl} disabled className="h-8 text-xs opacity-60" />
            </div>
          )}
          {keyInfo?.lastValidated && (
            <p className="text-[10px] text-muted-foreground">Last validated: {new Date(keyInfo.lastValidated).toLocaleString()}</p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex justify-between">
          {isConfigured && (
            <Button variant="destructive" size="sm" className="text-xs" onClick={handleDelete} aria-label={`Remove ${provider.name} API key`}>
              {confirmDelete ? 'Confirm Remove' : 'Remove Key'}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" className="text-xs" onClick={onClose}>Cancel</Button>
            <Button size="sm" className="text-xs" onClick={handleSave} disabled={loading}>
              {loading && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
              Validate & Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
