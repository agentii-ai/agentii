/**
 * Cloud sync service — syncs local SQLite data to Supabase when user logs in.
 * Desktop-only: web mode always uses Supabase directly.
 */

import { supabase } from '@/lib/supabase'
import { getLocalDB } from '@/lib/local-db'
import type { Project } from '@/types/project'

export async function syncProjectsToCloud(userId: string): Promise<{ synced: number; errors: number }> {
  const db = await getLocalDB()
  if (!db.isAvailable()) return { synced: 0, errors: 0 }

  let synced = 0
  let errors = 0

  // Get local projects
  const localProjects = await db.query<Project>('SELECT * FROM projects WHERE owner_id = ?', [userId])

  for (const project of localProjects) {
    try {
      // Upsert to Supabase
      const { error } = await supabase.from('projects').upsert(
        {
          id: project.id,
          owner_id: project.owner_id,
          name: project.name,
          ticker_symbols: project.ticker_symbols,
          project_type: project.project_type,
          description: project.description,
          is_featured: project.is_featured,
          is_template: project.is_template,
          created_at: project.created_at,
          updated_at: project.updated_at,
          archived_at: project.archived_at,
          metadata: project.metadata,
        },
        { onConflict: 'id' },
      )
      if (error) {
        errors++
      } else {
        synced++
      }
    } catch {
      errors++
    }
  }

  return { synced, errors }
}

export async function syncProjectsFromCloud(userId: string): Promise<{ synced: number }> {
  const db = await getLocalDB()
  if (!db.isAvailable()) return { synced: 0 }

  const { data: cloudProjects } = await supabase
    .from('projects')
    .select('*')
    .eq('owner_id', userId)

  let synced = 0
  for (const project of cloudProjects ?? []) {
    try {
      await db.execute(
        `INSERT OR REPLACE INTO projects (id, owner_id, name, ticker_symbols, project_type, description, is_featured, is_template, created_at, updated_at, archived_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          project.id, project.owner_id, project.name,
          JSON.stringify(project.ticker_symbols), project.project_type,
          project.description, project.is_featured ? 1 : 0,
          project.is_template ? 1 : 0, project.created_at,
          project.updated_at, project.archived_at,
          JSON.stringify(project.metadata),
        ],
      )
      synced++
    } catch {
      // Skip individual failures
    }
  }

  return { synced }
}
