import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/providers/AuthProvider'
import { useProjectStore } from '@/stores/projectStore'
import { scaffoldWorkspace } from '@/services/workspace-scaffold'
import type { Project } from '@/types/project'

export function useProjects() {
  const { user } = useAuth()
  const projects = useProjectStore((s) => s.projects)
  const featuredProjects = useProjectStore((s) => s.featuredProjects)
  const searchQuery = useProjectStore((s) => s.searchQuery)
  const setProjects = useProjectStore((s) => s.setProjects)
  const setFeatured = useProjectStore((s) => s.setFeatured)
  const [isLoading, setIsLoading] = useState(false)

  const fetchProjects = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .is('archived_at', null)
        .order('updated_at', { ascending: false })
      if (!error && data) setProjects(data as Project[])
    } finally {
      setIsLoading(false)
    }
  }, [setProjects])

  const fetchFeatured = useCallback(async () => {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('is_featured', true)
    if (!error && data) setFeatured(data as Project[])
  }, [setFeatured])

  const createProject = useCallback(
    async (input: {
      name: string;
      ticker_symbols: string[];
      project_type: Project['project_type'];
      description?: string | null;
      sector?: string | null;
    }) => {
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('projects')
        .insert({
          owner_id: user.id,
          name: input.name,
          ticker_symbols: input.ticker_symbols,
          project_type: input.project_type,
          description: input.description,
          metadata: input.sector ? { sector: input.sector } : {},
        })
        .select()
        .single()
      if (error) throw error
      try {
        await scaffoldWorkspace({
          projectId: data.id,
          ownerId: user.id,
          name: input.name,
          tickerSymbols: input.ticker_symbols,
          projectType: input.project_type,
          description: input.description,
          sector: input.sector || undefined,
        })
      } catch (scaffoldError) {
        // Rollback: delete orphaned project row if scaffold fails
        await supabase.from('projects').delete().eq('id', data.id)
        throw scaffoldError
      }
      await fetchProjects()
      return data as Project
    },
    [user, fetchProjects],
  )

  const updateProject = useCallback(
    async (id: string, updates: Partial<Pick<Project, 'name' | 'ticker_symbols' | 'project_type' | 'description' | 'is_featured' | 'metadata'>>) => {
      const { error } = await supabase.from('projects').update(updates).eq('id', id)
      if (error) throw error
      await fetchProjects()
    },
    [fetchProjects],
  )

  const archiveProject = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('projects')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      await fetchProjects()
    },
    [fetchProjects],
  )

  const deleteProject = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id)
      if (error) throw error
      await fetchProjects()
    },
    [fetchProjects],
  )

  const filteredProjects = searchQuery
    ? projects.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.ticker_symbols.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())),
      )
    : projects

  useEffect(() => {
    if (user) {
      fetchProjects()
      fetchFeatured()
    }
  }, [user, fetchProjects, fetchFeatured])

  return {
    projects: filteredProjects,
    featuredProjects,
    isLoading,
    fetchProjects,
    fetchFeatured,
    createProject,
    updateProject,
    archiveProject,
    deleteProject,
  }
}
