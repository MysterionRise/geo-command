import * as React from 'react'
import { ChevronsUpDown, Plus, Check } from 'lucide-react'

import { cn } from '../lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { Avatar, AvatarFallback } from './avatar'
import { Button } from './button'

interface Organisation {
  id: string
  name: string
  slug: string
}

export interface OrgSwitcherProps {
  organisations: Organisation[]
  currentOrg: Organisation
  onSwitch: (orgId: string) => void
  onCreate: () => void
}

function OrgSwitcher({
  organisations,
  currentOrg,
  onSwitch,
  onCreate,
}: OrgSwitcherProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 px-2"
        >
          <Avatar className="h-6 w-6 rounded-md">
            <AvatarFallback className="rounded-md bg-primary text-[10px] text-white">
              {getInitials(currentOrg.name)}
            </AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium">
            {currentOrg.name}
          </span>
          <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[240px]" align="start" side="bottom">
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Organisations
        </DropdownMenuLabel>
        {organisations.map((org) => (
          <DropdownMenuItem
            key={org.id}
            onClick={() => onSwitch(org.id)}
            className="gap-2"
          >
            <Avatar className="h-5 w-5 rounded-md">
              <AvatarFallback className="rounded-md bg-primary text-[8px] text-white">
                {getInitials(org.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{org.name}</span>
            {org.id === currentOrg.id && (
              <Check className="ml-auto h-4 w-4 shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Create organisation</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { OrgSwitcher }
