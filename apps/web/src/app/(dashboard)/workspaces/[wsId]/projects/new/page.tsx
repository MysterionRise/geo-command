'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@geo-command/ui/components/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@geo-command/ui/components/card'
import { CreateProjectSchema, type CreateProject } from '@geo-command/types'
import { api } from '../../../../../../lib/api'
import { StepBasics } from '../../../../../../components/project-wizard/step-basics'
import { StepBrand } from '../../../../../../components/project-wizard/step-brand'
import { StepEngine } from '../../../../../../components/project-wizard/step-engine'
import { StepReview } from '../../../../../../components/project-wizard/step-review'

const STEPS = ['Basics', 'Brand', 'Engine', 'Review'] as const

export default function NewProjectPage() {
  const params = useParams<{ wsId: string }>()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<CreateProject>({
    resolver: zodResolver(CreateProjectSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      brandVoice: '',
      targetAudience: '',
      keywords: [],
      language: 'en',
    },
  })

  async function onSubmit(data: CreateProject) {
    setSubmitting(true)
    try {
      await api(`/api/workspaces/${params.wsId}/projects`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
      router.push(`/workspaces/${params.wsId}/projects`)
    } catch {
      setSubmitting(false)
    }
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1)
  }

  function back() {
    if (step > 0) setStep(step - 1)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Create Project</h1>

      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <div
            key={label}
            className={`flex-1 rounded-full h-2 ${
              i <= step ? 'bg-primary' : 'bg-muted'
            }`}
          />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{STEPS[step]}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            {step === 0 && <StepBasics form={form} />}
            {step === 1 && <StepBrand form={form} />}
            {step === 2 && <StepEngine form={form} />}
            {step === 3 && <StepReview form={form} />}
          </form>
        </CardContent>
        <CardFooter className="justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={back}
            disabled={step === 0}
          >
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Next
            </Button>
          ) : (
            <Button
              type="button"
              disabled={submitting}
              onClick={form.handleSubmit(onSubmit)}
            >
              {submitting ? 'Creating...' : 'Create Project'}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
