import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useWorkspaceStore, type PageContext } from '@/stores/workspaceStore'

const pathToPage: Record<string, PageContext> = {
  '/ide': 'ide',
  '/': 'trading',
  '/settings': 'settings',
  '/catalysts': 'catalysts',
  '/portfolio': 'portfolio',
}

export function usePageContext() {
  const location = useLocation()
  const setCurrentPage = useWorkspaceStore((s) => s.setCurrentPage)
  const currentPage = useWorkspaceStore((s) => s.currentPage)

  useEffect(() => {
    const page = pathToPage[location.pathname] ?? 'ide'
    if (page !== currentPage) {
      setCurrentPage(page)
    }
  }, [location.pathname, currentPage, setCurrentPage])

  return currentPage
}
