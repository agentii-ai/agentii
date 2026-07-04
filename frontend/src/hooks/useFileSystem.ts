import { useCallback } from 'react'
import type { FileTreeNode } from '@/types/ide'

const isTauri = typeof window !== 'undefined' && !!(window as unknown as Record<string, unknown>).__TAURI__

async function tauriReadDir(path: string): Promise<FileTreeNode[]> {
  const { readDir } = await import('@tauri-apps/plugin-fs')
  const entries = await readDir(path)
  const nodes: FileTreeNode[] = []
  for (const entry of entries) {
    if (entry.name?.startsWith('.')) continue
    const fullPath = `${path}/${entry.name}`
    const isDir = entry.isDirectory
    const ext = isDir ? null : (entry.name?.split('.').pop() ?? null)
    const node: FileTreeNode = {
      id: fullPath,
      name: entry.name ?? '',
      isDirectory: isDir ?? false,
      extension: ext,
      pinned: entry.name === 'agentii.md',
    }
    if (isDir) {
      node.children = await tauriReadDir(fullPath)
    }
    nodes.push(node)
  }
  return sortNodes(nodes)
}

async function tauriReadFile(path: string): Promise<{ content: string; isBinary: boolean }> {
  const { readTextFile } = await import('@tauri-apps/plugin-fs')
  const content = await readTextFile(path)
  return { content, isBinary: false }
}

async function tauriWriteFile(path: string, content: string): Promise<void> {
  const { writeTextFile } = await import('@tauri-apps/plugin-fs')
  await writeTextFile(path, content)
}

// Web fallback: mock filesystem for development
const mockFiles: Record<string, string> = {
  '/project/agentii.md': '# Agentii Project\n\nTicker: **LLY**\n\n## Analysis\n\nThis is a sample research project for Eli Lilly.',
  '/project/analysis.md': '# Analysis\n\n## Revenue\n\n| Year | Revenue ($B) | Growth |\n|------|-------------|--------|\n| 2023 | 34.1 | 20% |\n| 2024 | 42.3 | 24% |\n| 2025 | 51.8 | 22% |\n\n## Key Findings\n\nStrong GLP-1 franchise driving growth.',
  '/project/data.csv': 'Date,Ticker,Price,Volume,Change\n2024-01-02,LLY,580.50,1200000,2.3\n2024-01-03,LLY,585.20,1350000,0.8\n2024-01-04,LLY,578.90,980000,-1.1\n2024-01-05,LLY,592.10,1500000,2.3',
  '/project/config.json': '{\n  "ticker": "LLY",\n  "name": "Eli Lilly",\n  "sector": "Healthcare",\n  "watchlist": ["LLY", "NVO", "ABBV"]\n}',
  '/project/strategy.py': '# Trading Strategy\nimport pandas as pd\n\ndef calculate_ema(prices: list[float], period: int = 20) -> list[float]:\n    """Calculate exponential moving average."""\n    df = pd.Series(prices)\n    return df.ewm(span=period).mean().tolist()\n\ndef signal(price: float, ema: float) -> str:\n    if price > ema * 1.02:\n        return "sell"\n    elif price < ema * 0.98:\n        return "buy"\n    return "hold"\n',
  '/project/queries.sql': 'SELECT ticker, date, close_price, volume\nFROM daily_prices\nWHERE ticker = \'LLY\'\n  AND date >= \'2024-01-01\'\nORDER BY date DESC\nLIMIT 100;',
  '/project/notes/meeting.md': '# Meeting Notes\n\n## Q4 Earnings Call\n\n- Revenue beat by 5%\n- GLP-1 guidance raised\n- Pipeline update positive',
}

function buildMockTree(basePath: string): FileTreeNode[] {
  const dirs = new Map<string, FileTreeNode>()
  const root: FileTreeNode[] = []

  for (const fullPath of Object.keys(mockFiles)) {
    if (!fullPath.startsWith(basePath)) continue
    const rel = fullPath.slice(basePath.length + 1)
    const parts = rel.split('/')
    let parent = root
    let currentPath = basePath

    for (let i = 0; i < parts.length; i++) {
      currentPath += `/${parts[i]}`
      if (i < parts.length - 1) {
        if (!dirs.has(currentPath)) {
          const dirNode: FileTreeNode = {
            id: currentPath,
            name: parts[i],
            isDirectory: true,
            extension: null,
            children: [],
          }
          dirs.set(currentPath, dirNode)
          parent.push(dirNode)
        }
        parent = dirs.get(currentPath)!.children!
      } else {
        const ext = parts[i].split('.').pop() ?? null
        parent.push({
          id: fullPath,
          name: parts[i],
          isDirectory: false,
          extension: ext,
          pinned: parts[i] === 'agentii.md',
        })
      }
    }
  }

  return sortNodes(root)
}

function sortNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1
    if (!a.pinned && b.pinned) return 1
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
}

export function useFileSystem() {
  const readDirectory = useCallback(async (path: string): Promise<FileTreeNode[]> => {
    if (isTauri) return tauriReadDir(path)
    return buildMockTree(path.replace(/\/$/, '') || '/project')
  }, [])

  const readFile = useCallback(async (path: string): Promise<{ content: string; isBinary: boolean }> => {
    if (isTauri) return tauriReadFile(path)
    const content = mockFiles[path]
    if (content !== undefined) return { content, isBinary: false }
    throw new Error(`File not found: ${path}`)
  }, [])

  const writeFile = useCallback(async (path: string, content: string): Promise<void> => {
    if (isTauri) return tauriWriteFile(path, content)
    mockFiles[path] = content
  }, [])

  const openProjectDialog = useCallback(async (): Promise<string | null> => {
    if (isTauri) {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const result = await open({ directory: true })
      return result as string | null
    }
    return '/project'
  }, [])

  return { readDirectory, readFile, writeFile, openProjectDialog, isTauri }
}
