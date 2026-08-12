'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Settings, LogOut, ChevronRight, Sparkles } from 'lucide-react'
import { RoleSwitcher } from '@/components/layout/RoleSwitcher'
import { Logo } from '@/components/ui/Logo'
import TeacherBottomNav from '@/components/teacher/TeacherBottomNav'
import {
  SCHOOL_OFFICE_NAV_ITEM,
  TEACHER_NAV_GROUPS,
  TEACHER_NAV_GROUP_ORDER,
  itemsInGroup,
  ungroupedItems,
  type TeacherNavItem,
} from '@/lib/config/teacherWorkspaceNav'

interface Props {
  teacherName: string
  school: string
  subject: string | null
  /** Sprint 10G — School Office only appears for admin-tier school_users members. */
  isAdminTier?: boolean
}

function isActive(pathname: string, href: string) {
  if (href === '/teacher/dashboard') return pathname === href
  return pathname.startsWith(href)
}

/** One sidebar row. Hoisted out of TeacherSidebar so it is a stable component identity across renders. */
function NavLink({ item, pathname }: { item: TeacherNavItem; pathname: string }) {
  const active = isActive(pathname, item.href)
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all group relative ${
        active
          ? 'bg-teal-500/15 text-teal-300'
          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-teal-400 rounded-full" />
      )}
      <item.icon className={`w-4.5 h-4.5 shrink-0 transition-colors ${active ? 'text-teal-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
      <span className="flex-1 min-w-0">
        <span className="block truncate">{item.label}</span>
        {item.hint && <span className="block text-[10px] font-normal text-slate-500 truncate">{item.hint}</span>}
      </span>
      {active && <ChevronRight className="w-3 h-3 text-teal-400/60 shrink-0" />}
    </Link>
  )
}

export default function TeacherSidebar({ teacherName, school, subject, isAdminTier }: Props) {
  const pathname = usePathname()
  const initials = teacherName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

  // Phase 1 — the sidebar renders section by section instead of as one flat
  // list of nineteen peers. Grouping metadata lives entirely in
  // lib/config/teacherWorkspaceNav.ts; this component only lays it out, so
  // the sidebar and the bottom nav cannot drift apart again (the PRP-1
  // finding this config was created to fix).
  const [myDay, settings] = ungroupedItems()

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

        {/* Navigation — My Day, then the four sections, then Settings. */}
        <nav className="flex-1 px-3 overflow-y-auto" aria-label="Teacher workspace">
          <div className="space-y-0.5">
            {myDay && <NavLink item={myDay} pathname={pathname} />}
          </div>

          {TEACHER_NAV_GROUP_ORDER.map(group => {
            const items = itemsInGroup(group)
            if (items.length === 0) return null

            // School Office is appended to My School for admin-tier users
            // only — the same gate as before Phase 1, unchanged.
            const withOffice =
              group === 'school' && isAdminTier ? [...items, SCHOOL_OFFICE_NAV_ITEM] : items

            return (
              <section key={group} className="mt-5" aria-labelledby={`nav-group-${group}`}>
                <h2
                  id={`nav-group-${group}`}
                  className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-600"
                >
                  {TEACHER_NAV_GROUPS[group]}
                </h2>
                <div className="space-y-0.5">
                  {withOffice.map(item => <NavLink key={item.href} item={item} pathname={pathname} />)}
                </div>
              </section>
            )
          })}

          <div className="mt-5 space-y-0.5">
            {settings && <NavLink item={settings} pathname={pathname} />}
          </div>
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
