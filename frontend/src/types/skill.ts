// T016 — Skill types (updated for registry-backed architecture)
// Legacy types retained for backward compatibility; new code uses extension-registry.ts types.

export type SkillSource = 'built-in' | 'bundled' | 'workspace' | 'installed'

export type SkillCategorySlug =
  | 'coding'
  | 'data'
  | 'trading'
  | 'research'
  | 'automation'
  | 'devops'
  | 'writing'
  | 'security'
  | 'other'

export interface SkillDependency {
  name: string
  type: 'bin' | 'env' | 'config'
  met: boolean
}

export interface Skill {
  id: string
  name: string
  description: string
  tools: string[]
  source: SkillSource
  filePath?: string
  repoUrl?: string
  enabled: boolean
  config: Record<string, string>
  dependencies: SkillDependency[]
  body?: string
}

export interface ProjectSkillOverrides {
  [skillId: string]: boolean
}

export interface CatalogSkill {
  id: string
  name: string
  description: string
  author: string
  category: SkillCategorySlug
  repoUrl: string
  version: string
  installCount?: number
  tags: string[]
}

export interface SlashCommand {
  name: string
  description: string
  source: string
  skillId?: string
  action?: () => void
}
