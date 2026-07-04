import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FileRenderer } from '@/components/ide/FileRenderer'

vi.mock('@/hooks/useFileSystem', () => ({
  useFileSystem: () => ({
    readFile: vi.fn().mockResolvedValue({ content: '# Hello World', isBinary: false }),
    readDirectory: vi.fn().mockResolvedValue([]),
    writeFile: vi.fn(),
    openProjectDialog: vi.fn(),
    isTauri: false,
  }),
}))

vi.mock('@/components/ide/MarkdownViewer', () => ({
  MarkdownViewer: ({ content }: { content: string }) => <div data-testid="markdown-viewer">{content}</div>,
}))

vi.mock('@/components/ide/CodeEditor', () => ({
  CodeEditor: ({ content }: { content: string }) => <div data-testid="code-editor">{content}</div>,
}))

vi.mock('@/components/ide/CSVViewer', () => ({
  CSVEditor: ({ content }: { content: string }) => <div data-testid="csv-editor">{content}</div>,
  CSVViewer: ({ content }: { content: string }) => <div data-testid="csv-editor">{content}</div>,
}))

vi.mock('@/components/ide/JSONViewer', () => ({
  JSONViewer: ({ content }: { content: string }) => <div data-testid="json-viewer">{content}</div>,
}))

vi.mock('@/components/ide/PDFViewer', () => ({
  PDFViewer: ({ filePath }: { filePath: string }) => <div data-testid="pdf-viewer">{filePath}</div>,
}))

describe('FileRenderer', () => {
  it('dispatches .md files to MarkdownViewer in preview mode', async () => {
    render(<FileRenderer filePath="/project/readme.md" viewMode="preview" />)
    const viewer = await screen.findByTestId('markdown-viewer')
    expect(viewer).toBeDefined()
  })

  it('dispatches .md files to CodeEditor in source mode', async () => {
    render(<FileRenderer filePath="/project/readme.md" viewMode="source" />)
    const editor = await screen.findByTestId('code-editor')
    expect(editor).toBeDefined()
  })

  it('dispatches .py files to CodeEditor', async () => {
    render(<FileRenderer filePath="/project/script.py" />)
    const editor = await screen.findByTestId('code-editor')
    expect(editor).toBeDefined()
  })

  it('dispatches .csv files to CSVEditor', async () => {
    render(<FileRenderer filePath="/project/data.csv" />)
    const viewer = await screen.findByTestId('csv-editor')
    expect(viewer).toBeDefined()
  })

  it('dispatches .json files to CodeEditor with JSON mode', async () => {
    render(<FileRenderer filePath="/project/config.json" />)
    const editor = await screen.findByTestId('code-editor')
    expect(editor).toBeDefined()
  })

  it('dispatches .pdf files to PDFViewer', async () => {
    render(<FileRenderer filePath="/project/report.pdf" />)
    const viewer = await screen.findByTestId('pdf-viewer')
    expect(viewer).toBeDefined()
  })

  it('dispatches .ts files to CodeEditor', async () => {
    render(<FileRenderer filePath="/project/app.ts" />)
    const editor = await screen.findByTestId('code-editor')
    expect(editor).toBeDefined()
  })

  it('dispatches .rs files to CodeEditor', async () => {
    render(<FileRenderer filePath="/project/main.rs" />)
    const editor = await screen.findByTestId('code-editor')
    expect(editor).toBeDefined()
  })

  it('dispatches .env files to CodeEditor', async () => {
    render(<FileRenderer filePath="/project/.env.local" />)
    const editor = await screen.findByTestId('code-editor')
    expect(editor).toBeDefined()
  })

  it('dispatches unknown text files to CodeEditor', async () => {
    render(<FileRenderer filePath="/project/notes.txt" />)
    const editor = await screen.findByTestId('code-editor')
    expect(editor).toBeDefined()
  })
})
