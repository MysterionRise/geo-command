'use client'

import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@geo-command/ui/components/card'
import { Badge } from '@geo-command/ui/components/badge'
import { Button } from '@geo-command/ui/components/button'
import { Skeleton } from '@geo-command/ui/components/skeleton'
import { FileText, Layers, Settings } from 'lucide-react'
import { useApi } from '../../../../../../lib/swr'
import type { Project } from '@geo-command/types'

export default function ProjectDetailPage() {
  const params = useParams<{ wsId: string; projectId: string }>()
  const { data: project, isLoading } = useApi<Project>(
    `/api/workspaces/${params.wsId}/projects/${params.projectId}`
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!project) {
    return <p className="text-muted-foreground">Project not found.</p>
  }

  const navCards = [
    {
      title: 'Prompts',
      description: 'Manage search prompts and keywords',
      icon: FileText,
      href: `/workspaces/${params.wsId}/projects/${params.projectId}/prompts`,
    },
    {
      title: 'Clusters',
      description: 'View prompt clusters and groupings',
      icon: Layers,
      href: `/workspaces/${params.wsId}/projects/${params.projectId}/clusters`,
    },
    {
      title: 'Settings',
      description: 'Configure project settings',
      icon: Settings,
      href: `/workspaces/${params.wsId}/projects/${params.projectId}/settings`,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        {project.description && (
          <p className="mt-1 text-muted-foreground">{project.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge variant="outline">{project.language}</Badge>
          {project.keywords.map((kw) => (
            <Badge key={kw} variant="secondary">
              {kw}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {navCards.map((card) => {
          const Icon = card.icon
          return (
            <a key={card.title} href={card.href}>
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Icon className="h-5 w-5" />
                    {card.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            </a>
          )
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 md:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">Slug</dt>
              <dd className="font-mono text-sm">{project.slug}</dd>
            </div>
            {project.brandVoice && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Brand Voice
                </dt>
                <dd className="text-sm">{project.brandVoice}</dd>
              </div>
            )}
            {project.targetAudience && (
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Target Audience
                </dt>
                <dd className="text-sm">{project.targetAudience}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-muted-foreground">
                Created
              </dt>
              <dd className="text-sm">
                {new Date(project.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
