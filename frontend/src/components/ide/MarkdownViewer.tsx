import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

interface MarkdownViewerProps {
  content: string
  viewMode?: 'source' | 'preview' | 'split'
}

export function MarkdownViewer({ content, viewMode = 'preview' }: MarkdownViewerProps) {
  if (viewMode === 'source') {
    return (
      <pre className="h-full overflow-auto p-4 font-mono text-sm">
        <code>{content}</code>
      </pre>
    )
  }

  return (
    <div className="h-full overflow-auto p-6">
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto rounded border border-border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-border bg-muted/50">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{children}</th>,
          td: ({ children }) => {
            const text = String(children ?? '')
            const isNumeric = /^[\d,.$%+-]+$/.test(text.trim())
            const isPositive = text.includes('+') || (isNumeric && !text.includes('-') && parseFloat(text.replace(/[,$%]/g, '')) > 0)
            const isNegative = text.includes('-') && isNumeric
            return (
              <td className={cn(
                'px-3 py-2 border-b border-border',
                isNumeric && 'text-right font-mono',
                isPositive && 'text-green-500',
                isNegative && 'text-red-500',
              )}>
                {children}
              </td>
            )
          },
          h1: ({ children }) => <h1 className="mb-4 mt-6 text-2xl font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-3 mt-5 text-xl font-semibold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-4 text-lg font-medium">{children}</h3>,
          p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 ml-6 list-disc">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 ml-6 list-decimal">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-')
            if (isBlock) {
              return (
                <pre className="my-3 overflow-x-auto rounded bg-muted p-4">
                  <code className="font-mono text-sm">{children}</code>
                </pre>
              )
            }
            return <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">{children}</code>
          },
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-4 border-primary/30 pl-4 italic text-muted-foreground">
              {children}
            </blockquote>
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            <a href={href} className="text-blue-500 underline hover:text-blue-400" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          hr: () => <hr className="my-6 border-border" />,
        }}
      >
        {content}
      </Markdown>
    </div>
  )
}
