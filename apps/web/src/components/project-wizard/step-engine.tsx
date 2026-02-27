'use client'

import { UseFormReturn } from 'react-hook-form'
import { Label } from '@geo-command/ui/components/label'
import { Card, CardContent } from '@geo-command/ui/components/card'
import { Badge } from '@geo-command/ui/components/badge'
import { Skeleton } from '@geo-command/ui/components/skeleton'
import { cn } from '@geo-command/ui/lib/utils'
import { useApi } from '../../lib/swr'
import type { CreateProject, AIEngine } from '@geo-command/types'

interface StepEngineProps {
  form: UseFormReturn<CreateProject>
}

export function StepEngine({ form }: StepEngineProps) {
  const { setValue, watch } = form
  const engineId = watch('engineId')

  const { data: engines, isLoading } = useApi<AIEngine[]>('/api/engines')

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Label>AI Engine</Label>
        <div className="grid gap-3 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <Label>AI Engine</Label>
      <p className="text-sm text-muted-foreground">
        Select the AI engine to use for prompt generation and clustering.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {engines?.map((engine) => (
          <Card
            key={engine.id}
            className={cn(
              'cursor-pointer transition-colors hover:bg-muted/50',
              engineId === engine.id && 'border-primary ring-1 ring-primary'
            )}
            onClick={() => setValue('engineId', engine.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">{engine.label}</span>
                {engine.isDefault && (
                  <Badge variant="secondary">Default</Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {engine.provider} / {engine.model}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
