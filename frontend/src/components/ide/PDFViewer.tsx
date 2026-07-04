interface PDFViewerProps {
  filePath: string
}

export function PDFViewer({ filePath }: PDFViewerProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">PDF Viewer</p>
      <p className="mt-1 text-xs text-muted-foreground">{filePath}</p>
      <p className="mt-2 text-xs text-muted-foreground">PDF rendering requires react-pdf setup with worker</p>
    </div>
  )
}
