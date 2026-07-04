// T021 — Skill parser hook
import { useMemo } from 'react'
import { parseSkillMd } from '@/lib/skill-md-parser'
import type { Skill } from '@/types/skill'

export function useSkillParser(content: string | undefined, source: Skill['source'] = 'workspace') {
  return useMemo(() => {
    if (!content) return null
    const parsed = parseSkillMd(content)
    if (!parsed.name) return null
    const skill: Skill = {
      id: parsed.name.toLowerCase().replace(/\s+/g, '-'),
      name: parsed.name,
      description: parsed.description,
      tools: parsed.tools,
      source,
      enabled: true,
      config: {},
      dependencies: [],
      body: parsed.body,
    }
    return skill
  }, [content, source])
}
