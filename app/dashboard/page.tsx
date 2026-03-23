// app/dashboard/page.tsx
export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Compass,
  Sparkles,
  Users,
  BookOpen,
  Target,
  GraduationCap,
  Zap,
  Heart,
  Clock,
  Crown,
  TrendingUp,
  ChevronRight,
  PlusCircle,
  FileText,
  BarChart3,
  ArrowRight
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ✅ Run all queries in parallel — much faster than sequential
  const [
    { data: profile },
    { data: tokens },
    { data: subscription },
    { data: students, count: studentsCount },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),

    // ✅ Fixed: user_tokens → token_balances
    supabase.from('token_balances').select('balance').eq('user_id', user.id).single(),

    // ✅ Fixed: sub_status → status, plan_type → plan, end_date → expires_at
    supabase
      .from('subscriptions')
      .select('plan, expires_at')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString()) // only truly active
      .order('expires_at', { ascending: false })
      .limit(1)
      .single(),

    supabase
      .from('students')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const firstName      = profile?.full_name?.split(' ')[0] || 'Parent'
  const tokenBalance   = tokens?.balance || 0
  const hasSubscription = !!subscription
  const planType       = subscription?.plan || (tokenBalance > 0 ? 'Token' : 'Free')

  // Days left on subscription
  let daysLeft = 0
  if (subscription?.expires_at) {
    const end = new Date(subscription.expires_at)
    daysLeft  = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  }

  return (
    <div className="min-h-screen bg-slate-950 relative overflow-hidden">

      {/* Ambient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-[1000px] h-[1000px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute -bottom-1/2 -right-1/2 w-[1000px] h-[1000px] bg-blue-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '10s', animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 w-[800px] h-[800px] bg-amber-600/5 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '12s', animationDelay: '4s' }} />
      </div>

      {/* Grain */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none"
        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 400 400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' /%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' /%3E%3C/svg%3E")' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8">

        {/* Welcome */}
        <div className="mb-8 animate-in fade-in slide-in-from-top duration-700">
          <h1 className="text-4xl font-black text-white mb-2">
            Welcome back, {firstName}! 👋
          </h1>
          <p className="text-white/50 text-lg">Your learning command center</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

          {/* Plan */}
          <div className="group relative animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '100ms' }}>
            <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition" />
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {hasSubscription
                    ? <Crown className="w-5 h-5 text-amber-400" />
                    : <Zap className="w-5 h-5 text-blue-400" />
                  }
                  <span className="text-xs font-black text-white/40 uppercase tracking-wider">Plan</span>
                </div>
                {hasSubscription && daysLeft <= 7 && daysLeft > 0 && (
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full font-bold">
                    {daysLeft}d left
                  </span>
                )}
              </div>
              <div className="text-2xl font-black text-white mb-1">
                {hasSubscription ? (
                  <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent capitalize">
                    ✨ {planType}
                  </span>
                ) : planType === 'Token' ? 'Pay-as-Go' : 'Free Trial'}
              </div>
              {!hasSubscription && tokenBalance > 0 && (
                <div className="text-sm text-white/60">{tokenBalance} tokens</div>
              )}
              {!hasSubscription && tokenBalance === 0 && (
                <Link href="/pricing" className="text-xs text-purple-400 hover:text-purple-300 inline-flex items-center gap-1 mt-1 font-bold">
                  Upgrade <ArrowRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>

          {/* Students */}
          <div className="group relative animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '200ms' }}>
            <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition" />
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all">
              <Users className="w-5 h-5 text-blue-400 mb-3" />
              <div className="text-2xl font-black text-white mb-1">{studentsCount || 0}</div>
              <div className="text-sm text-white/60">Students</div>
              {!studentsCount && (
                <Link href="/dashboard/students/add" className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mt-1 font-bold">
                  <PlusCircle className="w-3 h-3" /> Add student
                </Link>
              )}
            </div>
          </div>

          {/* Assessments */}
          <div className="group relative animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '300ms' }}>
            <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition" />
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all">
              <BookOpen className="w-5 h-5 text-green-400 mb-3" />
              <div className="text-2xl font-black text-white mb-1">—</div>
              <div className="text-sm text-white/60">Assessments</div>
              <Link href="/dashboard/assessments/add" className="text-xs text-green-400 hover:text-green-300 inline-flex items-center gap-1 mt-1 font-bold">
                <PlusCircle className="w-3 h-3" /> Add first
              </Link>
            </div>
          </div>

          {/* Streak */}
          <div className="group relative animate-in fade-in slide-in-from-bottom duration-700" style={{ animationDelay: '400ms' }}>
            <div className="absolute -inset-0.5 bg-gradient-to-r from-rose-500 to-pink-500 rounded-2xl blur opacity-20 group-hover:opacity-40 transition" />
            <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all">
              <Heart className="w-5 h-5 text-rose-400 mb-3" />
              <div className="text-2xl font-black text-white mb-1">3</div>
              <div className="text-sm text-white/60">Day streak</div>
              <div className="text-xs text-rose-400 mt-1 font-bold">🔥 On fire!</div>
            </div>
          </div>
        </div>

        {/* Learning Compass Hero */}
        <div className="mb-12 animate-in fade-in slide-in-from-bottom duration-1000" style={{ animationDelay: '500ms' }}>
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-3xl blur-2xl opacity-30 group-hover:opacity-50 transition duration-700" />
            <div className="relative bg-gradient-to-br from-purple-900/40 via-pink-900/40 to-blue-900/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full -translate-y-48 translate-x-48 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full translate-y-40 -translate-x-40 blur-3xl" />
              <div className="relative p-8 md:p-12">
                <div className="flex flex-col lg:flex-row justify-between items-center gap-8">
                  <div className="flex-1 space-y-5">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-sm font-black text-white">
                      <Sparkles className="w-4 h-4 text-yellow-300" />
                      EXPERT LEARNING GUIDANCE
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black text-white leading-tight">
                      Learning Compass
                    </h2>
                    <p className="text-white/80 text-lg max-w-xl leading-relaxed">
                      Your child's personal learning companion that adapts to their unique style.
                      Available 24/7, completely personalized for Kenyan CBC curriculum.
                    </p>
                    <div className="flex flex-wrap gap-4 pt-2">
                      {[
                        { icon: Zap, label: 'Instant answers', color: 'text-yellow-300' },
                        { icon: Clock, label: '24/7 available', color: 'text-green-300' },
                        { icon: BookOpen, label: 'All CBC subjects', color: 'text-blue-300' },
                      ].map((f, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
                          <f.icon className={`w-4 h-4 ${f.color}`} />
                          <span className="text-sm text-white/90 font-bold">{f.label}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-3 pt-4">
                      <Link
                        href="/chat"
                        className="group/btn px-8 py-4 bg-white text-slate-950 rounded-2xl font-black hover:scale-105 transition-all flex items-center gap-2 shadow-2xl shadow-white/20"
                      >
                        <Compass className="w-5 h-5" />
                        Start Learning Now
                        <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                      </Link>
                      <Link
                        href="/dashboard/learning-compass"
                        className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-2xl font-black hover:bg-white/20 transition-all flex items-center gap-2 border border-white/20"
                      >
                        Learn More <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Chat preview */}
                  <div className="relative w-full lg:w-80">
                    <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-2xl blur opacity-20" />
                    <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
                      <div className="flex items-center gap-3 mb-5 pb-4 border-b border-white/10">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                          <Compass className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <span className="text-sm font-black text-white">Learning Compass</span>
                          <div className="flex items-center gap-1.5">
                            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                            <span className="text-xs text-green-300 font-bold">Online</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-sm text-white border border-white/20">
                          Help me understand fractions 📚
                        </div>
                        <div className="bg-gradient-to-r from-purple-500/30 to-pink-500/30 backdrop-blur-sm rounded-xl p-3 text-sm text-white ml-4 border border-purple-400/30">
                          Sawa! Imagine cutting a chapati into 4 equal pieces...
                        </div>
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 text-sm text-white border border-white/20">
                          Oh now I get it! 3/4 means 3 pieces! 🎉
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { href: '/dashboard/assessments/add', icon: FileText,     title: 'Add Assessment',  desc: 'Record scores',    color: 'from-indigo-500 to-purple-500' },
            { href: '/dashboard/clinic',          icon: BarChart3,    title: 'Academic Clinic', desc: 'Deep insights',    color: 'from-purple-500 to-pink-500'   },
            { href: '/dashboard/pathway',         icon: Target,       title: 'Pathway Analysis',desc: 'Find your path',   color: 'from-green-500 to-emerald-500' },
            { href: '/dashboard/career-explorer', icon: GraduationCap,title: 'Career Explorer', desc: 'Discover careers', color: 'from-amber-500 to-orange-500'  },
          ].map((action, idx) => (
            <Link
              key={idx}
              href={action.href}
              className="group relative animate-in fade-in slide-in-from-bottom duration-700"
              style={{ animationDelay: `${600 + idx * 100}ms` }}
            >
              <div className={`absolute -inset-0.5 bg-gradient-to-r ${action.color} rounded-2xl blur opacity-20 group-hover:opacity-40 transition`} />
              <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 hover:bg-white/10 transition-all h-full">
                <div className={`w-12 h-12 bg-gradient-to-br ${action.color} rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform shadow-lg`}>
                  <action.icon className="w-6 h-6 text-white" />
                </div>
                <div className="font-black text-white text-sm mb-1">{action.title}</div>
                <div className="text-xs text-white/60">{action.desc}</div>
              </div>
            </Link>
          ))}
        </div>

        {/* Students */}
        <div className="relative mb-12 animate-in fade-in slide-in-from-bottom duration-1000" style={{ animationDelay: '1000ms' }}>
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-cyan-600 rounded-3xl blur-xl opacity-10" />
          <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-2xl font-black text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-blue-400" /> Your Students
              </h2>
              <Link href="/dashboard/students" className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1 font-bold">
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {students && students.length > 0 ? (
              <div className="space-y-3">
                {students.map((student) => (
                  <div key={student.id} className="group relative">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-0 group-hover:opacity-20 transition" />
                    <div className="relative flex items-center justify-between p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                          <GraduationCap className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <div className="font-bold text-white">{student.name}</div>
                          <div className="text-sm text-white/60">Grade {student.grade}</div>
                        </div>
                      </div>
                      <Link href={`/dashboard/students/${student.id}`} className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold">
                        View <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="w-8 h-8 text-white/30" />
                </div>
                <p className="text-white/50 mb-4">No students added yet</p>
                <Link href="/dashboard/students/add" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 font-bold">
                  <PlusCircle className="w-4 h-4" /> Add Your First Student
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Coming Soon */}
        <div className="animate-in fade-in slide-in-from-bottom duration-1000" style={{ animationDelay: '1100ms' }}>
          <h2 className="text-2xl font-black text-white mb-6 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-amber-400" /> Coming Soon
          </h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { icon: Users,        title: 'Study Groups',    desc: 'Collaborate with peers, share notes',       color: 'from-violet-500 to-purple-500' },
              { icon: Target,       title: 'Mock Exams',      desc: 'Practice for KJSEA & KCSE',                 color: 'from-rose-500 to-pink-500'     },
              { icon: GraduationCap,title: 'University Guide',desc: 'Course recommendations & requirements',     color: 'from-cyan-500 to-blue-500'     },
            ].map((feature, idx) => (
              <div key={idx} className="group relative">
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${feature.color} rounded-2xl blur opacity-0 group-hover:opacity-20 transition`} />
                <div className="relative bg-white/5 backdrop-blur-xl border-2 border-dashed border-white/10 rounded-2xl p-6 text-center hover:bg-white/10 hover:border-white/20 transition-all">
                  <div className={`w-16 h-16 bg-gradient-to-br ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-xl`}>
                    <feature.icon className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="font-black text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-white/60 mb-4">{feature.desc}</p>
                  <div className="inline-flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20 font-bold">
                    <Clock className="w-3 h-3" /> Coming soon
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}