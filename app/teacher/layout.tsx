import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  BarChart3,
  AlertTriangle,
  ClipboardList,
  Settings,
  GraduationCap,
  LogOut,
} from 'lucide-react'

const NAV = [
  { href: '/teacher/dashboard',    icon: LayoutDashboard, label: 'Dashboard'   },
  { href: '/teacher/classes',      icon: BookOpen,        label: 'My Classes'  },
  { href: '/teacher/assignments',  icon: FileText,        label: 'Assignments' },
  { href: '/teacher/insights',     icon: BarChart3,       label: 'Insights'    },
  { href: '/teacher/alerts',       icon: AlertTriangle,   label: 'Alerts'      },
  { href: '/teacher/reports',      icon: ClipboardList,   label: 'Reports'     },
  { href: '/teacher/settings',     icon: Settings,        label: 'Settings'    },
]

const MOBILE_NAV = [
  { href: '/teacher/dashboard',   icon: LayoutDashboard, label: 'Dashboard'   },
  { href: '/teacher/classes',     icon: BookOpen,        label: 'Classes'     },
  { href: '/teacher/assignments', icon: FileText,        label: 'Assignments' },
  { href: '/teacher/insights',    icon: BarChart3,       label: 'Insights'    },
]

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('full_name, school, subject')
    .eq('user_id', user.id)
    .single()

  if (!teacher) redirect('/teacher/setup')

  const firstName = teacher.full_name?.split(' ')[0] || 'Mwalimu'

  return (
    <div className="flex min-h-screen bg-gray-50">

      {/* ── Sidebar (desktop) ──────────────────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-200 fixed inset-y-0 left-0 z-30">

        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100">
          <Link href="/teacher/dashboard" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center shadow">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-black text-gray-900 text-sm leading-tight">EduNexus</div>
              <div className="text-xs text-teal-600 font-bold">Teacher Portal</div>
            </div>
          </Link>
        </div>

        {/* Teacher info */}
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-teal-100 to-blue-100 rounded-full flex items-center justify-center">
              <span className="text-teal-700 font-black text-sm">
                {firstName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-gray-900 text-sm truncate">{teacher.full_name}</div>
              <div className="text-xs text-gray-500 truncate">{teacher.school}</div>
            </div>
          </div>
          <div className="mt-3 inline-flex items-center gap-1.5 text-xs bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1 rounded-full font-bold">
            <GraduationCap className="w-3 h-3" />
            Teacher Account — Free
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-teal-700 transition-all group"
            >
              <item.icon className="w-5 h-5 text-gray-400 group-hover:text-teal-600 transition-colors" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-4 py-4 border-t border-gray-100">
          <form action="/auth/signout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:bg-red-50 hover:text-red-600 transition-all w-full"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Main content ───────────────────────────────────────────────────────── */}
      <div className="flex-1 lg:ml-64 flex flex-col min-h-screen">

        {/* Mobile header */}
        <header className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <Link href="/teacher/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-teal-500 to-blue-600 rounded-xl flex items-center justify-center">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="font-black text-gray-900 text-sm">EduNexus Teacher</span>
          </Link>
          <div className="text-xs text-gray-500 font-medium">{teacher.school}</div>
        </header>

        {/* Page content */}
        <main className="flex-1 pb-24 lg:pb-0">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20">
          <div className="flex">
            {MOBILE_NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex-1 flex flex-col items-center gap-1 py-3 text-gray-500 hover:text-teal-600 transition-colors"
              >
                <item.icon className="w-5 h-5" />
                <span className="text-xs font-semibold">{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
