// app/dashboard/career-explorer/page.tsx

export const dynamic = 'force-dynamic'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'
import { Briefcase, ArrowLeft, Sparkles, Search, TrendingUp, DollarSign, GraduationCap } from 'lucide-react'
import Link from 'next/link'

export default async function CareerExplorerPage() {
  const supabase = await createClient()
  
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/login')
  const user = session.user

  // Get students to check if they have assessments
  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const student = students?.[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        
        {/* Back Button */}
        <Link 
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-purple-600 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        {/* Hero Section */}
        <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-rose-600 rounded-3xl p-8 sm:p-12 text-white mb-8 shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30">
                <Briefcase className="w-8 h-8" />
              </div>
              <div>
                <h1 className="text-4xl sm:text-5xl font-black">Career Search</h1>
                <div className="flex items-center gap-2 text-sm text-purple-100 mt-1">
                  <Sparkles className="w-4 h-4" />
                  <span>AI-Powered Career Matching for Grade 10-12</span>
                </div>
              </div>
            </div>
            
            <p className="text-xl text-purple-100 max-w-2xl">
              Discover perfect career matches based on your child's <span className="font-black">actual performance</span>, 
              <span className="font-black"> interests</span>, and <span className="font-black">Kenya's evolving job market</span>.
            </p>
          </div>
        </div>

        {/* Adaptive Learning CTA */}
        <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-6 sm:p-8 text-white mb-8 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5" />
                <h3 className="text-xl font-black">Powered by Adaptive Learning</h3>
              </div>
              <p className="text-indigo-100 leading-relaxed">
                Learning Compass adapts to your child's learning tier and velocity, helping them reach their career goals faster.
              </p>
            </div>
            <Link 
              href="/chat"
              className="inline-flex items-center gap-2 bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all whitespace-nowrap"
            >
              Try Learning Compass
              <ArrowLeft className="w-4 h-4 rotate-180" />
            </Link>
          </div>
        </div>

        {/* Career Search Interface */}
        <div className="bg-white rounded-3xl p-8 border-2 border-purple-200 shadow-lg">
          <div className="flex items-center gap-3 mb-6">
            <Search className="w-6 h-6 text-purple-600" />
            <h2 className="text-2xl font-black text-slate-900">Explore Careers</h2>
          </div>

          {student ? (
            <div className="space-y-6">
              {/* Search/Filter Section */}
              <div className="bg-purple-50 rounded-2xl p-6 border border-purple-200">
                <p className="text-slate-700 leading-relaxed">
                  <span className="font-bold text-purple-900">Career matching coming soon!</span> We're building an intelligent career search that analyzes your child's performance and matches them with careers in Kenya's job market.
                </p>
              </div>

              {/* Sample Careers Preview */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Engineering */}
                <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200 hover:border-purple-300 transition-all">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-slate-900 mb-1">Engineering Fields</h3>
                      <p className="text-sm text-slate-600">STEM Pathway</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-slate-700">KES 70,000 - 280,000/month</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                      <span className="text-slate-700">4-5 years university</span>
                    </div>
                  </div>
                </div>

                {/* Business */}
                <div className="bg-slate-50 rounded-2xl p-6 border-2 border-slate-200 hover:border-purple-300 transition-all">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 bg-pink-100 rounded-xl flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-pink-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-black text-slate-900 mb-1">Business & Commerce</h3>
                      <p className="text-sm text-slate-600">Social Sciences Pathway</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span className="text-slate-700">KES 50,000 - 350,000/month</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                      <span className="text-slate-700">3-4 years degree</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Get Personalized Matches */}
              <div className="bg-gradient-to-br from-purple-100 to-pink-100 rounded-2xl p-6 border-2 border-purple-300 text-center">
                <h3 className="text-xl font-black text-slate-900 mb-3">Want Personalized Career Matches?</h3>
                <p className="text-slate-700 mb-4">
                  Generate an Academic Clinic report to get AI-powered career recommendations based on your child's actual performance.
                </p>
                <Link
                  href="/dashboard/clinic"
                  className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all"
                >
                  Generate Clinic Report
                  <ArrowLeft className="w-4 h-4 rotate-180" />
                </Link>
              </div>
            </div>
          ) : (
            /* No Student */
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-purple-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Briefcase className="w-10 h-10 text-purple-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-3">Add a Student First</h3>
              <p className="text-slate-600 mb-6">
                To explore careers, we need to know about your child's performance.
              </p>
              <Link
                href="/dashboard/assessments/add"
                className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl font-bold hover:scale-105 transition-all"
              >
                Add Student & Assessment
                <ArrowLeft className="w-4 h-4 rotate-180" />
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}