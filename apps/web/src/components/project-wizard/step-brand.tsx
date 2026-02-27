'use client'

import { useState } from 'react'
import { UseFormReturn } from 'react-hook-form'
import { Input } from '@geo-command/ui/components/input'
import { Label } from '@geo-command/ui/components/label'
import { Badge } from '@geo-command/ui/components/badge'
import { Button } from '@geo-command/ui/components/button'
import { X } from 'lucide-react'
import type { CreateProject } from '@geo-command/types'

interface StepBrandProps {
  form: UseFormReturn<CreateProject>
}

export function StepBrand({ form }: StepBrandProps) {
  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = form

  const keywords = watch('keywords') ?? []
  const [keywordInput, setKeywordInput] = useState('')

  function addKeyword() {
    const trimmed = keywordInput.trim()
    if (trimmed && !keywords.includes(trimmed)) {
      setValue('keywords', [...keywords, trimmed])
      setKeywordInput('')
    }
  }

  function removeKeyword(keyword: string) {
    setValue(
      'keywords',
      keywords.filter((k) => k !== keyword)
    )
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="brandVoice">Brand Voice (optional)</Label>
        <Input
          id="brandVoice"
          placeholder="e.g. Professional, friendly, authoritative"
          {...register('brandVoice')}
        />
        {errors.brandVoice && (
          <p className="text-sm text-destructive">{errors.brandVoice.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="targetAudience">Target Audience (optional)</Label>
        <Input
          id="targetAudience"
          placeholder="e.g. Small business owners, marketing professionals"
          {...register('targetAudience')}
        />
        {errors.targetAudience && (
          <p className="text-sm text-destructive">
            {errors.targetAudience.message}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="keywords">Keywords</Label>
        <div className="flex gap-2">
          <Input
            id="keywords"
            placeholder="Add a keyword and press Enter"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addKeyword()
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addKeyword}>
            Add
          </Button>
        </div>
        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {keywords.map((keyword) => (
              <Badge key={keyword} variant="secondary">
                {keyword}
                <button
                  type="button"
                  onClick={() => removeKeyword(keyword)}
                  className="ml-1 hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
