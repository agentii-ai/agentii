import { useEffect, useCallback } from 'react'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import type { VMStatus, McpHealth } from '@/stores/workspaceStore'
import { useTerminalStore } from '@/stores/terminalStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { isTauri } from '@/config/tauri'
import type { CliReadinessState } from '@/types/cli-readiness'

/** VM status event shape from Channel 2 WebSocket */
interface VmStatusEvent {
  type: 'vm.status'
  project_id: string
  status: VMStatus
  mcp_health?: Record<string, McpHealth>
  base_image_version?: string
  uptime_seconds?: number
}

export function useVMStatus(projectId: string | null) {
  const vmStatus = useWorkspaceStore((s) => s.vmStatus)
  const mcpHealth = useWorkspaceStore((s) => s.mcpHealth)
  const baseImageVersion = useWorkspaceStore((s) => s.baseImageVersion)
  const setVMStatus = useWorkspaceStore((s) => s.setVMStatus)
  const setVMBootProgress = useWorkspaceStore((s) => s.setVMBootProgress)
  const setVMError = useWorkspaceStore((s) => s.setVMError)
  const setMcpHealth = useWorkspaceStore((s) => s.setMcpHealth)
  const setBaseImageVersion = useWorkspaceStore((s) => s.setBaseImageVersion)
  const { sendRpc, onEvent } = useWebSocket()

  // Query current VM status via RPC
  const checkStatus = useCallback(async () => {
    if (!projectId) return
    try {
      const result = await sendRpc<{ status?: VMStatus }>('vm.status', { project_id: projectId })
      if (result?.status) {
        setVMStatus(result.status)
      }
    } catch {
      // VM may not be available yet
    }
  }, [projectId, sendRpc, setVMStatus])

  // Send page.navigate to trigger pre-warming
  const notifyPageNavigate = useCallback(() => {
    if (!projectId) return

    // Try Tauri invoke first for desktop
    if (isTauri()) {
      try {
        const tauri = (window as unknown as Record<string, unknown>).__TAURI__ as
          | { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> }
          | undefined
        tauri?.invoke('page_navigate', { page: 'ide', projectId }).catch(() => {
          // Fallback: gateway may not have this command yet
        })
      } catch {
        // Non-Tauri environment, skip
      }
    }

    // Also send via WebSocket RPC so the gateway can trigger pre-warm
    sendRpc('page.navigate', { page: 'ide', project_id: projectId }).catch(() => {
      // Gateway may not support this yet
    })
  }, [projectId, sendRpc])

  // Send page.navigate on mount to trigger pre-warming
  useEffect(() => {
    if (projectId) {
      notifyPageNavigate()
    }
  }, [projectId, notifyPageNavigate])

  // Listen for vm.boot events (legacy boot progress)
  useEffect(() => {
    if (!projectId) return

    const unsubscribe = onEvent('vm.boot', (params) => {
      const p = params as { status: string; progress_pct: number; error: string | null }
      if (p.status === 'ready') {
        setVMStatus('running')
        setVMBootProgress(100)
      } else if (p.status === 'failed') {
        setVMStatus('error')
        setVMError(p.error)
      } else {
        setVMStatus('booting')
        setVMBootProgress(p.progress_pct)
      }
    })

    checkStatus()
    return unsubscribe
  }, [projectId, onEvent, checkStatus, setVMStatus, setVMBootProgress, setVMError])

  // Listen for vm.status events (new structured status from VmEventBus)
  useEffect(() => {
    if (!projectId) return

    const unsubscribe = onEvent('vm.status', (params) => {
      const evt = params as unknown as VmStatusEvent
      if (evt.project_id !== projectId) return

      setVMStatus(evt.status)
      if (evt.mcp_health) {
        setMcpHealth(evt.mcp_health)
      }
      if (evt.base_image_version) {
        setBaseImageVersion(evt.base_image_version)
      }
    })

    return unsubscribe
  }, [projectId, onEvent, setVMStatus, setMcpHealth, setBaseImageVersion])

  // T056: Listen for cli.readiness_changed events from Channel 2
  const setTabReadiness = useTerminalStore((s) => s.setTabReadiness)

  useEffect(() => {
    const unsubscribe = onEvent('cli.readiness_changed', (params) => {
      const data = params as {
        tab_id?: string
        cli_id?: string
        state?: CliReadinessState
        injected_keys?: string[]
        error_message?: string | null
      }
      if (data.tab_id && data.state) {
        setTabReadiness(data.tab_id, data.state, data.injected_keys, data.error_message ?? undefined)
      }
    })
    return unsubscribe
  }, [onEvent, setTabReadiness])

  return {
    vmStatus,
    mcpHealth,
    baseImageVersion,
    isBooting: vmStatus === 'booting',
    isReady: vmStatus === 'running',
    checkStatus,
    notifyPageNavigate,
  }
}
