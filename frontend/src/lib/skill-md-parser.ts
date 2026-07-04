// T012 — SKILL.md YAML frontmatter parser

interface ParsedSkill {
  name: string
  description: string
  tools: string[]
  body: string
  metadata?: Record<string, unknown>
}

export function parseSkillMd(content: string): ParsedSkill {
  const trimmed = content.trim()
  if (!trimmed.startsWith('---')) {
    return { name: '', description: '', tools: [], body: trimmed }
  }

  const secondDash = trimmed.indexOf('---', 3)
  if (secondDash === -1) {
    return { name: '', description: '', tools: [], body: trimmed }
  }

  const frontmatter = trimmed.slice(3, secondDash).trim()
  const body = trimmed.slice(secondDash + 3).trim()

  const parsed: Record<string, unknown> = {}
  let currentKey = ''
  let inList = false
  const listItems: string[] = []

  for (const line of frontmatter.split('\n')) {
    const trimLine = line.trim()
    if (!trimLine || trimLine.startsWith('#')) continue

    if (trimLine.startsWith('- ') && inList) {
      listItems.push(trimLine.slice(2).trim().replace(/^['"]|['"]$/g, ''))
      continue
    }

    if (inList && currentKey) {
      parsed[currentKey] = [...listItems]
      listItems.length = 0
      inList = false
    }

    const colonIdx = trimLine.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimLine.slice(0, colonIdx).trim()
    const value = trimLine.slice(colonIdx + 1).trim()

    if (!value) {
      currentKey = key
      inList = true
      continue
    }

    parsed[key] = value.replace(/^['"]|['"]$/g, '')
  }

  if (inList && currentKey) {
    parsed[currentKey] = [...listItems]
  }

  const tools = Array.isArray(parsed.tools) ? (parsed.tools as string[]) : []

  return {
    name: String(parsed.name ?? ''),
    description: String(parsed.description ?? ''),
    tools,
    body,
    metadata: parsed,
  }
}
