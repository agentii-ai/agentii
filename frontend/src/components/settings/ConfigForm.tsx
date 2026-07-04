import { useState, useCallback, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Eye, EyeOff, AlertCircle, Check } from 'lucide-react'
import type { ConfigField } from '@/types/extension-registry'

interface ConfigFormProps {
  fields: ConfigField[]
  onSave: (values: Record<string, string>) => void
  saving?: boolean
}

export function ConfigForm({ fields, onSave, saving }: ConfigFormProps) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, '']))
  )
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})

  const handleChange = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const toggleSecret = useCallback((key: string) => {
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(values)
  }

  const hasChanges = fields.some((f) => values[f.key] !== '')

  // R5: Check that all required fields without existing values have been filled
  const requiredMissing = useMemo(() => {
    if (!hasChanges) return false
    return fields
      .filter((f) => f.required && !f.hasValue)
      .some((f) => !values[f.key])
  }, [fields, values, hasChanges])

  if (fields.length === 0) return null

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <div className="flex items-center gap-1.5">
            <Label htmlFor={field.key} className="text-xs font-medium">
              {field.label}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {field.hasValue && (
              <Check className="h-3 w-3 text-green-500" />
            )}
            {field.required && !field.hasValue && (
              <AlertCircle className="h-3 w-3 text-amber-500" />
            )}
            {field.helpUrl && (
              <a href={field.helpUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground" aria-label={`Help for ${field.label}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3 w-3"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              </a>
            )}
          </div>
          {field.type === 'select' && field.options ? (
            <Select value={values[field.key] || undefined} onValueChange={(v) => handleChange(field.key, v)}>
              <SelectTrigger id={field.key} className="h-8 text-xs" aria-required={field.required}>
                <SelectValue placeholder={field.placeholder || 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="relative">
              <Input
                id={field.key}
                type={field.type === 'secret' && !showSecrets[field.key] ? 'password' : 'text'}
                placeholder={field.hasValue ? '••••••••  (saved)' : field.placeholder || ''}
                value={values[field.key]}
                onChange={(e) => handleChange(field.key, e.target.value)}
                className="h-8 text-xs pr-8"
                aria-required={field.required}
              />
              {field.type === 'secret' && (
                <button
                  type="button"
                  onClick={() => toggleSecret(field.key)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showSecrets[field.key] ? 'Hide secret' : 'Show secret'}
                >
                  {showSecrets[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              )}
            </div>
          )}
        </div>
      ))}
      <Button type="submit" size="sm" disabled={!hasChanges || requiredMissing || saving} className="w-full h-8 text-xs">
        {saving ? 'Saving...' : 'Save Configuration'}
      </Button>
    </form>
  )
}
