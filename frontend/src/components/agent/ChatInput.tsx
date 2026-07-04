import { useState, useRef, useEffect } from 'react'
import { Send, Square, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (text: string) => void
  onAbort: () => void
  isStreaming: boolean
  disabled?: boolean
}

/** @deprecated Replaced by terminal-based agent panel (spec v2.0, 2026-03-20) */
export function ChatInput({ onSend, onAbort, isStreaming, disabled }: ChatInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [text])

  const handleSend = () => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border p-3">
      <div className="flex items-end gap-2 rounded-lg border border-border bg-background p-2">
        <button
          type="button"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent"
          aria-label="Attach file"
        >
          <Paperclip className="h-4 w-4" />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your analysis..."
          disabled={disabled}
          rows={1}
          className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={onAbort}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-destructive text-destructive-foreground hover:bg-destructive/90"
            aria-label="Stop generation"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!text.trim()}
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded transition-colors',
              text.trim() ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'text-muted-foreground',
            )}
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </div>
      <p className="mt-1 text-center text-[10px] text-muted-foreground">⌘+Enter to send</p>
    </div>
  )
}
