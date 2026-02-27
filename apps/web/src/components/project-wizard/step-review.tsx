'use client'

import { UseFormReturn } from 'react-hook-form'
import { Badge } from '@geo-command/ui/components/badge'
import type { CreateProject } from '@geo-command/types'

interface StepReviewProps {
  form: UseFormReturn<CreateProject>
}

export function StepReview({ form }: StepReviewProps) {
  const values = form.getValues()

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review your project settings before creating.
      </p>

      <dl className="space-y-3">
        <div>
          <dt className="text-sm font-medium text-muted-foreground">Name</dt>
          <dd className="mt-0.5">{values.name}</dd>
        </div>

        <div>
          <dt className="text-sm font-medium text-muted-foreground">Slug</dt>
          <dd className="mt-0.5 font-mono text-sm">{values.slug}</dd>
        </div>

        {values.description && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Description
            </dt>
            <dd className="mt-0.5">{values.description}</dd>
          </div>
        )}

        {values.brandVoice && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Brand Voice
            </dt>
            <dd className="mt-0.5">{values.brandVoice}</dd>
          </div>
        )}

        {values.targetAudience && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Target Audience
            </dt>
            <dd className="mt-0.5">{values.targetAudience}</dd>
          </div>
        )}

        {values.keywords && values.keywords.length > 0 && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Keywords
            </dt>
            <dd className="mt-1 flex flex-wrap gap-1">
              {values.keywords.map((kw) => (
                <Badge key={kw} variant="secondary">
                  {kw}
                </Badge>
              ))}
            </dd>
          </div>
        )}

        <div>
          <dt className="text-sm font-medium text-muted-foreground">
            Language
          </dt>
          <dd className="mt-0.5">{values.language || 'en'}</dd>
        </div>

        {values.engineId && (
          <div>
            <dt className="text-sm font-medium text-muted-foreground">
              Engine ID
            </dt>
            <dd className="mt-0.5 font-mono text-sm">{values.engineId}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
