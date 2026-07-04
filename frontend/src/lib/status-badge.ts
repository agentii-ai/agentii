import type { ConfigStatus } from '@/types/extension-registry'

export const STATUS_BADGE: Record<ConfigStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  configured: { label: 'Configured', variant: 'default' },
  needs_setup: { label: 'Needs Setup', variant: 'destructive' },
  none: { label: '', variant: 'outline' },
}
