/**
 * Tauri multi-window support helper.
 * Creates new IDE or Trading windows using Tauri's WebviewWindow API.
 * Falls back to window.open() for web browser mode.
 */

const isTauri = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI__

export async function openNewWindow(
  type: 'ide' | 'trading',
  options?: { projectId?: string; ticker?: string },
): Promise<void> {
  const route = type === 'ide'
    ? `/ide/${options?.projectId ?? ''}`
    : `/${options?.ticker ? `options/${options.ticker}` : ''}`

  if (isTauri) {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow')
    const label = `${type}-${Date.now()}`
    new WebviewWindow(label, {
      url: route,
      title: type === 'ide' ? `Agentii IDE${options?.projectId ? ` — ${options.projectId}` : ''}` : `Agentii Trading${options?.ticker ? ` — ${options.ticker}` : ''}`,
      width: 1400,
      height: 900,
      minWidth: 800,
      minHeight: 600,
    })
  } else {
    window.open(route, '_blank', 'width=1400,height=900')
  }
}
