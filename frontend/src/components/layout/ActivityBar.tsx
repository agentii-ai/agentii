import {
  LayoutGrid,
  Search,
  Brain,
  MessageSquare,
  LayoutDashboard,
  LineChart,
  FlaskConical,
  Briefcase,
  ClipboardList,
  ArrowLeftRight,
  Workflow,
  Settings,
  Clock,
  BarChart3,
  History,
  type LucideProps,
} from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import logoCompact from '@/assets/logo-compact.svg'

function IdeIcon(props: LucideProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <text
        x="12"
        y="15.5"
        textAnchor="middle"
        fontFamily="Futura, 'Futura PT', 'Century Gothic', sans-serif"
        fontSize="8.5"
        fontWeight="600"
        fill="currentColor"
        stroke="none"
        letterSpacing="0.5"
      >
        IDE
      </text>
    </svg>
  )
}

// Group B — IDE workspace (top)
const ideItems = [
  { to: '/ide', icon: IdeIcon, label: 'IDE' },
  { to: '/projects', icon: LayoutGrid, label: 'Projects' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/memory', icon: Brain, label: 'Memory' },
]

// Group A — Trading (below divider)
const tradingItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/options', icon: LineChart, label: 'Options' },
  { to: '/catalysts', icon: FlaskConical, label: 'Biotech Catalysts' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/orders', icon: ClipboardList, label: 'Orders' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trades' },
  { to: '/flow', icon: Workflow, label: 'Flow' },
  { to: '/sessions', icon: History, label: 'Sessions' },
  { to: '/agent-activity', icon: BarChart3, label: 'Agent Activity' },
  { to: '/schedules', icon: Clock, label: 'Schedules' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

interface ActivityBarProps {
  terminalPanelVisible: boolean
  onToggleTerminal: () => void
}

export function ActivityBar({ terminalPanelVisible, onToggleTerminal }: ActivityBarProps) {
  return (
    <div
      className="flex h-full w-12 flex-col items-center border-r border-border bg-sidebar py-2 gap-0.5"
      role="toolbar"
      aria-label="Activity Bar"
    >
      <img src={logoCompact} alt="agentii" className="mb-2 h-8 w-8" />

      {/* Group B — IDE */}
      {ideItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent text-accent-foreground',
            )
          }
          title={item.label}
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-primary shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              )}
              <item.icon className="h-4 w-4" />
            </>
          )}
        </NavLink>
      ))}

      {/* Divider */}
      <div className="my-1.5 h-px w-6 bg-border" />

      {/* Group A — Trading */}
      {tradingItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent text-accent-foreground',
            )
          }
          title={item.label}
        >
          <item.icon className="h-4 w-4" />
        </NavLink>
      ))}

      <div className="flex-1" />

      {/* Terminal toggle */}
      <button
        type="button"
        onClick={onToggleTerminal}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
          terminalPanelVisible && 'bg-accent text-accent-foreground',
        )}
        aria-label="Toggle Terminal"
        aria-pressed={terminalPanelVisible}
      >
        <MessageSquare className="h-4 w-4" />
      </button>
    </div>
  )
}
