'use client'

import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@geo-command/ui/components/table'
import { Badge } from '@geo-command/ui/components/badge'
import { Button } from '@geo-command/ui/components/button'
import { Input } from '@geo-command/ui/components/input'
import { Label } from '@geo-command/ui/components/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@geo-command/ui/components/dialog'
import { Skeleton } from '@geo-command/ui/components/skeleton'
import { Plus, Upload, Sparkles, Trash2 } from 'lucide-react'
import { useApi } from '../../../../../../../lib/swr'
import { api } from '../../../../../../../lib/api'
import type { Prompt, PromptStatus } from '@geo-command/types'
import Papa from 'papaparse'

const STATUS_COLORS: Record<PromptStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  ACTIVE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  ARCHIVED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

export default function PromptsPage() {
  const params = useParams<{ wsId: string; projectId: string }>()
  const basePath = `/api/workspaces/${params.wsId}/projects/${params.projectId}/prompts`

  const { data: prompts, isLoading, mutate } = useApi<Prompt[]>(basePath)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addOpen, setAddOpen] = useState(false)
  const [addText, setAddText] = useState('')
  const [genOpen, setGenOpen] = useState(false)
  const [genCount, setGenCount] = useState(10)
  const [genContext, setGenContext] = useState('')
  const [generating, setGenerating] = useState(false)
  const [genProgress, setGenProgress] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (!prompts) return
    if (selected.size === prompts.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(prompts.map((p) => p.id)))
    }
  }

  async function addPrompt() {
    if (!addText.trim()) return
    await api(basePath, {
      method: 'POST',
      body: JSON.stringify({ text: addText.trim() }),
    })
    setAddText('')
    setAddOpen(false)
    mutate()
  }

  async function importCsv(file: File) {
    Papa.parse<{ text: string }>(file, {
      header: true,
      complete: async (results) => {
        const texts = results.data
          .filter((row) => row.text?.trim())
          .map((row) => ({ text: row.text.trim() }))
        if (texts.length > 0) {
          await api(`${basePath}/bulk`, {
            method: 'POST',
            body: JSON.stringify({ prompts: texts }),
          })
          mutate()
        }
      },
    })
  }

  async function generateWithAI() {
    setGenerating(true)
    setGenProgress('Starting generation...')
    try {
      await api(`${basePath}/generate`, {
        method: 'POST',
        body: JSON.stringify({ count: genCount, context: genContext || undefined }),
      })
      setGenProgress('Done!')
      mutate()
      setTimeout(() => {
        setGenOpen(false)
        setGenerating(false)
        setGenProgress('')
      }, 1000)
    } catch {
      setGenProgress('Generation failed.')
      setGenerating(false)
    }
  }

  async function bulkChangeStatus(status: PromptStatus) {
    const ids = Array.from(selected)
    await Promise.all(
      ids.map((id) =>
        api(`${basePath}/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        })
      )
    )
    setSelected(new Set())
    mutate()
  }

  async function bulkDelete() {
    const ids = Array.from(selected)
    await Promise.all(
      ids.map((id) => api(`${basePath}/${id}`, { method: 'DELETE' }))
    )
    setSelected(new Set())
    mutate()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Prompts</h1>
        <div className="flex gap-2">
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Sparkles className="mr-2 h-4 w-4" />
                Generate with AI
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate Prompts with AI</DialogTitle>
                <DialogDescription>
                  Use AI to generate search prompts for your project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="genCount">Number of prompts</Label>
                  <Input
                    id="genCount"
                    type="number"
                    min={1}
                    max={100}
                    value={genCount}
                    onChange={(e) => setGenCount(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="genContext">Context (optional)</Label>
                  <Input
                    id="genContext"
                    placeholder="e.g. Focus on local SEO for restaurants"
                    value={genContext}
                    onChange={(e) => setGenContext(e.target.value)}
                  />
                </div>
                {genProgress && (
                  <p className="text-sm text-muted-foreground">{genProgress}</p>
                )}
              </div>
              <DialogFooter>
                <Button
                  onClick={generateWithAI}
                  disabled={generating}
                >
                  {generating ? 'Generating...' : 'Generate'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) importCsv(file)
              e.target.value = ''
            }}
          />

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Prompt
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Prompt</DialogTitle>
                <DialogDescription>
                  Enter a search prompt to add to this project.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2">
                <Label htmlFor="promptText">Prompt Text</Label>
                <Input
                  id="promptText"
                  placeholder="Enter your search prompt..."
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addPrompt()
                  }}
                />
              </div>
              <DialogFooter>
                <Button onClick={addPrompt}>Add</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3">
          <span className="text-sm font-medium">
            {selected.size} selected
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkChangeStatus('ACTIVE')}
          >
            Set Active
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => bulkChangeStatus('ARCHIVED')}
          >
            Archive
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={bulkDelete}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Delete
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      )}

      {!isLoading && prompts && (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input
                    type="checkbox"
                    checked={
                      prompts.length > 0 && selected.size === prompts.length
                    }
                    onChange={toggleAll}
                    className="rounded"
                  />
                </TableHead>
                <TableHead>Text</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-36">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prompts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No prompts yet. Add one manually, import a CSV, or generate with AI.
                  </TableCell>
                </TableRow>
              )}
              {prompts.map((prompt) => (
                <TableRow key={prompt.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selected.has(prompt.id)}
                      onChange={() => toggleSelect(prompt.id)}
                      className="rounded"
                    />
                  </TableCell>
                  <TableCell className="max-w-md truncate">
                    {prompt.text}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={STATUS_COLORS[prompt.status as PromptStatus]}
                    >
                      {prompt.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(prompt.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
