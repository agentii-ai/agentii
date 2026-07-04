import { useCallback } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { oneDark } from '@codemirror/theme-one-dark'
import { python } from '@codemirror/lang-python'
import { sql } from '@codemirror/lang-sql'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { javascript } from '@codemirror/lang-javascript'
import { rust } from '@codemirror/lang-rust'
import { yaml } from '@codemirror/lang-yaml'
import { html } from '@codemirror/lang-html'
import { cpp } from '@codemirror/lang-cpp'
import { keymap } from '@codemirror/view'

interface CodeEditorProps {
  content: string
  language?: string
  readOnly?: boolean
  onChange?: (value: string) => void
  onSave?: (value: string) => void
}

function getExtensions(language?: string) {
  switch (language) {
    case 'py': return [python()]
    case 'sql': return [sql()]
    case 'json': return [json()]
    case 'md': return [markdown()]
    case 'js': case 'jsx': return [javascript({ jsx: true })]
    case 'ts': case 'tsx': return [javascript({ jsx: true, typescript: true })]
    case 'rs': return [rust()]
    case 'yaml': case 'yml': case 'toml': return [yaml()]
    case 'html': case 'htm': case 'css': case 'xml': case 'svg': return [html()]
    case 'c': case 'cpp': case 'h': case 'hpp': return [cpp()]
    default: return []
  }
}

export function CodeEditor({ content, language, readOnly = false, onChange, onSave }: CodeEditorProps) {
  const handleSaveKeymap = useCallback(() => {
    if (!onSave) return []
    return [keymap.of([{
      key: 'Mod-s',
      run: (view) => {
        onSave(view.state.doc.toString())
        return true
      },
    }])]
  }, [onSave])

  return (
    <CodeMirror
      value={content}
      height="100%"
      theme={oneDark}
      extensions={[...getExtensions(language), ...handleSaveKeymap()]}
      readOnly={readOnly}
      onChange={onChange}
      className="h-full"
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        highlightSelectionMatches: true,
      }}
    />
  )
}
