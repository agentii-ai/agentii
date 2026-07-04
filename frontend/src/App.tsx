import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { Providers } from '@/app/providers'
import { AuthProvider } from '@/providers/AuthProvider'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { Layout } from '@/components/layout/Layout'
import { ErrorBoundary } from '@/components/layout/ErrorBoundary'
import { CommandPalette } from '@/components/layout/CommandPalette'
import { Skeleton } from '@/components/ui/skeleton'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const OptionsPage = lazy(() => import('@/pages/OptionsPage'))
const CatalystsPage = lazy(() => import('@/pages/CatalystsPage'))
const PortfolioPage = lazy(() => import('@/pages/PortfolioPage'))
const OrderBookPage = lazy(() => import('@/pages/OrderBookPage'))
const TradeBookPage = lazy(() => import('@/pages/TradeBookPage'))
const FlowPage = lazy(() => import('@/pages/FlowPage'))
const FlowEditorPage = lazy(() => import('@/pages/FlowEditorPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const ProjectsDashboard = lazy(() => import('@/pages/ProjectsDashboard'))
const IDEPage = lazy(() => import('@/pages/IDEPage'))
const SearchPage = lazy(() => import('@/pages/SearchPage'))
const MemoryPage = lazy(() => import('@/pages/MemoryPage'))
const SessionHistoryPage = lazy(() => import('@/pages/SessionHistoryPage'))
const AgentActivityPage = lazy(() => import('@/pages/AgentActivityPage'))
const SchedulerPage = lazy(() => import('@/pages/SchedulerPage'))
const GISPage = lazy(() => import('@/pages/GISPage'))

function PageLoader() {
  return (
    <div className="flex flex-col gap-4 p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <Providers>
        <BrowserRouter>
          <CommandPalette />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<Layout />}>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/options/:symbol?" element={<OptionsPage />} />
                  <Route path="/catalysts" element={<CatalystsPage />} />
                  <Route path="/portfolio" element={<PortfolioPage />} />
                  <Route path="/orders" element={<OrderBookPage />} />
                  <Route path="/trades" element={<TradeBookPage />} />
                  <Route path="/flow" element={<FlowPage />} />
                  <Route path="/flow/:id" element={<FlowEditorPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/projects" element={<ErrorBoundary fallbackLabel="Failed to load projects"><ProjectsDashboard /></ErrorBoundary>} />
                  <Route path="/ide" element={<ErrorBoundary fallbackLabel="Failed to load IDE"><IDEPage /></ErrorBoundary>} />
                  <Route path="/search" element={<SearchPage />} />
                  <Route path="/memory" element={<MemoryPage />} />
                  <Route path="/sessions" element={<ErrorBoundary fallbackLabel="Failed to load sessions"><SessionHistoryPage /></ErrorBoundary>} />
                  <Route path="/agent-activity" element={<ErrorBoundary fallbackLabel="Failed to load agent activity"><AgentActivityPage /></ErrorBoundary>} />
                  <Route path="/schedules" element={<ErrorBoundary fallbackLabel="Failed to load scheduler"><SchedulerPage /></ErrorBoundary>} />
                  <Route path="/gis" element={<ErrorBoundary fallbackLabel="Failed to load GIS data"><GISPage /></ErrorBoundary>} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </Providers>
    </AuthProvider>
  )
}

export default App
