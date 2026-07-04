import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TabBar } from '@/components/ide/TabBar'
import type { FileTab } from '@/types/ide'

const mockTabs: FileTab[] = [
  { id: '/project/file1.md', filePath: '/project/file1.md', fileName: 'file1.md', isDirty: false, cursorPos: 0, scrollTop: 0, viewMode: 'preview' },
  { id: '/project/file2.py', filePath: '/project/file2.py', fileName: 'file2.py', isDirty: true, cursorPos: 10, scrollTop: 0, viewMode: 'source' },
]

describe('TabBar', () => {
  it('renders tabs with file names', () => {
    render(<TabBar tabs={mockTabs} activeTabId={mockTabs[0].id} onTabSelect={vi.fn()} onTabClose={vi.fn()} />)
    expect(screen.getByText('file1.md')).toBeDefined()
    expect(screen.getByText('file2.py')).toBeDefined()
  })

  it('calls onTabSelect when tab clicked', () => {
    const onTabSelect = vi.fn()
    render(<TabBar tabs={mockTabs} activeTabId={mockTabs[0].id} onTabSelect={onTabSelect} onTabClose={vi.fn()} />)
    fireEvent.click(screen.getByText('file2.py'))
    expect(onTabSelect).toHaveBeenCalledWith('/project/file2.py')
  })

  it('calls onTabClose when close button clicked', () => {
    const onTabClose = vi.fn()
    render(<TabBar tabs={mockTabs} activeTabId={mockTabs[0].id} onTabSelect={vi.fn()} onTabClose={onTabClose} />)
    const closeButtons = screen.getAllByLabelText('Close tab')
    fireEvent.click(closeButtons[0])
    expect(onTabClose).toHaveBeenCalledWith('/project/file1.md')
  })

  it('returns null when no tabs', () => {
    const { container } = render(<TabBar tabs={[]} activeTabId={null} onTabSelect={vi.fn()} onTabClose={vi.fn()} />)
    expect(container.innerHTML).toBe('')
  })
})
