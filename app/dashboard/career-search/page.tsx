// app/dashboard/career-search/page.tsx
'use client'

import { useState } from 'react'
import { Target, Briefcase, GraduationCap, TrendingUp, ChevronRight, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function CareerSearchPage() {
  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState<any[]>([])

  const analyzeCareers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/career-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'analyze' })
      })
      const data = await res.json()
      setRecommendations(data.recommendations || [])
    } catch (error) {
      console.error('Failed to analyze:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-slate-400 hover:text-white">
              ← Back
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Career Search</h1>
                <p className="text-xs text-cyan-300">Find Your Perfect Path</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Analyze Button */}
        {recommendations.length === 0 && (
          <div className="text-center py-20">
            <div className="w-24 h-24 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Briefcase className="w-12 h-12 text-cyan-400" />
            </div>
            <h2 className="text-3xl font-bold mb-4">Discover Your Career Path</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">
              Let AI analyze your strengths and match you with perfect careers in Kenya's job market.
            </p>
            <button
              onClick={analyzeCareers}
              disabled={loading}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Start Career Analysis →'}
            </button>
          </div>
        )}

        {/* Results */}
        {recommendations.length > 0 && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold">Your Top Career Matches</h2>
            <div className="grid gap-6">
              {recommendations.map((rec, idx) => (
                <div key={idx} className="bg-slate-900/50 backdrop-blur border border-slate-800 rounded-2xl p-6 hover:border-cyan-500/30 transition">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold mb-2">{rec.career}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-3xl font-black text-cyan-400">{rec.matchScore}%</span>
                        <span className="text-sm text-slate-400">match</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        rec.industryDemand === 'very_high' ? 'bg-green-500/20 text-green-300' :
                        rec.industryDemand === 'high' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-yellow-500/20 text-yellow-300'
                      }`}>
                        {rec.industryDemand.replace('_', ' ')} demand
                      </span>
                    </div>
                  </div>

                  <p className="text-slate-300 mb-4">{rec.reasoning}</p>

                  <div className="grid md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="text-sm font-bold text-cyan-300 mb-2">Kenyan Universities</h4>
                      <ul className="space-y-1">
                        {rec.kenyanUniversities?.map((uni: string, i: number) => (
                          <li key={i} className="text-sm text-slate-400 flex items-center gap-2">
                            <ChevronRight className="w-3 h-3 text-cyan-500" />
                            {uni}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-cyan-300 mb-2">TVET Options</h4>
                      <ul className="space-y-1">
                        {rec.tvetOptions?.map((tvet: string, i: number) => (
                          <li key={i} className="text-sm text-slate-400 flex items-center gap-2">
                            <ChevronRight className="w-3 h-3 text-cyan-500" />
                            {tvet}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 rounded-xl p-4 mb-4">
                    <h4 className="text-sm font-bold text-cyan-300 mb-2">🇰🇪 Kenyan Market Reality</h4>
                    <p className="text-sm text-slate-300">{rec.kenyanMarketReality}</p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">AI Risk:</span>
                      <span className={`font-bold ${
                        rec.aiDisruptionRisk === 'very_low' ? 'text-green-400' :
                        rec.aiDisruptionRisk === 'low' ? 'text-blue-400' :
                        rec.aiDisruptionRisk === 'moderate' ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        {rec.aiDisruptionRisk.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Job Security:</span>
                      <span className={`font-bold ${
                        rec.jobSecurity === 'very_high' ? 'text-green-400' :
                        rec.jobSecurity === 'high' ? 'text-blue-400' :
                        'text-yellow-400'
                      }`}>
                        {rec.jobSecurity.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}