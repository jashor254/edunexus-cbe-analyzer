// ===========================================
// IMPROVED EMPTY STATE COMPONENTS
// ===========================================

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

// No Students Empty State
export function NoStudentsEmpty({ onAddStudent }: { onAddStudent?: () => void }) {
  return (
    <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-cyan-50 rounded-[50px] p-16 text-center border-4 border-dashed border-purple-200">
      <div className="text-8xl mb-8 animate-bounce">👋</div>
      <h2 className="text-5xl font-black uppercase mb-6 tracking-tight">Welcome to EduNexus!</h2>
      <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto">
        Let's start tracking your child's academic journey. Add your first student to unlock powerful CBC insights.
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
          <h3 className="font-black uppercase text-lg mb-2">Track Progress</h3>
          <p className="text-sm text-slate-600">Record CBC assessments across all terms and years</p>
        </div>

        <div className="bg-white rounded-3xl p-8 border-2 border-blue-200 hover:scale-105 transition-all">
          <div className="text-5xl mb-4">🤖</div>
          <h3 className="font-black uppercase text-lg mb-2">AI Guidance</h3>
          <p className="text-sm text-slate-600">Get personalized learning recommendations</p>
        </div>

        <div className="bg-white rounded-3xl p-8 border-2 border-cyan-200 hover:scale-105 transition-all">
          <div className="text-5xl mb-4">📥</div>
          <h3 className="font-black uppercase text-lg mb-2">Download Reports</h3>
          <p className="text-sm text-slate-600">Generate professional PDF reports instantly</p>
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
        Start recording {studentName}'s CBC assessments to track academic progress and get AI-powered insights.
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
            { icon: '1️⃣', title: 'CBC Ratings (1-4)', desc: 'Standard competency levels' },
            { icon: '💯', title: 'Actual Marks', desc: 'Detailed scores (e.g., 92/100)' },
            { icon: '📚', title: 'Topic Breakdown', desc: 'Performance by strand & topic' },
            { icon: '📝', title: 'Notes & Context', desc: 'Teacher & learner observations' },
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

// Insufficient Tokens Empty State
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
          <div className="text-sm opacity-90">One-time purchase</div>
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
          💡 <span className="font-bold">Tip:</span> Subscriptions give unlimited access for just KES 500/term
        </p>
      </div>
    </div>
  )
}

// No Subscription State
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
          This feature requires an active subscription or tokens
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
          <p className="text-sm opacity-90 mb-6">Unlimited access from KES 500/term</p>
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

// ===========================================
// USAGE EXAMPLES
// ===========================================

/*
// In your dashboard:
{students.length === 0 && (
  <NoStudentsEmpty onAddStudent={() => router.push('/dashboard/students/add')} />
)}

// In history page:
{assessments.length === 0 && (
  <NoAssessmentsEmpty studentId={studentId} studentName={student.name} />
)}

// When checking tokens:
{!hasAccess && <InsufficientTokensState 
  required={5} 
  available={2} 
  onBuyTokens={() => router.push('/pricing')}
  onSubscribe={() => router.push('/pricing')}
/>}
*/