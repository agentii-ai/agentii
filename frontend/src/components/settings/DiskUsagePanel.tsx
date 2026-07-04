import React from 'react';

interface ProjectDiskUsage {
  project_id: string;
  vm_name: string;
  actual_bytes: number;
  virtual_bytes: number;
}

interface DiskUsageReport {
  base_image_bytes: number;
  projects: ProjectDiskUsage[];
  total_bytes: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface DiskUsagePanelProps {
  report: DiskUsageReport | null;
  loading?: boolean;
  warningThresholdBytes?: number;
}

/** Displays VM disk usage per project with total and warning threshold. */
export function DiskUsagePanel({
  report,
  loading = false,
  warningThresholdBytes = 8 * 1024 * 1024 * 1024, // 8 GB default
}: DiskUsagePanelProps) {
  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading disk usage...</div>;
  }

  if (!report) {
    return <div className="text-sm text-muted-foreground">No disk usage data available</div>;
  }

  const isOverThreshold = report.total_bytes > warningThresholdBytes;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">VM Disk Usage</span>
        <span
          className={`text-sm font-mono ${isOverThreshold ? 'text-destructive' : 'text-muted-foreground'}`}
        >
          {formatBytes(report.total_bytes)}
        </span>
      </div>

      {report.base_image_bytes > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Base image (shared)</span>
          <span className="font-mono">{formatBytes(report.base_image_bytes)}</span>
        </div>
      )}

      <div className="space-y-1">
        {report.projects.map((p) => (
          <div key={p.project_id} className="flex items-center justify-between text-xs">
            <span className="truncate max-w-[200px]" title={p.vm_name}>
              {p.vm_name}
            </span>
            <span className="font-mono text-muted-foreground">
              {formatBytes(p.actual_bytes)}
            </span>
          </div>
        ))}
      </div>

      {isOverThreshold && (
        <p className="text-xs text-destructive">
          Total disk usage exceeds {formatBytes(warningThresholdBytes)}. Consider removing unused
          projects.
        </p>
      )}
    </div>
  );
}
