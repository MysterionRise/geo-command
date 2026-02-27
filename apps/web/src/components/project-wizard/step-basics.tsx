'use client'

import { UseFormReturn } from 'react-hook-form'
import { Input } from '@geo-command/ui/components/input'
import { Label } from '@geo-command/ui/components/label'
import type { CreateProject } from '@geo-command/types'

interface StepBasicsProps {
  form: UseFormReturn<CreateProject>
}

export function StepBasics({ form }: StepBasicsProps) {
  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = form

  const name = watch('name')

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Project Name</Label>
        <Input
          id="name"
          placeholder="My SEO Project"
          {...register('name', {
            onChange: (e) => {
              const slug = generateSlug(e.target.value)
              setValue('slug', slug)
            },
          })}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="slug">Slug</Label>
        <Input
          id="slug"
          placeholder="my-seo-project"
          {...register('slug')}
        />
        {errors.slug && (
          <p className="text-sm text-destructive">{errors.slug.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Input
          id="description"
          placeholder="A brief description of your project"
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>
    </div>
  )
}
