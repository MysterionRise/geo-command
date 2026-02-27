'use client'

import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@geo-command/ui/components/card'
import { Button } from '@geo-command/ui/components/button'
import { Badge } from '@geo-command/ui/components/badge'
import { Skeleton } from '@geo-command/ui/components/skeleton'
import { Plus, FolderOpen } from 'lucide-react'
import { useApi } from '../../../../../lib/swr'
import type { Project } from '@geo-command/types'

export default function ProjectsPage() {
  const params = useParams<{ wsId: string }>()
  const { data: projects, isLoading } = useApi<Project[]>(
    `/api/workspaces/${params.wsId}/projects`
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Button asChild>
          <a href={`/workspaces/${params.wsId}/projects/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </a>
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!projects || projects.length === 0) && (
        <Card className="flex items-center justify-center border-dashed p-8 text-muted-foreground">
          <div className="text-center">
            <FolderOpen className="mx-auto h-8 w-8 mb-2" />
            <p>No projects yet</p>
            <p className="text-sm">Create your first project to get started</p>
          </div>
        </Card>
      )}

      {projects && projects.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <a
              key={project.id}
              href={`/workspaces/${params.wsId}/projects/${project.id}`}
            >
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{project.name}</CardTitle>
                    <Badge variant="outline">{project.language}</Badge>
                  </div>
                  <CardDescription className="font-mono text-xs">
                    {project.slug}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {project.description}
                    </p>
                  )}
                  {project.keywords.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {project.keywords.slice(0, 3).map((kw) => (
                        <Badge key={kw} variant="secondary" className="text-xs">
                          {kw}
                        </Badge>
                      ))}
                      {project.keywords.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{project.keywords.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
