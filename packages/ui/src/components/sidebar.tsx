import * as React from 'react'
import {
  LayoutDashboard,
  Activity,
  FileText,
  BarChart3,
  Settings,
  FolderOpen,
  Users,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '../lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './collapsible'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { Button } from './button'
import { Separator } from './separator'

interface NavItem {
  icon: LucideIcon
  label: string
  href: string
}

interface NavGroup {
  title?: string
  items: NavItem[]
}

const mainNavGroups: NavGroup[] = [
  {
    items: [
      { icon: LayoutDashboard, label: 'Overview', href: '/overview' },
      { icon: Activity, label: 'Monitoring', href: '/monitoring' },
      { icon: FileText, label: 'Content', href: '/content' },
      { icon: BarChart3, label: 'Reports', href: '/reports' },
      { icon: Settings, label: 'Settings', href: '/settings' },
    ],
  },
  {
    items: [
      { icon: FolderOpen, label: 'Workspaces', href: '/workspaces' },
      { icon: Users, label: 'Team', href: '/team' },
    ],
  },
]

export interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {
  pathname?: string
  defaultCollapsed?: boolean
  navGroups?: NavGroup[]
}

function Sidebar({
  pathname = '/',
  defaultCollapsed = false,
  navGroups = mainNavGroups,
  className,
  ...props
}: SidebarProps) {
  const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

  return (
    <TooltipProvider delayDuration={0}>
      <Collapsible open={!collapsed} onOpenChange={(open) => setCollapsed(!open)}>
        <div
          className={cn(
            'relative flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300',
            collapsed ? 'w-16' : 'w-60',
            className
          )}
          {...props}
        >
          <div className="flex h-14 items-center justify-between px-3">
            <CollapsibleContent className="overflow-hidden">
              <span className="text-lg font-semibold whitespace-nowrap">
                Geo Command
              </span>
            </CollapsibleContent>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
              >
                {collapsed ? (
                  <ChevronRight className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
                <span className="sr-only">
                  {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                </span>
              </Button>
            </CollapsibleTrigger>
          </div>

          <Separator className="bg-sidebar-border" />

          <nav className="flex-1 space-y-1 overflow-y-auto p-2">
            {navGroups.map((group, groupIndex) => (
              <React.Fragment key={groupIndex}>
                {groupIndex > 0 && (
                  <Separator className="my-2 bg-sidebar-border" />
                )}
                {group.title && !collapsed && (
                  <div className="px-2 py-1.5 text-xs font-semibold text-sidebar-muted-foreground uppercase tracking-wider">
                    {group.title}
                  </div>
                )}
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                  const Icon = item.icon

                  const linkContent = (
                    <a
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-muted hover:text-sidebar-foreground',
                        collapsed && 'justify-center px-2'
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && (
                        <span className="truncate">{item.label}</span>
                      )}
                    </a>
                  )

                  if (collapsed) {
                    return (
                      <Tooltip key={item.href}>
                        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                        <TooltipContent side="right">
                          {item.label}
                        </TooltipContent>
                      </Tooltip>
                    )
                  }

                  return (
                    <React.Fragment key={item.href}>
                      {linkContent}
                    </React.Fragment>
                  )
                })}
              </React.Fragment>
            ))}
          </nav>
        </div>
      </Collapsible>
    </TooltipProvider>
  )
}

export { Sidebar, type NavItem, type NavGroup }
