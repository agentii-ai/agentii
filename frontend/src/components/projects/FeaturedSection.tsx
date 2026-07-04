import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Copy, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import type { Project } from '@/types/project'

interface FeaturedSectionProps {
  projects: Project[]
}

export function FeaturedSection({ projects }: FeaturedSectionProps) {
  const navigate = useNavigate()
  const [cloning, setCloning] = useState<string | null>(null)

  if (projects.length === 0) return null

  const handleClone = async (sourceId: string) => {
    setCloning(sourceId)
    try {
      const { data, error } = await supabase.rpc('clone_project', { p_source_id: sourceId })
      if (error) throw error
      const newId = data as string
      navigate(`/ide?project=${newId}`)
    } catch (e) {
      console.error('Failed to clone project:', e)
    } finally {
      setCloning(null)
    }
  }

  return (
    <div className="mb-6">
      <h2 className="mb-3 text-sm font-medium text-muted-foreground">Featured Templates</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {projects.map((p) => (
          <Card key={p.id} className="min-w-[260px] max-w-[300px] flex-shrink-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{p.name}</CardTitle>
            </CardHeader>
            <CardContent className="pb-2">
              {p.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
              )}
              {p.ticker_symbols.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {p.ticker_symbols.map((t) => (
                    <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() => handleClone(p.id)}
                disabled={cloning === p.id}
              >
                {cloning === p.id ? (
                  <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> Cloning...</>
                ) : (
                  <><Copy className="mr-1 h-3.5 w-3.5" /> Use Template</>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
