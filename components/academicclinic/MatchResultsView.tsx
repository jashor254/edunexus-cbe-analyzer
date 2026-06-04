'use client'

import { 
  CheckCircle2, AlertTriangle, Lock, 
  TrendingUp, BookOpen, UserCheck, 
  ArrowRight, ShieldCheck, Zap, Sparkles
} from 'lucide-react'
import type { MatchReport } from '@/lib/academicClinic/careerEngine'

interface MatchResultsViewProps {
  report: MatchReport;
  onUpgrade: () => void;
  isPremium?: boolean;
}

export function MatchResultsView({ 
  report, 
  onUpgrade,
  isPremium = false 
}: MatchResultsViewProps) {
  
  // 1. ADAPTER: Hii inazuia "Property does not exist" errors
  // Inageuza Database snake_case kwenda Frontend camelCase
  const transformCareer = (career: any) => {
    if (!career) return null;
    return {
      ...career,
      aiImpact: career.ai_impact || career.aiImpact,
      marketReality: career.market_reality || career.marketReality,
      realityCheck: career.reality_check || career.realityCheck,
      cbeReadiness: career.cbe_readiness || career.cbeReadiness,
      matchRequirements: career.match_requirements || career.matchRequirements
    };
  };

  const topMatch = report.topMatches[0];
  const transformedTopCareer = transformCareer(topMatch.career);

  return (
    <div className="max-w-5xl mx-auto space-y-10 p-4 pb-20">
      
      {/* ── HEADER: THE WINNER ── */}
      <section className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 border-2 border-amber-200 rounded-full text-amber-700 font-black text-sm uppercase tracking-wider">
          <Sparkles className="w-4 h-4 fill-amber-500" />
          Best Career Fit Found
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tight">
          Analysis Complete.
        </h1>
      </section>

      {/* ── SECTION 1: THE TOP MATCH ── */}
      <section className="relative">
        <div className="absolute -top-4 -right-4 z-10 rotate-12">
          <div className="bg-blue-600 text-white px-6 py-2 rounded-2xl font-black shadow-xl border-4 border-white">
            {topMatch.matchScore}% Match
          </div>
        </div>
        
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-4">
          <h2 className="text-2xl font-black text-slate-900">{transformedTopCareer?.name}</h2>
          <p className="text-slate-600 font-medium">{transformedTopCareer?.marketReality?.kenyanContext}</p>
        </div>
      </section>

      {/* ── SECTION 2: THE BREAKDOWN ── */}
      <div className="grid md:grid-cols-2 gap-8">
        {/* Academic & Personality Fit */}
        <div className="bg-white p-8 rounded-[2.5rem] border-2 border-slate-100 shadow-sm space-y-6">
          <h3 className="font-black text-xl text-slate-900 flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-blue-600" />
            Compatibility Profile
          </h3>
          
          <div className="space-y-5">
            {Object.entries(topMatch.matchDimensions).map(([key, value]) => (
              <div key={key} className="group">
                <div className="flex justify-between text-xs font-black uppercase text-slate-500 mb-2 tracking-widest">
                  <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="text-blue-600">{value}%</span>
                </div>
                <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
                  <div 
                    className="h-full bg-blue-600 rounded-full transition-all duration-1000 ease-out shrink-0" 
                    style={{ width: `${value}%` }} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Immediate Steps & Gaps */}
        <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white shadow-2xl space-y-6">
          <h3 className="font-black text-xl flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-blue-400" />
            Strategic Roadmap
          </h3>
          
          <ul className="space-y-4">
            {topMatch.pathway.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-4 text-sm font-bold text-slate-300">
                <div className="bg-green-500/20 p-1 rounded-lg shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                </div>
                {step}
              </li>
            ))}
          </ul>
          
          {topMatch.pathway.criticalGaps.length > 0 && (
            <div className="mt-8 p-5 bg-red-500/10 border-2 border-red-500/20 rounded-2xl">
              <p className="text-xs font-black text-red-400 uppercase mb-2 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> Priority Focus
              </p>
              <p className="text-sm text-red-100 font-bold leading-relaxed">
                {topMatch.pathway.criticalGaps[0]}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── SECTION 3: PREMIUM LOCK (Conditional) ── */}
      {report.isLocked && (
        <div className="relative pt-10">
          <div className="absolute inset-0 bg-white/40 backdrop-blur-md z-10 flex flex-col items-center justify-center rounded-[3rem] border-4 border-dashed border-slate-200">
            <div className="bg-white p-10 rounded-3xl shadow-2xl text-center max-w-md border-2 border-blue-100 transform -translate-y-4">
              <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6 rotate-3">
                <Lock className="w-10 h-10 text-blue-600" />
              </div>
              <h4 className="text-2xl font-black text-slate-900 mb-3">Unlock Deep Insights</h4>
              <p className="text-slate-600 font-semibold mb-8 leading-relaxed">
                Your child has 12+ other career matches. Unlock the full report to see hidden gems, 
                market pivot options, and AI survival strategies.
              </p>
              <button 
                onClick={onUpgrade}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 shadow-xl shadow-blue-200"
              >
                Upgrade to Premium
                <ArrowRight className="w-6 h-6" />
              </button>
            </div>
          </div>
          
          {/* Faded Content Preview (Hidden Gems Placeholder) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 opacity-20 pointer-events-none grayscale">
             {[1, 2, 3].map(i => (
               <div key={i} className="h-64 bg-slate-200 rounded-[2.5rem] border-2 border-slate-300" />
             ))}
          </div>
        </div>
      )}

      {/* ── SECTION 4: HIDDEN GEMS (If Unlocked) ── */}
      {!report.isLocked && report.hiddenGems && (
        <section className="pt-10 space-y-6">
          <div className="flex items-center gap-3">
             <ShieldCheck className="text-purple-600 w-8 h-8" />
             <h2 className="text-2xl font-black text-slate-900">Future-Proof Hidden Gems</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {report.hiddenGems.map((gem, i) => {
              const transformedGem = transformCareer(gem.career);
              return (
                <div key={i} className="bg-purple-50 p-6 rounded-[2rem] border-2 border-purple-100 hover:border-purple-300 transition-colors group">
                  <h4 className="font-black text-xl text-purple-900 mb-2">{transformedGem.name}</h4>
                  <div className="inline-block px-3 py-1 bg-white rounded-full text-[10px] font-black text-purple-600 uppercase mb-4 border border-purple-100">
                    +{transformedGem.aiImpact?.growthPercentage}% Growth
                  </div>
                  <p className="text-sm text-purple-800 font-medium line-clamp-3 mb-6">
                    {transformedGem.marketReality?.kenyanContext}
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black text-purple-400 uppercase">
                      <span>Match Score</span>
                      <span>{gem.matchScore}%</span>
                    </div>
                    <div className="h-2 bg-purple-200 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 shrink-0" style={{ width: `${gem.matchScore}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  )
}