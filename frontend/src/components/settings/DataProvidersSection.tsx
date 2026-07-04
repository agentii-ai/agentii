// T026 — Data Providers section
import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TrendingUp, Database, FlaskConical, Bot } from 'lucide-react'
import { DATA_PROVIDERS } from '@/data/data-providers'
import { useDataProviderKeys } from '@/hooks/useDataProviderKeys'
import { DataProviderDialog } from './DataProviderDialog'
import type { DataProviderDefinition } from '@/types/data-provider'

const ICONS: Record<string, React.ElementType> = { TrendingUp, Database, FlaskConical, Bot }

export function DataProvidersSection() {
  const { keys } = useDataProviderKeys()
  const [editProvider, setEditProvider] = useState<DataProviderDefinition | null>(null)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Data Providers</h2>
        <p className="text-xs text-muted-foreground mt-1">Connect market data sources for live trading data and agent-ready APIs.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {DATA_PROVIDERS.map((provider) => {
          const keyInfo = keys.find((k) => k.providerId === provider.id)
          const status = keyInfo?.status ?? 'not-configured'
          const Icon = ICONS[provider.logoIcon ?? ''] ?? Database
          return (
            <Card key={provider.id} className="cursor-pointer hover:border-primary/40 transition-colors" onClick={() => setEditProvider(provider)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{provider.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {provider.providerType === 'first-party' && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">First-party</Badge>
                    )}
                    <Badge variant={status === 'connected' ? 'default' : 'outline'} className="text-[10px] px-1.5 py-0">
                      {status === 'connected' ? 'Connected' : status === 'error' ? 'Error' : status === 'unvalidated' ? 'Unvalidated' : 'Not Configured'}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{provider.description}</p>
                <Button variant="outline" size="sm" className="text-xs h-7 w-full" onClick={(e) => { e.stopPropagation(); setEditProvider(provider) }}>
                  {status === 'not-configured' ? 'Configure' : 'Edit'}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
      {editProvider && (
        <DataProviderDialog provider={editProvider} onClose={() => setEditProvider(null)} />
      )}
    </div>
  )
}
