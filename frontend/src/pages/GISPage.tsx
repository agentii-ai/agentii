import { useState } from 'react'
import { Ship, BarChart3, CloudSun } from 'lucide-react'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { VesselsPortsTab } from '@/components/gis/tabs/VesselsPortsTab'
import { EnergyMarketsTab } from '@/components/gis/tabs/EnergyMarketsTab'
import { WeatherSignalsTab } from '@/components/gis/tabs/WeatherSignalsTab'

type TabId = 'vessels' | 'energy' | 'weather'

const TABS: { id: TabId; label: string; icon: typeof Ship }[] = [
  { id: 'vessels', label: 'Vessels & Ports', icon: Ship },
  { id: 'energy', label: 'Energy Markets', icon: BarChart3 },
  { id: 'weather', label: 'Weather Signals', icon: CloudSun },
]

export default function GISPage() {
  const [activeTab, setActiveTab] = useState<TabId>('vessels')

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">GIS Data Hub</h1>
          {/* Tab buttons */}
          <div className="flex items-center gap-1 ml-4">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
                    activeTab === tab.id
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <ErrorBoundary fallbackLabel="Failed to load GIS data">
          {activeTab === 'vessels' && <VesselsPortsTab />}
          {activeTab === 'energy' && <EnergyMarketsTab />}
          {activeTab === 'weather' && <WeatherSignalsTab />}
        </ErrorBoundary>
      </div>
    </div>
  )
}
