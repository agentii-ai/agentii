import { useParams } from 'react-router-dom'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWatchlistStore } from '@/stores/watchlistStore'
import { useOptionChain } from '@/hooks/useOptionChain'
import { OptionChainGrid } from '@/components/options/OptionChainGrid'
import { GreeksChart } from '@/components/options/GreeksChart'
import { IVSurface } from '@/components/options/IVSurface'
import { IVSmile } from '@/components/options/IVSmile'
import { PayoffDiagram } from '@/components/options/PayoffDiagram'
import { usePayoffDiagram } from '@/api/options'
import { useState } from 'react'

export default function OptionsPage() {
  const { symbol } = useParams()
  const selectedSymbol = useWatchlistStore((s) => s.selectedSymbol)
  const activeSymbol = symbol || selectedSymbol || 'MRNA'
  const { calls, puts, atmStrike } = useOptionChain(activeSymbol)
  const payoffMutation = usePayoffDiagram()
  const [activeTab, setActiveTab] = useState('chain')

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-semibold">{activeSymbol} Options</h1>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="chain">Chain</TabsTrigger>
          <TabsTrigger value="greeks">Greeks</TabsTrigger>
          <TabsTrigger value="surface">IV Surface</TabsTrigger>
          <TabsTrigger value="smile">IV Smile</TabsTrigger>
          <TabsTrigger value="payoff">Payoff</TabsTrigger>
        </TabsList>
        <TabsContent value="chain" className="flex-1">
          <OptionChainGrid symbol={activeSymbol} />
        </TabsContent>
        <TabsContent value="greeks" className="flex-1">
          <GreeksChart calls={calls} puts={puts} />
        </TabsContent>
        <TabsContent value="surface" className="flex-1">
          <IVSurface symbol={activeSymbol} />
        </TabsContent>
        <TabsContent value="smile" className="flex-1">
          <IVSmile calls={calls} puts={puts} atmStrike={atmStrike} />
        </TabsContent>
        <TabsContent value="payoff" className="flex-1">
          <PayoffDiagram
            diagram={payoffMutation.data ?? null}
            isLoading={payoffMutation.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
