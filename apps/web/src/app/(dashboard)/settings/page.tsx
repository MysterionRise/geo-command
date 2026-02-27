import { Card, CardContent, CardHeader, CardTitle } from '@geo-command/ui/components/card'
import { Input } from '@geo-command/ui/components/input'
import { Label } from '@geo-command/ui/components/label'
import { Button } from '@geo-command/ui/components/button'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Organisation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organisation Name</Label>
            <Input id="name" placeholder="My Organisation" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" placeholder="my-org" />
          </div>
          <Button>Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  )
}
