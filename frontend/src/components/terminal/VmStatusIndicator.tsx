import React, { useState } from 'react';

type VmStatus = 'booting' | 'running' | 'stopped' | 'error' | 'unknown';
type McpHealth = 'healthy' | 'down' | 'restarted' | 'unknown';

interface VmStatusIndicatorProps {
  /** Current VM status */
  status: VmStatus;
  /** MCP health per CLI name */
  mcpHealth?: Record<string, McpHealth>;
  /** Base image version */
  baseImageVersion?: string;
  /** Uptime in seconds */
  uptimeSeconds?: number;
}

const STATUS_COLORS: Record<VmStatus, string> = {
  running: 'bg-green-500',
  booting: 'bg-yellow-500 animate-pulse',
  stopped: 'bg-gray-400',
  error: 'bg-red-500',
  unknown: 'bg-gray-300',
};

const STATUS_LABELS: Record<VmStatus, string> = {
  running: 'Running',
  booting: 'Booting...',
  stopped: 'Stopped',
  error: 'Error',
  unknown: 'Unknown',
};

const MCP_HEALTH_COLORS: Record<McpHealth, string> = {
  healthy: 'text-green-500',
  down: 'text-red-500',
  restarted: 'text-yellow-500',
  unknown: 'text-gray-400',
};

function formatUptime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

/**
 * VM status indicator for the terminal panel.
 * Shows a colored dot with expandable details panel.
 */
export function VmStatusIndicator({
  status,
  mcpHealth = {},
  baseImageVersion,
  uptimeSeconds,
}: VmStatusIndicatorProps) {
  const [expanded, setExpanded] = useState(false);

  const hasMcpIssues = Object.values(mcpHealth).some(
    (h) => h === 'down' || h === 'restarted'
  );

  // Override dot color if MCP has issues but VM is running
  const dotColor =
    status === 'running' && hasMcpIssues
      ? 'bg-yellow-500'
      : STATUS_COLORS[status];

  return (
    <div className="relative">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded hover:bg-muted transition-colors"
        title={`VM: ${STATUS_LABELS[status]}`}
      >
        <span className={`inline-block w-2 h-2 rounded-full ${dotColor}`} />
        <span className="text-muted-foreground">{STATUS_LABELS[status]}</span>
      </button>

      {expanded && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border border-border rounded-md shadow-lg p-3 z-50">
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{STATUS_LABELS[status]}</span>
            </div>

            {uptimeSeconds !== undefined && status === 'running' && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-mono">{formatUptime(uptimeSeconds)}</span>
              </div>
            )}

            {baseImageVersion && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Base image</span>
                <span className="font-mono">v{baseImageVersion}</span>
              </div>
            )}

            {Object.keys(mcpHealth).length > 0 && (
              <>
                <div className="border-t border-border pt-2 mt-2">
                  <span className="text-muted-foreground font-medium">MCP Tools</span>
                </div>
                {Object.entries(mcpHealth).map(([cli, health]) => (
                  <div key={cli} className="flex justify-between">
                    <span className="text-muted-foreground">{cli}</span>
                    <span className={MCP_HEALTH_COLORS[health]}>
                      {health}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
