import { Card, CardContent, CardHeader, CardTitle } from '@geo-command/ui/components/card'
import { Button } from '@geo-command/ui/components/button'
import { FolderOpen, Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function WorkspacesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Workspaces</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Workspace
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="flex items-center justify-center border-dashed p-8 text-muted-foreground">
          <div className="text-center">
            <FolderOpen className="mx-auto h-8 w-8 mb-2" />
            <p>No workspaces yet</p>
            <p className="text-sm">Create your first workspace to get started</p>
          </div>
        </Card>
      </div>
    </div>
  )
}
