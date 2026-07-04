import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  LayoutGrid,
  LineChart,
  FlaskConical,
  Briefcase,
  ClipboardList,
  ArrowLeftRight,
  Workflow,
  Settings,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/projects', icon: LayoutGrid, label: 'Projects' },
  { to: '/options', icon: LineChart, label: 'Options' },
  { to: '/catalysts', icon: FlaskConical, label: 'Catalysts' },
  { to: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { to: '/orders', icon: ClipboardList, label: 'Orders' },
  { to: '/trades', icon: ArrowLeftRight, label: 'Trades' },
  { to: '/flow', icon: Workflow, label: 'Flow' },
  { to: '/gis', icon: Globe, label: 'GIS Data' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  return (
    <aside className="flex h-full w-14 flex-col items-center border-r border-border bg-sidebar py-4 gap-1">
      <div className="mb-4 text-lg font-bold text-primary">A</div>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn(
              'flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive && 'bg-accent text-accent-foreground',
            )
          }
          title={item.label}
        >
          <item.icon className="h-5 w-5" />
        </NavLink>
      ))}
    </aside>
  )
}
