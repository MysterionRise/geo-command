'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@geo-command/ui/components/card'
import { Badge } from '@geo-command/ui/components/badge'
import { Button } from '@geo-command/ui/components/button'
import { Skeleton } from '@geo-command/ui/components/skeleton'
import { RefreshCw, ChevronDown, ChevronUp, Layers } from 'lucide-react'
import { useApi } from '../../../../../../../lib/swr'
import { api } from '../../../../../../../lib/api'

interface Cluster {
  id: string
  label: string
  projectId: string
  prompts: { id: string; text: string }[]
  createdAt: string
}

export default function ClustersPage() {
  const params = useParams<{ wsId: string; projectId: string }>()
  const basePath = `/api/workspaces/${params.wsId}/projects/${params.projectId}/clusters`

  const { data: clusters, isLoading, mutate } = useApi<Cluster[]>(basePath)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [reclustering, setReclustering] = useState(false)

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function recluster() {
    setReclustering(true)
    try {
      await api(
        `/api/workspaces/${params.wsId}/projects/${params.projectId}/cluster`,
        { method: 'POST' }
      )
      mutate()
    } finally {
      setReclustering(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clusters</h1>
        <Button
          variant="outline"
          onClick={recluster}
          disabled={reclustering}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${reclustering ? 'animate-spin' : ''}`}
          />
          {reclustering ? 'Re-clustering...' : 'Re-cluster'}
        </Button>
      </div>

      {isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!clusters || clusters.length === 0) && (
        <Card className="flex items-center justify-center border-dashed p-8 text-muted-foreground">
          <div className="text-center">
            <Layers className="mx-auto h-8 w-8 mb-2" />
            <p>No clusters yet</p>
            <p className="text-sm">
              Add prompts to your project and run clustering to group them.
            </p>
          </div>
        </Card>
      )}

      {clusters && clusters.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {clusters.map((cluster) => (
            <Card key={cluster.id}>
              <CardHeader
                className="cursor-pointer"
                onClick={() => toggleExpand(cluster.id)}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{cluster.label}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {cluster.prompts.length} prompts
                    </Badge>
                    {expanded.has(cluster.id) ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>
              {expanded.has(cluster.id) && (
                <CardContent>
                  <ul className="space-y-1.5">
                    {cluster.prompts.map((prompt) => (
                      <li
                        key={prompt.id}
                        className="rounded-md bg-muted/50 px-3 py-2 text-sm"
                      >
                        {prompt.text}
                      </li>
                    ))}
                    {cluster.prompts.length === 0 && (
                      <li className="text-sm text-muted-foreground">
                        No prompts in this cluster.
                      </li>
                    )}
                  </ul>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
