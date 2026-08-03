'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Key, Receipt, ScrollText,
  Settings, ChevronLeft, Building2,
} from 'lucide-react'
import { Logo } from '@/components/ui/Logo'

interface NavItem {
  href: string
  icon: React.ElementType
  label: string
}

interface Props {
  orgId: string
  orgName: string
  orgType: string
  userRole: string
}

export default function OrgSidebar({ orgId, orgName, orgType, userRole }: Props) {
  const pathname = usePathname()

  const base = `/organizations/${orgId}`

  const nav: NavItem[] = [
    { href: `${base}`,           icon: LayoutDashboard, label: 'Overview'   },
    { href: `${base}/members`,   icon: Users,           label: 'Members'    },
    { href: `${base}/api-keys`,  icon: Key,             label: 'API Keys'   },
    { href: `${base}/billing`,   icon: Receipt,         label: 'Billing'    },
    { href: `${base}/audit-log`, icon: ScrollText,      label: 'Audit Log'  },
    { href: `${base}/settings`,  icon: Settings,        label: 'Settings'   },
  ]

  function isActive(href: string) {
    if (href === base) return pathname === href
    return pathname.startsWith(href)
  }

  const typeLabel: Record<string, string> = {
    school: 'School', district: 'District', county: 'County',
    ministry: 'Ministry', publisher: 'Publisher', university: 'University',
    ngo: 'NGO', developer: 'Developer',
  }

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30 bg-nexus-ink">
        <div className="h-0.5 bg-gradient-to-r from-trustblue-600 via-trustblue-400 to-nexusteal-500" />

        <div className="px-5 py-5">
          <Link href="/organizations">
            <Logo variant="dark" size="sm" />
          </Link>
        </div>

        {/* Org badge */}
        <div className="mx-4 mb-4 p-3 rounded-lg bg-white/5 border border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-nexusteal-500/20 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-4 h-4 text-nexusteal-400" />
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-semibold truncate">{orgName}</p>
              <p className="text-white/40 text-xs">{typeLabel[orgType] ?? orgType} · {userRole}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, icon: Icon, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive(href)
                  ? 'bg-nexusteal-500/20 text-nexusteal-300 font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <Link
            href="/organizations"
            className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            All Organizations
          </Link>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-nexus-ink border-t border-white/10 flex">
        {nav.slice(0, 5).map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors ${
              isActive(href) ? 'text-nexusteal-400' : 'text-white/40'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
