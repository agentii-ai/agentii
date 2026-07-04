// T036 — Instructions side panel (compact editor)
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export function InstructionsPanel() {
  const navigate = useNavigate()
  const [content, setContent] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem('agentii-project-instructions')
    setContent(stored ?? '')
  }, [])

  const handleSave = useCallback(() => {
    if (content) localStorage.setItem('agentii-project-instructions', content)
  }, [content])

  const handleBlur = () => {
    handleSave()
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave])

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold">Project Instructions</h3>
        <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => navigate('/settings?section=instructions')}>
          <ExternalLink className="h-3 w-3 mr-0.5" /> Full Editor
        </Button>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={handleBlur}
        className="flex-1 bg-muted p-2 text-xs font-mono rounded border border-border resize-none focus:outline-none focus:ring-1 focus:ring-ring"
        placeholder="Edit .agentii.md instructions..."
        spellCheck={false}
        aria-label="Project instructions editor"
      />
    </div>
  )
}
