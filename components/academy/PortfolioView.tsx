'use client'

import Link from 'next/link'
import RadarChart from './RadarChart'
import {
  GraduationCap,
  ChevronLeft,
  Zap,
  CheckCircle2,
  Lock,
  BookOpen,
  Target,
  Sparkles,
  Camera,
  TrendingUp,
  Share2,
  Activity,
  Download,
  FileText,
  LayoutGrid,
  Star,
  Award,
} from 'lucide-react'
import type { PortfolioData, Badge } from '@/lib/academy/portfolio'
import { PHASE_META } from '@/lib/academy/types'
import type { PhaseStats } from '@/lib/academy/types'

const SCORE_LABELS: Record<number, string> = {
  1: 'Surface', 2: 'Developing', 3: 'Thoughtful', 4: 'Deep', 5: 'Transformative',
}

const GROWTH_COLORS: Record<string, string> = {
  surface: '#94a3b8', developing: '#f59e0b', deep: '#7c3aed', transformative: '#059669',
}

function scoreToGrowth(score: number | null): string {
  if (!score) return 'surface'
  if (score >= 4.5) return 'transformative'
  if (score >= 3.5) return 'deep'
  if (score >= 2.5) return 'developing'
  return 'surface'
}

export default function PortfolioView({ portfolio }: { portfolio: PortfolioData }) {
  const {
    teacher,
    phaseStats,
    lessonStats,
    missionStats,
    reflectionStats,
    evidenceStats,
    totalXp,
    toolUsage,
    badges,
    competencies,
  } = portfolio

  const earnedBadges  = badges.filter(b => b.earned)
  const lockedBadges  = badges.filter(b => !b.earned)
  const phasesComplete = phaseStats.filter(p => p.allComplete).length
  const growthLevel   = scoreToGrowth(reflectionStats.avgScore)
  const growthColor   = GROWTH_COLORS[growthLevel]

  const joinedDate = new Date(teacher.created_at).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  function handleShare() {
    const text =
      `🎓 My EduNexus AI Academy Portfolio\n\n` +
      `📚 ${lessonStats.completed} lessons completed across ${phasesComplete} phase${phasesComplete !== 1 ? 's' : ''}\n` +
      `🏆 ${earnedBadges.length} badges earned\n` +
      `🎯 ${missionStats.completed} missions completed\n` +
      `💡 ${reflectionStats.total} classroom reflections submitted\n` +
      `📝 ${toolUsage.lessonPlans} lesson plans generated in EduNexus\n` +
      `⚡ ${totalXp} XP earned\n\n` +
      `#EduNexus #AITeacher #CBCKenya #PioneerTeacher`

    if (navigator.share) {
      navigator.share({ text }).catch(() => {
        navigator.clipboard.writeText(text)
        alert('Copied to clipboard! Paste it in WhatsApp.')
      })
    } else {
      navigator.clipboard.writeText(text)
      alert('Copied to clipboard! Paste it in WhatsApp.')
    }
  }

  function handlePrint() {
    window.print()
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>

      <div className="min-h-screen bg-slate-50">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="bg-[#0c1929] relative overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-size-[40px_40px]" />
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/3 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-10">
            {/* Nav */}
            <div className="no-print flex items-center justify-between mb-8 flex-wrap gap-3">
              <Link
                href="/teacher/academy"
                className="inline-flex items-center gap-1.5 text-slate-400 hover:text-teal-400 text-xs font-semibold transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> AI Academy
              </Link>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleShare}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-linear-to-r from-teal-500 to-cyan-400 text-white px-4 py-2 rounded-xl text-xs font-bold hover:opacity-90 transition shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
              </div>
            </div>

            {/* Teacher identity */}
            <div className="flex items-start gap-5 flex-wrap">
              <div className="w-16 h-16 bg-linear-to-br from-teal-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-900/40 shrink-0">
                <GraduationCap className="w-8 h-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[11px] font-black text-teal-400 uppercase tracking-wider">
                    EduNexus AI Academy
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg">
                    <Zap className="w-3 h-3" /> {totalXp} XP
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  {teacher.full_name ?? 'Mwalimu'}
                </h1>
                {teacher.school && (
                  <p className="text-slate-400 text-sm mt-0.5">{teacher.school}</p>
                )}
                <p className="text-slate-500 text-xs mt-1">Academy member since {joinedDate}</p>
              </div>
            </div>

            {/* Phase journey */}
            <div className="mt-8 flex items-center gap-2 flex-wrap">
              {phaseStats.map(ps => {
                const meta = PHASE_META.find(m => m.phase === ps.phase)
                return (
                  <div
                    key={ps.phase}
                    className="flex items-center gap-1.5 text-[11px] font-black px-3 py-1.5 rounded-xl border transition"
                    style={
                      ps.allComplete
                        ? { background: `${meta?.color ?? '#14b8a6'}22`, color: meta?.color ?? '#14b8a6', borderColor: `${meta?.color ?? '#14b8a6'}40` }
                        : ps.locked
                        ? { background: 'rgba(255,255,255,0.04)', color: '#475569', borderColor: 'rgba(255,255,255,0.08)' }
                        : { background: 'rgba(255,255,255,0.08)', color: '#94a3b8', borderColor: 'rgba(255,255,255,0.12)' }
                    }
                  >
                    {ps.allComplete && <CheckCircle2 className="w-3 h-3" />}
                    {ps.locked && <Lock className="w-3 h-3" />}
                    {!ps.allComplete && !ps.locked && (
                      <span className="w-3 h-3 rounded-full border-2 inline-block" style={{ borderColor: meta?.color ?? '#14b8a6' }} />
                    )}
                    {meta?.badge ?? `Phase ${ps.phase}`}
                    <span className="opacity-60">{ps.pct}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard icon={<BookOpen className="w-5 h-5" />} value={lessonStats.completed} label="Lessons Done" color="#14b8a6" />
            <StatCard icon={<Target className="w-5 h-5" />}  value={missionStats.completed}    label="Missions"     color="#7c3aed" />
            <StatCard icon={<Sparkles className="w-5 h-5" />} value={reflectionStats.total}    label="Reflections"  color="#0891b2" />
            <StatCard icon={<Camera className="w-5 h-5" />}   value={evidenceStats.total}      label="Evidence"     color="#059669" />
          </div>

          {/* Reflection quality + Platform impact — side by side on desktop */}
          <div className="grid sm:grid-cols-2 gap-6">

            {/* Reflection quality */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-violet-500" />
                <h2 className="text-sm font-black text-gray-900">Reflection Quality</h2>
              </div>

              {reflectionStats.total > 0 ? (
                <>
                  <div className="flex items-end gap-3 mb-3">
                    <span className="text-4xl font-black" style={{ color: growthColor }}>
                      {reflectionStats.avgScore?.toFixed(1) ?? '—'}
                    </span>
                    <div className="mb-1">
                      <p className="text-xs font-black" style={{ color: growthColor }}>
                        {SCORE_LABELS[Math.round(reflectionStats.avgScore ?? 0)] ?? '—'}
                      </p>
                      <p className="text-[11px] text-gray-400">avg score / 5</p>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="w-full bg-gray-100 rounded-full h-2 mb-3">
                    <div
                      className="h-2 rounded-full transition-all"
                      style={{ width: `${((reflectionStats.avgScore ?? 0) / 5) * 100}%`, background: growthColor }}
                    />
                  </div>

                  <div className="grid grid-cols-5 gap-1 mt-1">
                    {[1,2,3,4,5].map(n => (
                      <div key={n} className="text-center">
                        <div
                          className="h-1 rounded-full mb-1"
                          style={{ background: (reflectionStats.avgScore ?? 0) >= n ? growthColor : '#e2e8f0' }}
                        />
                        <span className="text-[9px] text-gray-400">{SCORE_LABELS[n]?.slice(0,4)}</span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-gray-500 mt-4">
                    Based on <span className="font-bold text-gray-700">{reflectionStats.total}</span> reflection{reflectionStats.total !== 1 ? 's' : ''} submitted
                  </p>
                </>
              ) : (
                <div className="text-center py-6">
                  <Sparkles className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No reflections yet</p>
                  <p className="text-xs text-gray-400 mt-1">Complete a lesson and reflect to see your quality score.</p>
                </div>
              )}
            </div>

            {/* Platform impact */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <div className="flex items-center gap-2 mb-4">
                <LayoutGrid className="w-4 h-4 text-teal-500" />
                <h2 className="text-sm font-black text-gray-900">Platform Impact</h2>
              </div>
              <p className="text-[11px] text-gray-400 mb-4">
                Academy learning translated into real EduNexus use.
              </p>
              <div className="space-y-3">
                <ToolRow icon={<FileText className="w-4 h-4" />} label="Lesson Plans Generated" value={toolUsage.lessonPlans} color="#14b8a6" />
                <ToolRow icon={<BookOpen className="w-4 h-4" />} label="Schemes of Work Created" value={toolUsage.schemesOfWork} color="#f97316" />
                <ToolRow icon={<Award className="w-4 h-4" />}    label="Records of Work Logged"  value={toolUsage.recordsOfWork} color="#7c3aed" />
              </div>

              {missionStats.avgAiScore && (
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">Avg mission AI score</p>
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} className="w-3.5 h-3.5" style={{ fill: n <= (missionStats.avgAiScore ?? 0) ? '#f59e0b' : 'transparent', color: n <= (missionStats.avgAiScore ?? 0) ? '#f59e0b' : '#d1d5db' }} />
                      ))}
                      <span className="text-xs font-black text-gray-700 ml-1">{missionStats.avgAiScore.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Competency Radar */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Activity className="w-4 h-4 text-teal-500" />
              <h2 className="text-sm font-black text-gray-900">CBC Competency Profile</h2>
              <span className="text-[11px] text-gray-400 ml-auto">
                {competencies.filter(c => c.score > 0).length}/{competencies.length} competencies activated
              </span>
            </div>
            <p className="text-xs text-gray-400 mb-5">
              Each axis maps to a Kenya CBC teacher competency. Score rises as you complete modules and reflect on your practice.
            </p>
            <RadarChart competencies={competencies} />
          </div>

          {/* Badges */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <Award className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-black text-gray-900">Badges</h2>
              <span className="text-xs text-gray-400 ml-auto">
                {earnedBadges.length}/{badges.length} earned
              </span>
            </div>

            {earnedBadges.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {earnedBadges.map(badge => (
                  <BadgeChip key={badge.id} badge={badge} earned />
                ))}
              </div>
            )}

            {lockedBadges.length > 0 && (
              <>
                {earnedBadges.length > 0 && (
                  <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wide mb-2 mt-4">
                    Still to earn
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {lockedBadges.map(badge => (
                    <BadgeChip key={badge.id} badge={badge} earned={false} />
                  ))}
                </div>
              </>
            )}

            {earnedBadges.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Complete lessons, missions, and reflections to earn badges.
              </p>
            )}
          </div>

          {/* Phase progress detail */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-5">
              <GraduationCap className="w-4 h-4 text-teal-500" />
              <h2 className="text-sm font-black text-gray-900">Phase Progress</h2>
            </div>
            <div className="space-y-4">
              {phaseStats.map(ps => <PhaseRow key={ps.phase} ps={ps} />)}
            </div>
          </div>

          {/* CTA footer */}
          <div className="no-print flex flex-col sm:flex-row items-center gap-3 justify-center pb-4">
            <Link
              href="/teacher/academy"
              className="flex items-center gap-2 bg-[#0c1929] text-white px-6 py-3 rounded-xl font-bold text-sm hover:opacity-90 transition shadow-sm"
            >
              <BookOpen className="w-4 h-4" /> Continue Academy
            </Link>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl font-bold text-sm hover:border-gray-300 hover:shadow-sm transition"
            >
              <Share2 className="w-4 h-4" /> Share Portfolio
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  icon, value, label, color,
}: {
  icon: React.ReactNode
  value: number
  label: string
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, color }}>
          {icon}
        </div>
      </div>
      <p className="text-3xl font-black text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5 font-semibold">{label}</p>
    </div>
  )
}

function ToolRow({
  icon, label, value, color,
}: {
  icon: React.ReactNode
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, color }}>
        {icon}
      </div>
      <p className="flex-1 text-xs text-gray-600 font-semibold">{label}</p>
      <span className="text-sm font-black text-gray-900">{value}</span>
    </div>
  )
}

function BadgeChip({ badge, earned }: { badge: Badge; earned: boolean }) {
  return (
    <div
      title={badge.description}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-black transition"
      style={
        earned
          ? { background: `${badge.color}18`, color: badge.color, borderColor: `${badge.color}30` }
          : { background: '#f8fafc', color: '#94a3b8', borderColor: '#e2e8f0' }
      }
    >
      {earned
        ? <CheckCircle2 className="w-3 h-3" />
        : <Lock className="w-3 h-3" />
      }
      {badge.label}
    </div>
  )
}

function PhaseRow({ ps }: { ps: PhaseStats }) {
  const meta = PHASE_META.find(m => m.phase === ps.phase)
  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0 w-32">
        <p className="text-xs font-black text-gray-700">Phase {ps.phase}</p>
        <p className="text-[11px] text-gray-400 leading-tight">{meta?.title}</p>
      </div>
      <div className="flex-1">
        <div className="flex justify-between text-[11px] text-gray-400 mb-1">
          <span>{ps.completedLessons}/{ps.totalLessons} lessons</span>
          <span className="font-bold" style={{ color: meta?.color ?? '#14b8a6' }}>{ps.pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${ps.pct}%`, background: meta?.color ?? '#14b8a6' }}
          />
        </div>
      </div>
      <div className="shrink-0">
        {ps.allComplete
          ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          : ps.locked
          ? <Lock className="w-4 h-4 text-gray-300" />
          : <div className="w-4 h-4 rounded-full border-2" style={{ borderColor: meta?.color ?? '#14b8a6' }} />
        }
      </div>
    </div>
  )
}
