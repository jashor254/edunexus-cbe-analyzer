'use client'

import { 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  AlertTriangle,
  MapPin,
  GraduationCap,
  Briefcase,
  Zap,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react'
import type { CareerData } from '@/lib/academicClinic/careerDatabase'

// ============================================================
// HELPER: Color maps for enums
// ============================================================

const RISK_CONFIG = {
  very_low:  { label: 'Very Low Risk',  color: 'bg-green-100 text-green-700 border-green-200',  icon: '🛡️' },
  low:       { label: 'Low Risk',       color: 'bg-blue-100 text-blue-700 border-blue-200',     icon: '✅' },
  moderate:  { label: 'Moderate Risk',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: '⚠️' },
  high:      { label: 'High Risk',      color: 'bg-orange-100 text-orange-700 border-orange-200', icon: '🔴' },
  very_high: { label: 'Very High Risk', color: 'bg-red-100 text-red-700 border-red-200',        icon: '🚨' },
}

const GROWTH_CONFIG = {
  declining: { label: 'Declining',  color: 'text-red-600',    icon: TrendingDown },
  stable:    { label: 'Stable',     color: 'text-yellow-600', icon: TrendingUp },
  growing:   { label: 'Growing',    color: 'text-blue-600',   icon: TrendingUp },
  booming:   { label: 'Booming 🚀', color: 'text-green-600',  icon: TrendingUp },
}

const EARNING_CONFIG = {
  lower_but_stable: { label: 'Stable Income',    stars: 2, color: 'text-slate-600' },
  moderate:         { label: 'Good Income',       stars: 3, color: 'text-blue-600' },
  lucrative:        { label: 'Lucrative',         stars: 4, color: 'text-purple-600' },
  very_lucrative:   { label: 'Very Lucrative',    stars: 5, color: 'text-green-600' },
  exceptional:      { label: 'Exceptional 🤑',    stars: 5, color: 'text-yellow-600' },
}

const SECURITY_CONFIG = {
  low:       { label: 'Low Security',       color: 'text-red-500' },
  moderate:  { label: 'Moderate Security',  color: 'text-yellow-600' },
  high:      { label: 'High Security',      color: 'text-blue-600' },
  very_high: { label: 'Very High Security', color: 'text-green-600' },
}

const PATHWAY_CONFIG = {
  'STEM':            { color: 'bg-blue-600',   text: 'text-blue-600',   bg: 'bg-blue-50'   },
  'Arts & Sports':   { color: 'bg-purple-600', text: 'text-purple-600', bg: 'bg-purple-50' },
  'Social Sciences': { color: 'bg-green-600',  text: 'text-green-600',  bg: 'bg-green-50'  },
}

// ============================================================
// PROPS
// ============================================================

interface CareerCardProps {
  career: CareerData
  showFullDetails?: boolean  // false = compact, true = full page view
  className?: string
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function CareerCard({ 
  career, 
  showFullDetails = true,
  className = '' 
}: CareerCardProps) {

  const risk = RISK_CONFIG[career.aiImpact.disruptionRisk]
  const growth = GROWTH_CONFIG[career.aiImpact.growthOutlook]
  const earning = EARNING_CONFIG[career.marketReality.earningPotential]
  const security = SECURITY_CONFIG[career.marketReality.jobSecurity]
  const pathway = PATHWAY_CONFIG[career.pathway]
  const GrowthIcon = growth.icon

  return (
    <div className={`bg-white rounded-3xl border-2 border-slate-100 overflow-hidden shadow-sm ${className}`}>

      {/* ── Header ── */}
      <div className="p-6 border-b-2 border-slate-100">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {/* Pathway badge */}
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${pathway.bg} ${pathway.text}`}>
                {career.pathway}
              </span>

              {/* AI Risk badge */}
              <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold border ${risk.color}`}>
                {risk.icon} AI {risk.label}
              </span>
            </div>

            <h2 className="text-2xl font-black text-slate-900 mb-1">
              {career.name}
            </h2>
          </div>

          {/* Growth indicator */}
          <div className="text-right flex-shrink-0">
            <div className={`flex items-center gap-1 justify-end ${growth.color} font-black`}>
              <GrowthIcon className="w-5 h-5" />
              <span className="text-sm">{growth.label}</span>
            </div>
            <div className={`text-2xl font-black ${growth.color}`}>
              +{career.aiImpact.growthPercentage}%
            </div>
            <div className="text-xs text-slate-500 font-semibold">job growth</div>
          </div>
        </div>
      </div>

      {/* ── Quick Stats Row ── */}
      <div className="grid grid-cols-3 divide-x-2 divide-slate-100 border-b-2 border-slate-100">
        <div className="p-4 text-center">
          <div className={`text-sm font-black ${earning.color} mb-1`}>
            {'💰'.repeat(Math.min(earning.stars, 3))}
          </div>
          <div className="text-xs font-bold text-slate-500">{earning.label}</div>
        </div>
        <div className="p-4 text-center">
          <div className={`text-sm font-black ${security.color} mb-1`}>
            <Shield className="w-5 h-5 mx-auto" />
          </div>
          <div className="text-xs font-bold text-slate-500">{security.label}</div>
        </div>
        <div className="p-4 text-center">
          <div className="text-sm font-black text-slate-700 mb-1">
            {career.aiImpact.disruptionPercentage}%
          </div>
          <div className="text-xs font-bold text-slate-500">AI disruption</div>
        </div>
      </div>

      {/* ── Kenyan Context ── */}
      <div className="p-6 border-b-2 border-slate-100 bg-slate-50">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-1">
              🇰🇪 Kenyan Market Reality
            </p>
            <p className="text-sm text-slate-700 leading-relaxed font-semibold">
              {career.marketReality.kenyanContext}
            </p>
          </div>
        </div>
      </div>

      {/* ── Full Details (only if showFullDetails = true) ── */}
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
                { period: 'Now (1-2 yrs)', text: career.aiImpact.timeline.shortTerm, color: 'border-blue-400' },
                { period: 'Mid (3-5 yrs)', text: career.aiImpact.timeline.midTerm, color: 'border-yellow-400' },
                { period: 'Long (10+ yrs)', text: career.aiImpact.timeline.longTerm, color: 'border-green-400' },
              ].map((item) => (
                <div key={item.period} className={`pl-4 border-l-4 ${item.color}`}>
                  <p className="text-xs font-black text-slate-500 mb-1">{item.period}</p>
                  <p className="text-sm text-slate-700">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Survival Strategy */}
          <div className="p-6 border-b-2 border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-green-500" />
              <h3 className="font-black text-slate-900">How to Stay Relevant</h3>
            </div>
            <div className="space-y-2">
              {career.aiImpact.survivalStrategy.map((strategy, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="text-green-500 flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-4 h-4" />
                  </span>
                  <p className="text-sm text-slate-700">{strategy}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pros & Challenges */}
          <div className="p-6 border-b-2 border-slate-100">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pros */}
              <div>
                <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  The Good
                </h3>
                <div className="space-y-2">
                  {career.realityCheck.pros.map((pro, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-green-500 flex-shrink-0 mt-0.5 text-xs">✓</span>
                      <p className="text-sm text-slate-700">{pro}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Challenges */}
              <div>
                <h3 className="font-black text-slate-900 mb-3 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-500" />
                  The Challenges
                </h3>
                <div className="space-y-2">
                  {career.realityCheck.challenges.map((challenge, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-red-500 flex-shrink-0 mt-0.5 text-xs">✕</span>
                      <p className="text-sm text-slate-700">{challenge}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Typical Day */}
          <div className="p-6 border-b-2 border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-blue-500" />
              <h3 className="font-black text-slate-900">A Typical Day</h3>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {career.realityCheck.typicalDay}
            </p>
          </div>

          {/* Education Paths */}
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-purple-500" />
              <h3 className="font-black text-slate-900">Education Paths in Kenya</h3>
            </div>
            <div className="grid md:grid-cols-2 gap-4">

              {/* Universities */}
              {career.cbeReadiness.universities.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    Universities
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {career.cbeReadiness.universities.map((uni, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-xs font-bold"
                      >
                        {uni}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* TVET */}
              {career.cbeReadiness.tvetOptions.length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                    TVET Options
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {career.cbeReadiness.tvetOptions.map((tvet, i) => (
                      <span
                        key={i}
                        className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs font-bold"
                      >
                        {tvet}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Core Competencies */}
            <div className="mt-4">
              <p className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2">
                CBC Core Competencies Needed
              </p>
              <div className="flex flex-wrap gap-2">
                {career.cbeReadiness.coreCompetencies.map((comp, i) => (
                  <span
                    key={i}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${pathway.bg} ${pathway.text}`}
                  >
                    {comp}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================================
// COMPACT CAREER CARD (for lists/grids)
// ============================================================

export function CareerCardCompact({
  career,
  onClick,
}: {
  career: CareerData
  onClick?: () => void
}) {
  const risk = RISK_CONFIG[career.aiImpact.disruptionRisk]
  const growth = GROWTH_CONFIG[career.aiImpact.growthOutlook]
  const earning = EARNING_CONFIG[career.marketReality.earningPotential]
  const pathway = PATHWAY_CONFIG[career.pathway]

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-2xl border-2 border-slate-100 p-5 hover:border-blue-200 hover:shadow-md transition-all group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${pathway.bg} ${pathway.text}`}>
              {career.pathway}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${risk.color}`}>
              {risk.icon} {risk.label}
            </span>
          </div>
          <h3 className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">
            {career.name}
          </h3>
          <p className="text-xs text-slate-500 mt-1 font-semibold line-clamp-2">
            {career.marketReality.kenyanContext}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className={`text-lg font-black ${growth.color}`}>
            +{career.aiImpact.growthPercentage}%
          </div>
          <div className="text-xs text-slate-500">{earning.label}</div>
        </div>
      </div>
    </button>
  )
}