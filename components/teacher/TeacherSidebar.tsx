'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, FileText, BarChart3,
  AlertTriangle, ClipboardList, Settings,
  LogOut, Scroll, NotebookPen, Sparkles, ChevronRight, FolderOpen, GraduationCap, BookMarked, Languages, Presentation,
  Building2, CalendarCheck, UserCheck,
} from 'lucide-react'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { Logo } from '@/components/ui/Logo'
import TeacherBottomNav from '@/components/teacher/TeacherBottomNav'

const NAV = [
  { href: '/teacher/dashboard',      icon: LayoutDashboard, label: 'Dashboard'      },
  { href: '/teacher/classes',        icon: BookOpen,        label: 'My Classes'     },
  { href: '/teacher/scheme-of-work', icon: Scroll,          label: 'Scheme of Work' },
  { href: '/teacher/lesson-plans',   icon: NotebookPen,     label: 'Lesson Plans'   },
  { href: '/teacher/documents',      icon: FolderOpen,      label: 'Documents'      },
  { href: '/teacher/booklets',       icon: BookMarked,      label: 'Booklets'       },
  { href: '/teacher/record-of-work', icon: ClipboardList,   label: 'Record of Work' },
  { href: '/teacher/assignments',    icon: FileText,        label: 'Assignments'    },
  { href: '/teacher/slides',         icon: Presentation,    label: 'AI Slides'      },
  { href: '/teacher/kiswahili/insha',icon: Languages,       label: 'Insha Feedback' },
  { href: '/teacher/analytics',      icon: BarChart3,       label: 'Analytics'      },
  { href: '/teacher/alerts',         icon: AlertTriangle,   label: 'Alerts'         },
  { href: '/teacher/reports',        icon: ClipboardList,   label: 'Reports'        },
  { href: '/teacher/academy',        icon: GraduationCap,   label: 'AI Academy'     },
  { href: '/teacher/core-term',      icon: CalendarCheck,   label: 'End of Term'    },
  { href: '/teacher/attendance',     icon: UserCheck,       label: 'Attendance'     },
  { href: '/teacher/settings',       icon: Settings,        label: 'Settings'       },
]

const SCHOOL_OFFICE_NAV = { href: '/teacher/core-office', icon: Building2, label: 'School Office' }

interface Props {
  teacherName: string
  school: string
  subject: string | null
  /** Sprint 10G — School Office only appears for admin-tier school_users members. */
  isAdminTier?: boolean
}

export default function TeacherSidebar({ teacherName, school, subject, isAdminTier }: Props) {
  const pathname = usePathname()
  const initials = teacherName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
  const nav = isAdminTier ? [...NAV, SCHOOL_OFFICE_NAV] : NAV

  function isActive(href: string) {
    if (href === '/teacher/dashboard') return pathname === href
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* ── Desktop Sidebar ───────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 fixed inset-y-0 left-0 z-30 bg-[#0c1929]">

        {/* Top gradient accent line */}
        <div className="h-0.5 bg-gradient-to-r from-teal-500 via-cyan-400 to-blue-500" />

        {/* Logo */}
        <div className="px-5 py-5">
          <Link href="/teacher/dashboard">
            <Logo variant="dark" size="sm" />
          </Link>
        </div>

        {/* Teacher profile card — links to edit profile */}
        <Link href="/teacher/settings" className="mx-3 mb-4 bg-white/5 hover:bg-white/8 border border-white/10 hover:border-teal-500/30 rounded-2xl p-4 transition-all group block">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow-md shadow-teal-900/30 shrink-0">
              <span className="text-white font-black text-sm">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-bold text-sm truncate leading-tight">{teacherName}</div>
              <div className="text-slate-400 text-xs truncate mt-0.5">{school}</div>
            </div>
            <Settings className="w-3.5 h-3.5 text-slate-600 group-hover:text-teal-400 transition-colors shrink-0" />
          </div>
          {subject && (
            <div className="mt-3 flex items-center gap-1.5 text-[11px] text-teal-300 font-semibold bg-teal-500/10 border border-teal-500/20 rounded-lg px-2.5 py-1.5 w-fit">
              <Sparkles className="w-3 h-3" />
              {subject}
            </div>
          )}
        </Link>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group relative ${
                  active
                    ? 'bg-teal-500/15 text-teal-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal-400 rounded-full" />
                )}
                <item.icon className={`w-4.5 h-4.5 shrink-0 transition-colors ${active ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="w-3 h-3 text-teal-400/60" />}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/5">
          <div className="mb-3 mx-1">
            <RoleSwitcher />
          </div>
          <div className="mb-2 mx-3">
            <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Free Plan</div>
            <div className="mt-1.5 w-full bg-white/5 rounded-full h-1.5">
              <div className="h-1.5 bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full w-[20%]" />
            </div>
          </div>
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all w-full mt-1"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile Header ─────────────────────────────────────────────────────── */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-[#0c1929] border-b border-white/10 px-4 py-3 flex items-center justify-between">
        <Link href="/teacher/dashboard">
          <Logo variant="dark" size="sm" />
        </Link>
        <div className="flex items-center gap-2">
          <RoleSwitcher />
          <Link href="/teacher/settings" className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center shadow active:scale-95 transition-transform">
            <span className="text-white font-black text-xs">{initials}</span>
          </Link>
        </div>
      </header>

      <TeacherBottomNav isAdminTier={isAdminTier} />
    </>
  )
}
