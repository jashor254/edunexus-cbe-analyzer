'use client'

import {
  TrendingUp,
  TrendingDown,
  Shield,
  MapPin,
  GraduationCap,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  DollarSign,
} from 'lucide-react'
import type { CareerData } from '@/lib/academicClinic/careerDatabase'
import type { DynamicCareer } from '@/lib/academicClinic/dynamicCareerGenerator'

// ============================================================
// COLOR MAPS
// ============================================================

const RISK_CONFIG = {
  very_low:  { label: 'Very Low Risk',  color: 'bg-green-100 text-green-700 border-green-200',    icon: '🛡️' },
  low:       { label: 'Low Risk',       color: 'bg-blue-100 text-blue-700 border-blue-200',       icon: '✅' },
  moderate:  { label: 'Moderate Risk',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: '⚠️' },
  high:      { label: 'High Risk',      color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🔴' },
  very_high: { label: 'Very High Risk', color: 'bg-red-100 text-red-700 border-red-200',          icon: '🚨' },
}

const GROWTH_CONFIG = {
  declining: { label: 'Declining',  color: 'text-red-600',    Icon: TrendingDown },
  stable:    { label: 'Stable',     color: 'text-yellow-600', Icon: TrendingUp },
  growing:   { label: 'Growing',    color: 'text-blue-600',   Icon: TrendingUp },
  booming:   { label: 'Booming 🚀', color: 'text-green-600',  Icon: TrendingUp },
}

const DEMAND_CONFIG: Record<string, { label: string; color: string }> = {
  very_high: { label: 'Very High Demand', color: 'bg-green-100 text-green-700' },
  high:      { label: 'High Demand',      color: 'bg-blue-100 text-blue-700' },
  moderate:  { label: 'Moderate Demand',  color: 'bg-amber-100 text-amber-700' },
  low:       { label: 'Low Demand',       color: 'bg-red-100 text-red-700' },
}

const OUTLOOK_CONFIG: Record<string, { color: string; Icon: typeof TrendingUp }> = {
  excellent: { color: 'text-green-600',  Icon: TrendingUp },
  good:      { color: 'text-blue-600',   Icon: TrendingUp },
  emerging:  { color: 'text-purple-600', Icon: TrendingUp },
  stable:    { color: 'text-yellow-600', Icon: TrendingUp },
  moderate:  { color: 'text-orange-600', Icon: TrendingDown },
}

const PATHWAY_CONFIG = {
  'STEM':            { color: 'bg-blue-600',   text: 'text-blue-600',   bg: 'bg-blue-50'   },
  'Arts & Sports':   { color: 'bg-purple-600', text: 'text-purple-600', bg: 'bg-purple-50' },
  'Social Sciences': { color: 'bg-green-600',  text: 'text-green-600',  bg: 'bg-green-50'  },
}

// ============================================================
// PROPS — unified interface for both CareerData and DynamicCareer
// ============================================================

interface CareerCardProps {
  // Static CareerData path
  career?: CareerData
  // Dynamic search/match path
  dynamicCareer?: DynamicCareer
  matchPercentage?: number
  studentGaps?: string[]
  onExplore?: () => void
  curriculumType?: 'cbc' | 'igcse'
  showFullDetails?: boolean
  className?: string
}

// ============================================================
// DYNAMIC CAREER CARD (from search / AI match)
// ============================================================

function DynamicCareerCard({
  career,
  matchPercentage,
  studentGaps = [],
  onExplore,
  curriculumType = 'cbc',
  className = '',
}: {
  career: DynamicCareer
  matchPercentage?: number
  studentGaps?: string[]
  onExplore?: () => void
  curriculumType?: 'cbc' | 'igcse'
  className?: string
}) {
  const demand = DEMAND_CONFIG[career.demand_in_kenya] ?? DEMAND_CONFIG.moderate
  const risk   = RISK_CONFIG[career.ai_disruption_risk] ?? RISK_CONFIG.moderate
  const outlook = OUTLOOK_CONFIG[career.outlook] ?? OUTLOOK_CONFIG.good
  const OutlookIcon = outlook.Icon

  return (
    <div className={`bg-white rounded-3xl border-2 border-slate-100 overflow-hidden shadow-sm ${className}`}>

      {/* Header */}
      <div className="p-5 border-b-2 border-slate-100">
        <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
          {matchPercentage !== undefined && (
            <span className="text-2xl font-black text-purple-600">{matchPercentage}%</span>
          )}
          {career.is_ai_generated && (
            <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full text-xs font-bold">
              ✨ AI Research
            </span>
          )}
          {curriculumType === 'igcse' && (
            <span className="px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full text-xs font-bold">
              🌍 IGCSE
            </span>
          )}
        </div>

        <h2 className="text-xl font-black text-slate-900 mb-1">{career.name}</h2>

        {matchPercentage !== undefined && (
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full"
              style={{ width: `${matchPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 divide-x-2 divide-slate-100 border-b-2 border-slate-100">
        <div className="p-3 text-center">
          <div className={`text-xs font-black ${outlook.color} mb-1 flex items-center justify-center gap-0.5`}>
            <OutlookIcon className="w-3.5 h-3.5" />
          </div>
          <div className="text-xs font-bold text-slate-500 capitalize">{career.outlook}</div>
        </div>
        <div className="p-3 text-center">
          <div className={`text-xs font-black mb-1 ${demand.color} px-1.5 py-0.5 rounded-full inline-block`}>
            {career.demand_in_kenya.replace('_', ' ')}
          </div>
          <div className="text-xs font-bold text-slate-500">Kenya demand</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-xs font-black text-slate-700 mb-1">{risk.icon}</div>
          <div className="text-xs font-bold text-slate-500">AI risk: {career.ai_disruption_risk.replace('_', ' ')}</div>
        </div>
      </div>

      <div className="p-5 space-y-3">

        {/* Salary */}
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-sm font-bold text-slate-700">{career.salary_range}</span>
        </div>

        {/* Education */}
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-purple-600 flex-shrink-0" />
          <span className="text-sm text-slate-600">
            {career.education_duration} · {career.universities_in_kenya?.[0] ?? career.education_path}
          </span>
        </div>

        {/* Required subjects */}
        {career.required_subjects_display && career.required_subjects_display.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {career.required_subjects_display.slice(0, 4).map(s => (
              <span
                key={s}
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  studentGaps.includes(s)
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-green-50 text-green-700 border border-green-200'
                }`}
              >
                {studentGaps.includes(s) ? '⚠️ ' : '✅ '}{s}
              </span>
            ))}
          </div>
        )}

        {/* Explore button */}
        {onExplore && (
          <button
            onClick={onExplore}
            className="w-full mt-1 flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl font-black hover:bg-purple-700 transition text-sm"
          >
            Explore Career →
          </button>
        )}
      </div>

      {/* Career path preview */}
      {career.career_path && career.career_path.length > 0 && (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {career.career_path.slice(0, 4).map((step, i) => (
              <div key={i} className="flex items-center gap-1.5 flex-shrink-0">
                <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600 font-semibold whitespace-nowrap">
                  {step}
                </span>
                {i < Math.min(career.career_path!.length - 1, 3) && (
                  <span className="text-slate-300 text-xs">→</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// STATIC CAREER CARD (from careerDatabase CareerData)
// ============================================================

function StaticCareerCard({
  career,
  showFullDetails = true,
  className = '',
}: {
  career: CareerData
  showFullDetails?: boolean
  className?: string
}) {
  const risk    = RISK_CONFIG[career.aiImpact.disruptionRisk]
  const growth  = GROWTH_CONFIG[career.aiImpact.growthOutlook]
  const pathway = PATHWAY_CONFIG[career.pathway as keyof typeof PATHWAY_CONFIG]
  const GrowthIcon = growth.Icon

  return (
    <div className={`bg-white rounded-3xl border-2 border-slate-100 overflow-hidden shadow-sm ${className}`}>

      {/* Header */}
      <div className="p-6 border-b-2 border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {pathway && (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${pathway.bg} ${pathway.text}`}>
                  {career.pathway}
                </span>
              )}
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${risk.color}`}>
                {risk.icon} AI {risk.label}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900">{career.name}</h2>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`flex items-center gap-1 justify-end ${growth.color} font-black`}>
              <GrowthIcon className="w-5 h-5" />
              <span className="text-sm">{growth.label}</span>
            </div>
            <div className={`text-2xl font-black ${growth.color}`}>+{career.aiImpact.growthPercentage}%</div>
            <div className="text-xs text-slate-500 font-semibold">job growth</div>
          </div>
        </div>
      </div>

      {/* Market context */}
      <div className="p-6 border-b-2 border-slate-100 bg-slate-50">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">🇰🇪 Kenyan Market Reality</p>
            <p className="text-sm text-slate-700 leading-relaxed font-semibold">{career.marketReality.kenyanContext}</p>
          </div>
        </div>
      </div>

      {showFullDetails && (
        <>
          {/* AI Timeline */}
          <div className="p-6 border-b-2 border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="font-black text-slate-900">AI Impact Timeline</h3>
            </div>
            <div className="space-y-3">
              {[
                { period: 'Now (1-2 yrs)',  text: career.aiImpact.timeline.shortTerm, color: 'border-blue-400' },
                { period: 'Mid (3-5 yrs)',  text: career.aiImpact.timeline.midTerm,   color: 'border-yellow-400' },
                { period: 'Long (10+ yrs)', text: career.aiImpact.timeline.longTerm,  color: 'border-green-400' },
              ].map(item => (
                <div key={item.period} className={`pl-4 border-l-4 ${item.color}`}>
                  <p className="text-xs font-black text-slate-500 mb-1">{item.period}</p>
                  <p className="text-sm text-slate-700">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Survival strategy */}
          <div className="p-6 border-b-2 border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-green-500" />
              <h3 className="font-black text-slate-900">How to Stay Relevant</h3>
            </div>
            <div className="space-y-2">
              {career.aiImpact.survivalStrategy.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-700">{s}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pros & Challenges */}
          <div className="p-6 border-b-2 border-slate-100">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" /> The Good
                </h3>
                {career.realityCheck.pros.map((pro, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1">
                    <span className="text-green-500 text-xs mt-0.5">✓</span>
                    <p className="text-sm text-slate-700">{pro}</p>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" /> The Challenges
                </h3>
                {career.realityCheck.challenges.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 mb-1">
                    <span className="text-red-500 text-xs mt-0.5">✕</span>
                    <p className="text-sm text-slate-700">{c}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Typical day */}
          <div className="p-6 border-b-2 border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="font-black text-slate-900">A Typical Day</h3>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{career.realityCheck.typicalDay}</p>
          </div>

          {/* Education paths */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-purple-500" />
              <h3 className="font-black text-slate-900">Education Paths in Kenya</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {career.cbeReadiness.universities.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Universities</p>
                  <div className="flex flex-wrap gap-2">
                    {career.cbeReadiness.universities.map((uni, i) => (
                      <span key={i} className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold">{uni}</span>
                    ))}
                  </div>
                </div>
              )}
              {career.cbeReadiness.tvetOptions.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">TVET Options</p>
                  <div className="flex flex-wrap gap-2">
                    {career.cbeReadiness.tvetOptions.map((t, i) => (
                      <span key={i} className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// UNIFIED EXPORT — auto-routes to the right sub-component
// ============================================================

export function CareerCard({
  career,
  dynamicCareer,
  matchPercentage,
  studentGaps,
  onExplore,
  curriculumType = 'cbc',
  showFullDetails = true,
  className = '',
}: CareerCardProps) {
  if (dynamicCareer) {
    return (
      <DynamicCareerCard
        career={dynamicCareer}
        matchPercentage={matchPercentage}
        studentGaps={studentGaps}
        onExplore={onExplore}
        curriculumType={curriculumType}
        className={className}
      />
    )
  }

  if (career) {
    return (
      <StaticCareerCard
        career={career}
        showFullDetails={showFullDetails}
        className={className}
      />
    )
  }

  return null
}

// Compact variant (for lists / grids)
export function CareerCardCompact({
  career,
  onClick,
}: {
  career: CareerData
  onClick?: () => void
}) {
  const risk    = RISK_CONFIG[career.aiImpact.disruptionRisk]
  const growth  = GROWTH_CONFIG[career.aiImpact.growthOutlook]
  const pathway = PATHWAY_CONFIG[career.pathway as keyof typeof PATHWAY_CONFIG]

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border-2 border-slate-100 p-5 hover:border-blue-200 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {pathway && (
              <span className={`text-xs font-black px-2 py-0.5 rounded-full ${pathway.bg} ${pathway.text}`}>
                {career.pathway}
              </span>
            )}
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${risk.color}`}>
              {risk.icon} {risk.label}
            </span>
          </div>
          <h3 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{career.name}</h3>
          <p className="text-xs text-slate-500 mt-1 font-semibold line-clamp-2">{career.marketReality.kenyanContext}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-lg font-black ${growth.color}`}>+{career.aiImpact.growthPercentage}%</div>
        </div>
      </div>
    </button>
  )
}
