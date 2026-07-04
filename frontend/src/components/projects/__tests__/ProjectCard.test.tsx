import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ProjectCard } from '@/components/projects/ProjectCard'
import type { Project } from '@/types/project'

vi.mock('@/hooks/useProjects', () => ({
  useProjects: () => ({
    deleteProject: vi.fn(),
    archiveProject: vi.fn(),
    updateProject: vi.fn(),
  }),
}))

const mockProject: Project = {
  id: 'proj-1',
  owner_id: 'user-1',
  name: 'Test Project',
  ticker_symbols: ['AAPL', 'MSFT'],
  project_type: 'us_stock',
  description: 'A test project',
  is_featured: false,
  is_template: false,
  file_count: 5,
  session_count: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-03-01T00:00:00Z',
  archived_at: null,
  metadata: {},
}

function renderWithRouter(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

describe('ProjectCard', () => {
  it('renders project name', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('Test Project')).toBeDefined()
  })

  it('renders ticker symbols', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('AAPL')).toBeDefined()
    expect(screen.getByText('MSFT')).toBeDefined()
  })

  it('renders project type', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText('us_stock')).toBeDefined()
  })

  it('renders file and session counts', () => {
    renderWithRouter(<ProjectCard project={mockProject} />)
    expect(screen.getByText(/5/)).toBeDefined()
    expect(screen.getByText(/2/)).toBeDefined()
  })
})
