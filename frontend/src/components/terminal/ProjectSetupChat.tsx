import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { useProjectSetupChat } from '@/hooks/useProjectSetupChat'
import { useProjects } from '@/hooks/useProjects'
import { useIDEStore } from '@/stores/ideStore'

export function ProjectSetupChat() {
  const navigate = useNavigate()
  const { messages, isLoading, projectReady, error, sendMessage } = useProjectSetupChat()
  const { createProject } = useProjects()
  const setActiveProjectId = useIDEStore((s) => s.setActiveProjectId)
  const [input, setInput] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, projectReady, createError])

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = () => {
    const text = input.trim()
    if (!text || isLoading) return
    setInput('')
    sendMessage(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCreateProject = async () => {
    if (!projectReady || isCreating) return
    setIsCreating(true)
    setCreateError(null)
    try {
      const project = await createProject({
        name: projectReady.name,
        ticker_symbols: projectReady.tickers,
        project_type: projectReady.project_type,
        description: projectReady.description || null,
      })
      setActiveProjectId(project.id)
      navigate(`/ide?project=${project.id}`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create project'
      console.error('Failed to create project:', e)
      setCreateError(msg)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex h-full flex-col bg-[#1a1b26]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <span className="text-sm font-medium text-zinc-300">New Project</span>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Welcome message if no messages yet */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-sm text-zinc-400">What would you like to analyze or trade?</p>
            <p className="text-xs text-zinc-600">
              Try: "I want to analyze NVDA earnings" or "Set up a BTC swing trade"
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-violet-600/20 text-zinc-200'
                  : 'bg-white/5 text-zinc-300'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-zinc-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              Thinking...
            </div>
          </div>
        )}

        {/* Error */}
        {(error || createError) && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error || createError}
          </div>
        )}

        {/* Project ready card */}
        {projectReady && (
          <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
            <p className="text-xs font-medium text-violet-400 uppercase tracking-wide">Ready to create</p>
            <p className="text-sm font-medium text-zinc-200">{projectReady.name}</p>
            <div className="flex flex-wrap gap-1.5">
              {projectReady.tickers.map((t) => (
                <span
                  key={t}
                  className="rounded bg-violet-500/20 px-1.5 py-0.5 text-xs font-mono text-violet-300"
                >
                  {t}
                </span>
              ))}
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-zinc-400">
                {projectReady.project_type.replace(/_/g, ' ')}
              </span>
            </div>
            {projectReady.description && (
              <p className="text-xs text-zinc-500">{projectReady.description}</p>
            )}
            <button
              type="button"
              onClick={handleCreateProject}
              disabled={isCreating}
              className="mt-1 w-full rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-1.5">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to trade or analyze..."
            disabled={isLoading}
            className="flex-1 bg-transparent text-sm text-zinc-200 placeholder:text-zinc-600 outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="flex h-7 w-7 items-center justify-center rounded text-zinc-500 hover:text-zinc-300 disabled:opacity-30 transition-colors"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
