import { Settings, Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { cn } from '@/lib/utils'

export function SettingsPanel() {
  const { theme, setTheme } = useTheme()

  const themes = [
    { value: 'light', icon: Sun, label: 'Light' },
    { value: 'dark', icon: Moon, label: 'Dark' },
    { value: 'system', icon: Monitor, label: 'System' },
  ] as const

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex items-center gap-1.5">
        <Settings className="h-3.5 w-3.5" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Settings</span>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium">Theme</p>
        <div className="flex gap-1">
          {themes.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTheme(t.value)}
              className={cn(
                'flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors',
                theme === t.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent',
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium">Default Provider</p>
        <p className="text-xs text-muted-foreground">Anthropic (Claude)</p>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium">Keyboard Shortcuts</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Toggle Agent</span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘J</kbd></div>
          <div className="flex justify-between"><span>Close Tab</span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘W</kbd></div>
          <div className="flex justify-between"><span>Quick Open</span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘P</kbd></div>
          <div className="flex justify-between"><span>Focus Agent</span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘L</kbd></div>
          <div className="flex justify-between"><span>Switch Tab</span><kbd className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘1-9</kbd></div>
        </div>
      </div>
    </div>
  )
}
