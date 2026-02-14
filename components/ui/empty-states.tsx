// components/ui/empty-states.tsx

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Sparkles, FileText, TrendingUp } from 'lucide-react'

// ===========================================
// EXISTING EMPTY STATES (Keep as is)
// ===========================================

// No Students Empty State
export function NoStudentsEmpty({ onAddStudent }: { onAddStudent?: () => void }) {
  return (
    <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 rounded-[50px] p-16 text-center border-4 border-dashed border-purple-200">
      <div className="text-8xl mb-8 animate-bounce">👋</div>
      <h2 className="text-5xl font-black uppercase mb-6 tracking-tight">Karibu EduNexus! 🇰🇪</h2>
      <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
        Let's start tracking your child's CBC journey. Add your first student to unlock powerful AI insights and career guidance.
      </p>

      <button
        onClick={onAddStudent}
        className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-12 py-6 rounded-full font-black uppercase text-xl hover:scale-105 transition-all shadow-2xl mb-12"
      >
        + Add Your First Student
      </button>

      {/* Quick Tour */}
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
        <div className="bg-white rounded-3xl p-8 border-2 border-purple-200 hover:scale-105 transition-all">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="font-black uppercase text-lg mb-2">CBC Tracking</h3>
          <p className="text-sm text-slate-600">Record competency-based assessments across all learning areas</p>
        </div>

        <div className="bg-white rounded-3xl p-8 border-2 border-blue-200 hover:scale-105 transition-all">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="font-black uppercase text-lg mb-2">Guardian Tutor AI</h3>
          <p className="text-sm text-slate-600">Get Kenyan CBC-specific learning recommendations</p>
        </div>

        <div className="bg-white rounded-3xl p-8 border-2 border-cyan-200 hover:scale-105 transition-all">
          <div className="text-5xl mb-4">💼</div>
          <h3 className="font-black uppercase text-lg mb-2">Career Pathways</h3>
          <p className="text-sm text-slate-600">AI-powered career guidance based on competencies</p>
        </div>
      </div>
    </div>
  )
}

// No Assessments Empty State
export function NoAssessmentsEmpty({ studentId, studentName }: { studentId: string, studentName: string }) {
  const router = useRouter()

  return (
    <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-[50px] p-16 text-center border-4 border-dashed border-orange-200">
      <div className="text-8xl mb-8">📋</div>
      <h2 className="text-5xl font-black uppercase mb-6">No Assessments Yet</h2>
      <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
        Start recording {studentName}'s CBC assessments to track academic progress and unlock AI-powered career insights.
      </p>

      <Link
        href={`/dashboard/assessments/add?student=${studentId}`}
        className="inline-block bg-gradient-to-r from-orange-600 to-yellow-600 text-white px-12 py-6 rounded-full font-black uppercase text-xl hover:scale-105 transition-all shadow-2xl mb-12"
      >
        + Add First Assessment
      </Link>

      {/* What You Can Track */}
      <div className="bg-white rounded-3xl p-8 max-w-3xl mx-auto border-2 border-orange-200">
        <h3 className="font-black uppercase mb-6">What You Can Track:</h3>
        <div className="grid md:grid-cols-2 gap-4 text-left">
          {[
            { icon: '1️⃣', title: 'CBC Competency Levels', desc: 'Standard 1-4 ratings per strand' },
            { icon: '💯', title: 'Detailed Marks', desc: 'Actual scores (e.g., 92/100)' },
            { icon: '📚', title: 'Strand Breakdown', desc: 'Performance by learning area' },
            { icon: '📝', title: 'Notes & Observations', desc: 'Teacher & learner feedback' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 bg-orange-50 p-4 rounded-2xl">
              <div className="text-3xl">{item.icon}</div>
              <div>
                <div className="font-black text-sm">{item.title}</div>
                <div className="text-xs text-slate-600">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===========================================
// NEW: NO CAREER ANALYSIS EMPTY STATE
// ===========================================

export function NoCareerAnalysisEmpty({ 
  studentId, 
  studentName,
  onGenerate 
}: { 
  studentId: string
  studentName: string
  onGenerate: () => void 
}) {
  return (
    <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-[50px] p-16 text-center border-4 border-dashed border-indigo-200">
      <div className="text-8xl mb-8">💼</div>
      <h2 className="text-5xl font-black uppercase mb-6">Career Analysis Awaits</h2>
      <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
        Discover {studentName}'s ideal career pathway based on their CBC competency profile. 
        Our AI analyzes strengths and provides Kenyan-specific career recommendations.
      </p>

      <button
        onClick={onGenerate}
        className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-12 py-6 rounded-full font-black uppercase text-xl hover:scale-105 transition-all shadow-2xl mb-12 inline-flex items-center gap-3"
      >
        <Sparkles className="w-6 h-6" />
        Generate Career Analysis
      </button>

      {/* What You'll Get */}
      <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-12">
        <div className="bg-white rounded-3xl p-8 border-2 border-indigo-200">
          <div className="text-5xl mb-4">🎯</div>
          <h3 className="font-black uppercase text-lg mb-2">Pathway Match</h3>
          <p className="text-sm text-slate-600">STEM, Arts & Sports, or Social Sciences - AI determines the best fit</p>
        </div>

        <div className="bg-white rounded-3xl p-8 border-2 border-purple-200">
          <div className="text-5xl mb-4">🇰🇪</div>
          <h3 className="font-black uppercase text-lg mb-2">Kenyan Careers</h3>
          <p className="text-sm text-slate-600">Real job market data, universities, TVET options, and earning potential</p>
        </div>

        <div className="bg-white rounded-3xl p-8 border-2 border-blue-200">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="font-black uppercase text-lg mb-2">AI Disruption</h3>
          <p className="text-sm text-slate-600">Future-proof career advice with AI impact analysis</p>
        </div>
      </div>
    </div>
  )
}

// ===========================================
// NEW: NO ACADEMIC CLINIC REPORT EMPTY STATE
// ===========================================

export function NoClinicReportEmpty({ 
  studentId, 
  studentName,
  onGenerate 
}: { 
  studentId: string
  studentName: string
  onGenerate: () => void 
}) {
  return (
    <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 rounded-[50px] p-16 text-center border-4 border-dashed border-emerald-200">
      <div className="text-8xl mb-8">📊</div>
      <h2 className="text-5xl font-black uppercase mb-6">Academic Clinic Report</h2>
      <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
        Generate a comprehensive Academic Clinic report for {studentName}. 
        Perfect for parent-teacher meetings and holiday planning!
      </p>

      <button
        onClick={onGenerate}
        className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-12 py-6 rounded-full font-black uppercase text-xl hover:scale-105 transition-all shadow-2xl mb-12 inline-flex items-center gap-3"
      >
        <FileText className="w-6 h-6" />
        Generate Clinic Report
      </button>

      {/* Report Includes */}
      <div className="bg-white rounded-3xl p-8 max-w-3xl mx-auto border-2 border-emerald-200">
        <h3 className="font-black uppercase mb-6">Your Report Includes:</h3>
        <div className="grid md:grid-cols-2 gap-4 text-left">
          {[
            { icon: '🎯', title: 'Pathway Analysis', desc: 'CBC pathway recommendation with confidence score' },
            { icon: '💼', title: 'Top 5 Careers', desc: 'AI-matched careers with Kenyan market data' },
            { icon: '⚠️', title: 'Critical Gaps', desc: 'Urgent interventions needed with costs' },
            { icon: '📅', title: '90-Day Plan', desc: 'Actionable steps with Kenyan resources' },
            { icon: '🇰🇪', title: 'Kenyan Context', desc: 'Universities, TVET, real salary expectations' },
            { icon: '🤖', title: 'AI Impact', desc: 'Future-proof career survival strategies' },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3 bg-emerald-50 p-4 rounded-2xl">
              <div className="text-3xl">{item.icon}</div>
              <div>
                <div className="font-black text-sm">{item.title}</div>
                <div className="text-xs text-slate-600">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-lg text-left">
          <p className="text-xs text-amber-800">
            <span className="font-black">💡 Pro Tip:</span> Generate this report before Academic Clinic Day 
            to have focused, data-driven conversations with teachers!
          </p>
        </div>
      </div>
    </div>
  )
}

// ===========================================
// EXISTING STATES (Keep as is)
// ===========================================

// No Search Results Empty State
export function NoSearchResults({ query, onClear }: { query: string, onClear: () => void }) {
  return (
    <div className="bg-slate-50 rounded-3xl p-12 text-center">
      <div className="text-6xl mb-6">🔍</div>
      <h3 className="text-3xl font-black uppercase mb-4">No Results Found</h3>
      <p className="text-slate-600 mb-8">
        No students match "<span className="font-black">{query}</span>"
      </p>
      <button
        onClick={onClear}
        className="bg-slate-200 text-slate-700 px-8 py-4 rounded-full font-bold hover:bg-slate-300 transition-all"
      >
        Clear Search
      </button>
    </div>
  )
}

// Insufficient Tokens Empty State (UPDATED WITH KENYAN PRICING)
export function InsufficientTokensState({ required, available, onBuyTokens, onSubscribe }: {
  required: number
  available: number
  onBuyTokens: () => void
  onSubscribe: () => void
}) {
  return (
    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-3xl p-12 border-4 border-red-200">
      <div className="text-center mb-8">
        <div className="text-7xl mb-4">⚡</div>
        <h3 className="text-4xl font-black uppercase mb-4">Insufficient Tokens</h3>
        <p className="text-xl text-red-800">
          You need <span className="font-black">{required} tokens</span> but only have{' '}
          <span className="font-black">{available} tokens</span>
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <button
          onClick={onBuyTokens}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white p-8 rounded-3xl font-black uppercase hover:scale-105 transition-all"
        >
          <div className="text-5xl mb-3">💳</div>
          <div className="text-2xl mb-2">Buy More Tokens</div>
          <div className="text-sm opacity-90">Pay as you go</div>
        </button>

        <button
          onClick={onSubscribe}
          className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-8 rounded-3xl font-black uppercase hover:scale-105 transition-all border-4 border-purple-300"
        >
          <div className="text-5xl mb-3">⭐</div>
          <div className="text-2xl mb-2">Subscribe</div>
          <div className="text-sm opacity-90">Unlimited access!</div>
        </button>
      </div>

      <div className="text-center mt-8">
        <p className="text-sm text-slate-600">
          💡 <span className="font-bold">Tip:</span> Subscriptions start at KES 1,000/month - Best value for regular use!
        </p>
      </div>
    </div>
  )
}

// No Subscription State (UPDATED WITH KENYAN PRICING)
export function NoSubscriptionState({ onSubscribe, onBuyTokens }: {
  onSubscribe: () => void
  onBuyTokens: () => void
}) {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl p-12 border-4 border-purple-200">
      <div className="text-center mb-8">
        <div className="text-7xl mb-4">🔒</div>
        <h3 className="text-4xl font-black uppercase mb-4">Premium Feature</h3>
        <p className="text-xl text-slate-700">
          Unlock AI-powered career guidance and Academic Clinic reports
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <div className="bg-white rounded-3xl p-8 border-2 border-purple-300">
          <div className="text-4xl mb-4">⚡</div>
          <h4 className="font-black uppercase text-xl mb-2">Pay Per Use</h4>
          <p className="text-sm text-slate-600 mb-6">Buy tokens for occasional access</p>
          <button
            onClick={onBuyTokens}
            className="w-full bg-yellow-500 text-white py-4 rounded-full font-black uppercase hover:bg-yellow-600"
          >
            Buy Tokens
          </button>
        </div>

        <div className="bg-gradient-to-br from-purple-600 to-blue-600 text-white rounded-3xl p-8 border-4 border-purple-300 relative overflow-hidden">
          <div className="absolute top-2 right-2 bg-yellow-400 text-black px-3 py-1 rounded-full text-xs font-black uppercase">
            Best Value
          </div>
          <div className="text-4xl mb-4">⭐</div>
          <h4 className="font-black uppercase text-xl mb-2">Subscribe</h4>
          <p className="text-sm opacity-90 mb-6">From KES 1,000/month - Unlimited access</p>
          <button
            onClick={onSubscribe}
            className="w-full bg-white text-purple-600 py-4 rounded-full font-black uppercase hover:bg-slate-100"
          >
            View Plans
          </button>
        </div>
      </div>
    </div>
  )
}