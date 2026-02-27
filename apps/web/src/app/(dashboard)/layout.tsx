'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@geo-command/ui/components/sidebar'
import { OrgSwitcher } from '@geo-command/ui/components/org-switcher'
import { ThemeToggle } from '@geo-command/ui/components/theme-toggle'
import { useTheme } from 'next-themes'

const UserButton = dynamic(
  () => import('@clerk/nextjs').then((mod) => mod.UserButton),
  { ssr: false },
)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  // Placeholder org data - will be replaced with real API calls
  const currentOrg = { id: '1', name: 'My Organisation', slug: 'my-org' }
  const organisations = [currentOrg]

  return (
    <div className="flex h-screen">
      <Sidebar pathname={pathname}>
        <div className="p-3">
          <OrgSwitcher
            organisations={organisations}
            currentOrg={currentOrg}
            onSwitch={(id) => console.log('Switch to org:', id)}
            onCreate={() => console.log('Create org')}
          />
        </div>
      </Sidebar>
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center justify-end gap-3 border-b px-6">
          <ThemeToggle theme={theme ?? 'system'} setTheme={setTheme} />
          <UserButton />
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  )
}
