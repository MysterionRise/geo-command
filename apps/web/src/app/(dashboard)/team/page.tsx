'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@geo-command/ui/components/table'
import { Button } from '@geo-command/ui/components/button'
import { Badge } from '@geo-command/ui/components/badge'
import { InviteDialog } from '@geo-command/ui/components/invite-dialog'
import { UserPlus } from 'lucide-react'

export default function TeamPage() {
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Team</h1>
        <Button onClick={() => setInviteOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" />
          Invite Member
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              No team members found
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSubmit={(data) => {
          console.log('Invite:', data)
          setInviteOpen(false)
        }}
      />
    </div>
  )
}
