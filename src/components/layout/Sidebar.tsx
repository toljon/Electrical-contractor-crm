'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, ClipboardList,
  FileText, Settings, Wrench, LogOut,
  Building2, Boxes, ChartColumn, Menu, X
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: Building2 },
  { href: '/prefab', label: 'Prefab', icon: Boxes },
  { href: '/insights', label: 'Insights', icon: ChartColumn },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { href: '/reports', label: 'Reports', icon: FileText },
  { href: '/settings', label: 'Settings', icon: Settings },
]

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <div className="bg-red-700 rounded p-1.5">
        <Wrench className="h-4 w-4 text-white" />
      </div>
      <div>
        <span className="font-bold text-white text-lg leading-none">TGG Ops</span>
        <p className="text-[10px] text-gray-500 leading-tight">TG Gallagher · Waltham, MA</p>
      </div>
    </div>
  )
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 p-3 space-y-1">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            pathname.startsWith(href)
              ? 'bg-red-700 text-white'
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </Link>
      ))}
    </nav>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const signOutButton = (
    <button
      onClick={handleSignOut}
      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-white w-full transition-colors"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 bg-gray-900 min-h-screen flex-col shrink-0">
        <div className="p-4 border-b border-gray-800">
          <Logo />
        </div>
        <NavLinks pathname={pathname} />
        <div className="p-3 border-t border-gray-800">{signOutButton}</div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-gray-900 flex items-center justify-between px-4">
        <Logo />
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation menu"
          className="text-gray-300 hover:text-white p-2 -mr-2"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-gray-900 flex flex-col shadow-xl">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between">
              <Logo />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="text-gray-300 hover:text-white p-2 -mr-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <div className="p-3 border-t border-gray-800">{signOutButton}</div>
          </aside>
        </div>
      )}
    </>
  )
}
