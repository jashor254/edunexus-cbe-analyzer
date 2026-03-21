// app/dashboard/page.tsx
export const dynamic = 'force-dynamic'
export const revalidate = 0

import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { 
  ArrowRight,
  Sparkles,
  Brain,
  Target,
  Briefcase,
  FileText,
  BarChart3,
  Users,
  GraduationCap,
  Clock,
  Award,
  ChevronRight,
  Zap,
  BookOpen,
  TrendingUp,
  Heart,
  Shield,
  Compass
} from 'lucide-react'

// Add animations to global CSS instead
const animations = `
@keyframes blob {
  0% { transform: translate(0px, 0px) scale(1); }
  33% { transform: translate(30px, -50px) scale(1.1); }
  66% { transform: translate(-20px, 20px) scale(0.9); }
  100% { transform: translate(0px, 0px) scale(1); }
}
.animate-blob {
  animation: blob 7s infinite;
}
.animation-delay-2000 {
  animation-delay: 2s;
}
`

export default async function DashboardPage() {
  const supabase = await createClient()
  
  // Get authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  // Get profile data
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user?.id)
    .single()

  // Get token balance
  const { data: tokens } = await supabase
    .from('user_tokens')
    .select('balance')
    .eq('user_id', user?.id)
    .single()

  // Get active subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('sub_status, plan_type')
    .eq('user_id', user?.id)
    .eq('sub_status', 'active')
    .single()

  // Get students count
  const { count: studentsCount } = await supabase
    .from('students')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user?.id)

  // Get assessments count
  const { count: assessmentsCount } = await supabase
    .from('assessments')
    .select('*', { count: 'exact', head: true })

  const hasSubscription = !!subscription
  const tokenBalance = tokens?.balance || 0
  const firstName = profile?.full_name?.split(' ')[0] || 'Mzazi'
  
  // Get current time greeting
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/30">
      
      {/* Background Blobs - Using Tailwind classes only */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900">
              {greeting}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">{firstName}</span>!
            </h1>
            <p className="text-slate-500 mt-1">Your CBC Academic Companion</p>
          </div>
          
          {/* Status Badge */}
          <div className={`px-4 py-2 rounded-2xl flex items-center gap-2 ${
            hasSubscription 
              ? 'bg-green-100 border-2 border-green-300' 
              : tokenBalance > 0
              ? 'bg-blue-100 border-2 border-blue-300'
              : 'bg-amber-100 border-2 border-amber-300'
          }`}>
            {hasSubscription ? (
              <>
                <Sparkles className="w-5 h-5 text-green-600" />
                <span className="font-bold text-green-800">Premium Plan</span>
              </>
            ) : tokenBalance > 0 ? (
              <>
                <Zap className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-blue-800">{tokenBalance} Tokens</span>
              </>
            ) : (
              <Link href="/pricing" className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span className="font-bold text-amber-800 hover:underline">Upgrade Plan</span>
              </Link>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl p-6 border-2 border-slate-100 shadow-sm hover:border-indigo-200 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-indigo-600" />
              </div>
              <span className="text-2xl font-black text-slate-900">{studentsCount || 0}</span>
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Students</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border-2 border-slate-100 shadow-sm hover:border-purple-200 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-purple-600" />
              </div>
              <span className="text-2xl font-black text-slate-900">{assessmentsCount || 0}</span>
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Assessments</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border-2 border-slate-100 shadow-sm hover:border-green-200 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <span className="text-2xl font-black text-slate-900">{studentsCount || 0}</span>
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">Active Students</p>
          </div>

          <div className="bg-white rounded-2xl p-6 border-2 border-slate-100 shadow-sm hover:border-amber-200 transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
              <span className="text-2xl font-black text-slate-900">24/7</span>
            </div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">AI Support</p>
          </div>
        </div>

        {/* Learning Compass Hero */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 rounded-[32px] blur-xl opacity-40 group-hover:opacity-60 transition-all" />
          
          <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-[32px] overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32 blur-2xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full translate-y-24 -translate-x-24 blur-2xl" />
            
            <div className="relative z-10 p-8 lg:p-12">
              <div className="grid lg:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-xl border border-white/30">
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span className="text-sm font-black text-white uppercase tracking-wider">NEW</span>
                  </div>
                  
                  <div>
                    <h2 className="text-4xl lg:text-5xl font-black text-white mb-4">
                      Learning <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-300 to-amber-300">Compass</span>
                    </h2>
                    <p className="text-lg text-indigo-100 leading-relaxed max-w-lg">
                      Your personal AI tutor that adapts to each child's unique learning style and pace.
                    </p>
                  </div>
                  
                  <div className="flex flex-wrap gap-4">
                    <Link 
                      href="/chat"
                      className="group inline-flex items-center gap-3 bg-white text-indigo-600 px-8 py-4 rounded-xl font-black text-lg hover:scale-105 transition-all shadow-2xl"
                    >
                      Start Learning
                      <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                    <Link 
                      href="/dashboard/learning-compass"
                      className="inline-flex items-center gap-2 px-8 py-4 bg-white/20 text-white rounded-xl font-bold hover:bg-white/30 transition-all backdrop-blur-xl"
                    >
                      <Compass className="w-5 h-5" />
                      Learn More
                    </Link>
                  </div>
                </div>

                {/* Preview Card */}
                <div className="hidden lg:block">
                  <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 border border-white/20">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <Brain className="w-5 h-5 text-white" />
                      </div>
                      <div className="text-white font-bold">Today's Lesson</div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white/20 rounded-xl p-3 text-white text-sm">
                        Let's learn fractions! If you have 3/4 of a pizza...
                      </div>
                      <div className="bg-indigo-500/30 rounded-xl p-3 text-white text-sm ml-6">
                        Think of it like sharing ugali with friends!
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link 
            href="/dashboard/assessments/add"
            className="group p-5 bg-white rounded-xl border-2 border-slate-100 hover:border-indigo-300 hover:shadow-lg transition-all text-center"
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Zap className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="font-bold text-slate-900">Add Assessment</span>
          </Link>

          <Link 
            href="/dashboard/clinic"
            className="group p-5 bg-white rounded-xl border-2 border-slate-100 hover:border-purple-300 hover:shadow-lg transition-all text-center"
          >
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <span className="font-bold text-slate-900">View Clinic</span>
          </Link>

          <Link 
            href="/dashboard/pathway"
            className="group p-5 bg-white rounded-xl border-2 border-slate-100 hover:border-green-300 hover:shadow-lg transition-all text-center"
          >
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Target className="w-6 h-6 text-green-600" />
            </div>
            <span className="font-bold text-slate-900">Pathway</span>
          </Link>

          <Link 
            href="/dashboard/career-explorer"
            className="group p-5 bg-white rounded-xl border-2 border-slate-100 hover:border-amber-300 hover:shadow-lg transition-all text-center"
          >
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
              <Briefcase className="w-6 h-6 text-amber-600" />
            </div>
            <span className="font-bold text-slate-900">Careers</span>
          </Link>
        </div>

        {/* Tools Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="group bg-white rounded-2xl p-6 border-2 border-slate-100 hover:border-indigo-300 hover:shadow-lg transition-all">
            <Brain className="w-8 h-8 text-indigo-600 mb-4" />
            <h3 className="text-xl font-black mb-2">Academic Clinic</h3>
            <p className="text-slate-500 text-sm mb-4">Deep insights & personalized reports</p>
            <Link href="/dashboard/clinic" className="text-indigo-600 font-bold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              View Reports <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="group bg-white rounded-2xl p-6 border-2 border-slate-100 hover:border-purple-300 hover:shadow-lg transition-all">
            <Target className="w-8 h-8 text-purple-600 mb-4" />
            <h3 className="text-xl font-black mb-2">Pathway Analysis</h3>
            <p className="text-slate-500 text-sm mb-4">Career guidance for Grades 7-9</p>
            <Link href="/dashboard/pathway" className="text-purple-600 font-bold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              Explore <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="group bg-white rounded-2xl p-6 border-2 border-slate-100 hover:border-green-300 hover:shadow-lg transition-all">
            <Briefcase className="w-8 h-8 text-green-600 mb-4" />
            <h3 className="text-xl font-black mb-2">Career Explorer</h3>
            <p className="text-slate-500 text-sm mb-4">Match skills to real careers</p>
            <Link href="/dashboard/career-explorer" className="text-green-600 font-bold inline-flex items-center gap-1 group-hover:gap-2 transition-all">
              Search <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Students Section */}
        <div className="bg-white rounded-3xl p-8 border-2 border-slate-100">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-6 h-6 text-indigo-600" />
              Your Students
            </h2>
            <Link 
              href="/dashboard/students"
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {studentsCount && studentsCount > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Student cards would go here - fetched from DB */}
              <div className="p-4 bg-slate-50 rounded-xl border-2 border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h4 className="font-bold">Sample Student</h4>
                    <p className="text-xs text-slate-500">Grade 8</p>
                  </div>
                </div>
                <Link 
                  href="/dashboard/students/1"
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                >
                  View Profile →
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 mb-4">No students added yet</p>
              <Link
                href="/dashboard/students/add"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
              >
                <Users className="w-4 h-4" />
                Add First Student
              </Link>
            </div>
          )}
        </div>

        {/* Upgrade Banner */}
        {!hasSubscription && tokenBalance === 0 && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-3xl p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-32 translate-x-32" />
            <div className="relative flex flex-col md:flex-row items-center justify-between gap-6">
              <div>
                <h3 className="text-2xl font-black mb-2">Unlock Full Potential</h3>
                <p className="text-amber-100">Get unlimited access to all features</p>
              </div>
              <Link
                href="/pricing"
                className="px-8 py-4 bg-white text-amber-600 rounded-xl font-black hover:scale-105 transition-all shadow-xl"
              >
                View Plans
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}