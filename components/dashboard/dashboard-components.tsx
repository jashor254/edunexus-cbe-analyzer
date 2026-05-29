'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useSimpleSync } from '@/lib/sync/multi-device-sync'
import { analyzePerformance, getTierConfig } from '@/lib/adaptiveLearning'
import { careerEngine } from '@/lib/academicClinic/careerEngine'
import { TrendingUp, Users, BookOpen, Target, AlertCircle, Share2 } from 'lucide-react'

// =====================================
// TYPES
// =====================================
type DashboardData = {
  students: any[]
  performanceInsights: any[]
  careerMatch: any | null
  loading: boolean
}

export default function EnhancedDashboard() {
  const [data, setData] = useState<DashboardData>({
    students: [],
    performanceInsights: [],
    careerMatch: null,
    loading: true
  })

  const syncing = useSimpleSync(5)

  useEffect(() => {
    const loadDashboard = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Fetch Students & Latest Assessments
      const { data: students } = await supabase
        .from('students')
        .select(`*, assessments(*)`)
        .eq('user_id', user.id)

      if (students && students.length > 0) {
        // 2. Run Adaptive Analysis for the first student (as a showcase)
        const firstStudent = students[0]
        const scores: Record<string, number> = {}
        
        // Map scores for analysis
        firstStudent.assessments?.forEach((a: any) => {
          scores[a.subject.toLowerCase()] = a.score
        })

        const performance = analyzePerformance(scores)
        
        // 3. Get Career Intelligence (Layered AI)
        const topCareerName = "Software Engineer" // Fallback or dynamic based on scores
        const careerInfo = await careerEngine.getCareerIntelligence(topCareerName)

        setData({
          students,
          performanceInsights: performance.recommendations,
          careerMatch: careerInfo,
          loading: false
        })
      } else {
        setData(prev => ({ ...prev, loading: false }))
      }
    }

    loadDashboard()
  }, [])

  if (data.loading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 bg-slate-50 min-h-screen">
      
      {/* 1. TOP NAV & SYNC STATUS */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900">EduNexus Dashboard</h1>
          <p className="text-slate-500">Transforming CBC potential into career reality.</p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${syncing ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
          <div className={`w-2 h-2 rounded-full ${syncing ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
          {syncing ? 'Syncing Data...' : 'Devices Synced'}
        </div>
      </div>

      {/* 2. CORE PERFORMANCE INSIGHTS (ADAPTIVE LEARNING) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Urgent Intervention Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-red-500 w-5 h-5" />
            <h2 className="text-lg font-bold">Learning Path Priority</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.performanceInsights.map((insight, idx) => {
              const config = getTierConfig(insight.tier)
              return (
                <div key={idx} className={`p-5 rounded-2xl border ${config.borderClass} ${config.bgClass} shadow-sm transition-all hover:shadow-md`}>
                  <div className="flex justify-between items-start mb-3">
                    <span className="p-2 bg-white rounded-lg shadow-sm">{insight.icon}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${config.badgeClass}`}>
                      {insight.tierLabel}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 capitalize">{insight.subject}</h3>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">{insight.description}</p>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-xs font-semibold">Target: Level {insight.targetLevel}</div>
                    <button className="text-xs font-bold text-blue-600 hover:underline">View Roadmap →</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 3. CAREER COMPASS WIDGET */}
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Target size={80} />
          </div>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="text-blue-600" size={20} />
            Career Compass
          </h2>
          
          {data.careerMatch && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-xl">
                <p className="text-[10px] text-blue-600 font-bold uppercase">Best Match</p>
                <h3 className="text-xl font-bold text-slate-900">{data.careerMatch.name}</h3>
              </div>
              
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Market Demand</span>
                  <span className="font-bold text-green-600">{data.careerMatch.kenyanMarket.sectorGrowth}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">AI Risk</span>
                  <span className="font-bold text-orange-600">{data.careerMatch.aiForecast.automationRisk}%</span>
                </div>
              </div>

              <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-slate-800">
                Full Career Intelligence Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 4. QUICK ACTIONS & SOCIAL PROOF */}
      <div className="flex flex-wrap gap-4">
        <button className="flex items-center gap-2 px-6 py-3 bg-[#25D366] text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-all">
          <Share2 size={18} />
          Share WhatsApp Summary
        </button>
        <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold shadow-sm hover:bg-slate-50">
          <BookOpen size={18} />
          Download Academic Clinic PDF
        </button>
      </div>

    </div>
  )
}