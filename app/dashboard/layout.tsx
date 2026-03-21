// app/dashboard/layout.tsx

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { GraduationCap, LogOut } from 'lucide-react'

export default async function DashboardLayout({ 
  children 
}: { 
  children: React.ReactNode 
}) {
  const supabase = await createClient()
  
  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-white">
      
      {/* Clean Simple Navigation */}
      <nav className="border-b-2 border-slate-200 bg-white/80 backdrop-blur-xl sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-cyan-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <span className="text-2xl font-black text-slate-900">EduNexus</span>
            </Link>
            
            {/* Nav Links */}
            <div className="flex items-center gap-4 sm:gap-6">
              <Link 
                href="/dashboard/learning-compass" 
                className="text-sm font-bold text-slate-600 hover:text-violet-600 transition-colors"
              >
                Learning Compass
              </Link>
              <Link 
                href="/dashboard/pathway" 
                className="hidden sm:inline text-sm font-bold text-slate-600 hover:text-green-600 transition-colors"
              >
                Pathway
              </Link>
              <Link 
                href="/dashboard/career-explorer" 
                className="hidden sm:inline text-sm font-bold text-slate-600 hover:text-purple-600 transition-colors"
              >
                Careers
              </Link>
              <Link 
                href="/dashboard/clinic" 
                className="hidden md:inline text-sm font-bold text-slate-600 hover:text-cyan-600 transition-colors"
              >
                Clinic
              </Link>
              <Link 
                href="/dashboard/assessments" 
                className="hidden md:inline text-sm font-bold text-slate-600 hover:text-violet-600 transition-colors"
              >
                Assessments
              </Link>
              <Link 
                href="/pricing" 
                className="hidden lg:inline text-sm font-bold text-slate-600 hover:text-amber-600 transition-colors"
              >
                Upgrade
              </Link>
              <form action="/auth/signout" method="post">
                <button 
                  type="submit"
                  className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-red-600 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main>
        {children}
      </main>
    </div>
  )
}