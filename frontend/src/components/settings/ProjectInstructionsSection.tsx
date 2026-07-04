// T035 — Project Instructions editor (Settings section)
import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'

const STARTER_TEMPLATE = `# Project Instructions

## Context
Describe your project and what the agent should know about it.

## Preferred Tools
- List the tools and skills the agent should prioritize

## Coding Conventions
- Language and framework preferences
- Style guidelines

## Important Notes
- Any constraints or special considerations
`

export function ProjectInstructionsSection() {
  const [content, setContent] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('agentii-project-instructions')
    setContent(stored ?? STARTER_TEMPLATE)
  }, [])

  const handleSave = useCallback(() => {
    localStorage.setItem('agentii-project-instructions', content)
    setSaved(true)
    toast.success('Instructions saved')
    setTimeout(() => setSaved(false), 2000)
  }, [content])

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Project Instructions</h2>
          <p className="text-xs text-muted-foreground mt-1">Edit the .agentii.md file that guides agent behavior for this project.</p>
        </div>
        <Button size="sm" className="text-xs h-8" onClick={handleSave}>
          <Save className="h-3.5 w-3.5 mr-1" />
          {saved ? 'Saved!' : 'Save'}
        </Button>
      </div>
      <div className="rounded border border-border overflow-hidden">
        <CodeMirror
          value={content}
          onChange={setContent}
          extensions={[markdown()]}
          theme={oneDark}
          height="400px"
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: true,
          }}
          className="text-xs"
        />
      </div>
    </div>
  )
}
