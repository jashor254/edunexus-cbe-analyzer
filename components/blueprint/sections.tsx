// components/blueprint/sections.tsx
//
// Per-section content renderers for the sections that can actually be
// `available` (Identity, Academic Record, Attendance, Learning Compass,
// Career, Teacher Reflection (Sprint 12O), Parent Summary). Every renderer
// displays only fields already present on its data type — nothing
// computed, nothing guessed, per this sprint's "Blueprint owns nothing"
// mission. Educational Identity / Growth Timeline still have no dedicated
// renderer here because their composers still always return
// `not_implemented` — BlueprintSectionCard's own "Coming Soon" state
// already covers them correctly.

import type {
  IdentityData,
  AcademicRecordData,
  AttendanceData,
  LearningCompassData,
  CareerData,
  TeacherReflectionData,
  ParentSummaryData,
  RecommendedNextStepsData,
  PortfolioData,
  AchievementData,
  GrowthTimelineEntry,
  RiskData,
  LearningStoryData,
} from '@/lib/learnerBlueprint/types'

const TREND_ARROW: Record<string, string> = {
  improving: '↑',
  declining: '↓',
  stable: '→',
  insufficient_data: '·',
  mixed: '↕',
}

export function IdentitySection({ data }: { data: IdentityData }) {
  return (
    <div className="space-y-1 text-sm text-gray-700">
      <p className="font-bold text-gray-900">{data.learnerName}</p>
      <p>Admission No: {data.admissionNumber}</p>
      <p>{data.schoolName}{data.currentClassName ? ` — ${data.currentClassName}` : ''}</p>
      {(data.academicYearLabel || data.termLabel) && (
        <p className="text-gray-500">{[data.academicYearLabel, data.termLabel].filter(Boolean).join(' · ')}</p>
      )}
      {data.guardians.length > 0 && (
        <div className="pt-2">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-wide">Guardians</p>
          {data.guardians.map((g, i) => (
            <p key={i} className="text-sm">{g.fullName} ({g.relationship})</p>
          ))}
        </div>
      )}
    </div>
  )
}

export function AcademicRecordSection({ data }: { data: AcademicRecordData }) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p>
        Overall trend: <span className="font-bold">{data.overallTrend ?? 'insufficient data'}</span>
        {data.overallTrend && <span className="ml-1">{TREND_ARROW[data.overallTrend]}</span>}
      </p>
      {data.bySubject.length > 0 ? (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 uppercase tracking-wide text-[10px]">
              <th className="font-black pb-1">Subject</th>
              <th className="font-black pb-1">Level</th>
              <th className="font-black pb-1">Trend</th>
            </tr>
          </thead>
          <tbody>
            {data.bySubject.map(s => (
              <tr key={s.subject} className="border-t border-gray-50">
                <td className="py-1">{s.subject}</td>
                <td className="py-1">{s.latestLevel}</td>
                <td className="py-1">{TREND_ARROW[s.trend]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-gray-400">No subject-level data yet.</p>
      )}
      {data.competencies.length > 0 && (
        <div>
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-wide mb-1">Competencies</p>
          {data.competencies.map(c => (
            <p key={c.subject} className="text-xs">{c.subject}: Level {c.currentLevel}</p>
          ))}
        </div>
      )}
    </div>
  )
}

export function AttendanceSection({ data }: { data: AttendanceData }) {
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <p>
        Attendance: <span className="font-bold">{data.attendancePercentage !== null ? `${data.attendancePercentage}%` : 'no sessions recorded'}</span>
      </p>
      <div className="grid grid-cols-4 gap-2 text-xs">
        <div><span className="font-bold">{data.presentCount}</span> present</div>
        <div><span className="font-bold">{data.lateCount}</span> late</div>
        <div><span className="font-bold">{data.absentCount}</span> absent</div>
        <div><span className="font-bold">{data.excusedCount}</span> excused</div>
      </div>
      {data.notes.map((n, i) => (
        <p key={i} className="text-[11px] text-gray-400">{n}</p>
      ))}
    </div>
  )
}

export function LearningCompassSection({ data }: { data: LearningCompassData }) {
  return (
    <div className="space-y-1.5 text-sm text-gray-700">
      <p>Current focus: <span className="font-bold">{data.currentLearningFocus ? `${data.currentLearningFocus.subject}${data.currentLearningFocus.subtopic ? ` — ${data.currentLearningFocus.subtopic}` : ''}` : 'none yet'}</span></p>
      <p>Next recommended action: {data.nextRecommendedAction ?? '—'}</p>
      <p>Learning readiness: {data.learningReadiness ?? 'not available'}</p>
      <p>Holiday programme: {data.holidayProgrammeAvailable ? 'available' : 'not available'}</p>
      {data.notes.map((n, i) => (
        <p key={i} className="text-[11px] text-gray-400">{n}</p>
      ))}
    </div>
  )
}

export function CareerSection({ data }: { data: CareerData }) {
  return (
    <div className="space-y-1.5 text-sm text-gray-700">
      <p>Emerging Career Cluster: <span className="font-bold">{data.careerCluster ?? 'not yet available'}</span></p>
      {data.strengthProfile && <p className="text-xs text-gray-500">{data.strengthProfile}</p>}
      {data.futureDirection && <p className="text-teal-700">{data.futureDirection}</p>}
      {data.aiOutlook && <p className="text-xs">AI Outlook: {data.aiOutlook}</p>}
      {data.confidence && <p className="text-xs">Confidence: {data.confidence}</p>}
      {/*
        When this career's figures were last confirmed. Rendered whenever a
        verification state exists, not only when it is bad — a reader should be
        able to see the date and judge for themselves, which is the whole point.
        Stale knowledge gets visual weight so it cannot be skimmed past.
      */}
      {data.knowledge && (
        <p
          className={
            data.knowledge.requiresHistoricalFraming
              ? 'text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1'
              : 'text-[11px] text-gray-400'
          }
        >
          {data.knowledge.asOfLabel}
        </p>
      )}
      {data.notes.map((n, i) => (
        <p key={i} className="text-[11px] text-gray-400">{n}</p>
      ))}
    </div>
  )
}

export function PortfolioSection({ data }: { data: PortfolioData }) {
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <p><span className="font-bold">{data.publishedCount}</span> published item{data.publishedCount === 1 ? '' : 's'}</p>
      {data.featuredItem && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Featured</p>
          <p>{data.featuredItem.title} <span className="text-gray-400">— {data.featuredItem.category}</span></p>
        </div>
      )}
      {data.latestItem && data.latestItem.title !== data.featuredItem?.title && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Latest</p>
          <p>{data.latestItem.title} <span className="text-gray-400">— {data.latestItem.category}</span></p>
        </div>
      )}
      {data.portfolioUrl && (
        <a href={data.portfolioUrl} className="text-xs font-bold text-teal-700 hover:underline">View full Portfolio →</a>
      )}
    </div>
  )
}

export function AchievementSection({ data }: { data: AchievementData }) {
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <p><span className="font-bold">{data.achievementCount}</span> achievement{data.achievementCount === 1 ? '' : 's'}</p>
      {data.highestLevelAchievement && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Highest Level</p>
          <p>{data.highestLevelAchievement.title} <span className="text-gray-400">— {data.highestLevelAchievement.achievementType}</span></p>
        </div>
      )}
      {data.latestVerifiedAchievement && data.latestVerifiedAchievement.title !== data.highestLevelAchievement?.title && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Latest Verified</p>
          <p>{data.latestVerifiedAchievement.title} <span className="text-gray-400">— {data.latestVerifiedAchievement.achievementType}</span></p>
        </div>
      )}
      {data.profileUrl && (
        <a href={data.profileUrl} className="text-xs font-bold text-teal-700 hover:underline">View all Achievements →</a>
      )}
    </div>
  )
}

export function TeacherReflectionSection({ data }: { data: TeacherReflectionData }) {
  return (
    <div className="space-y-2 text-sm text-gray-700">
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Strengths</p>
        <p>{data.strengths}</p>
      </div>
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Growth Area</p>
        <p>{data.growthArea}</p>
      </div>
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Learning Habits</p>
        <p>{data.learningHabits}</p>
      </div>
      <div>
        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Recommended Support</p>
        <p>{data.recommendedSupport}</p>
      </div>
      {data.holidayFocus && (
        <div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">Holiday Focus</p>
          <p>{data.holidayFocus}</p>
        </div>
      )}
      {data.teacherSignature && (
        <p className="text-xs text-gray-400 pt-1">
          — {data.teacherSignature}
          {data.publishedAt && `, ${new Date(data.publishedAt).toLocaleDateString('en-KE', { dateStyle: 'long' })}`}
        </p>
      )}
    </div>
  )
}

export function ParentSummarySection({ data }: { data: ParentSummaryData }) {
  return (
    <div className="space-y-1.5 text-sm text-gray-700">
      {data.headline && <p className="font-bold">{data.headline}</p>}
      {data.detail && <p>{data.detail}</p>}
      {data.action && <p className="text-teal-700">{data.action}</p>}
    </div>
  )
}

const RISK_TONE: Record<RiskData['overallRiskLevel'], string> = {
  normal: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  watch: 'bg-amber-50 text-amber-700 border-amber-100',
  at_risk: 'bg-orange-50 text-orange-700 border-orange-100',
  critical: 'bg-red-50 text-red-700 border-red-100',
}

export function LearningStorySection({ data }: { data: LearningStoryData }) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <p className="text-base leading-6 text-gray-900">{data.narrative}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Evidence</p>
          <p className="mt-1">{data.evidence}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Interpretation</p>
          <p className="mt-1">{data.interpretation}</p>
        </div>
        <div className="rounded-xl border border-teal-100 bg-teal-50/70 p-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-teal-700">Opportunity</p>
          <p className="mt-1 text-teal-900">{data.opportunity}</p>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50/70 p-3">
          <p className="text-[11px] font-black uppercase tracking-wide text-amber-700">Next Concern</p>
          <p className="mt-1 text-amber-900">{data.nextConcern}</p>
        </div>
      </div>
      <div className="space-y-2 text-xs text-gray-500">
        <p><span className="font-bold text-gray-700">Direction:</span> {data.trajectory}</p>
        <p><span className="font-bold text-gray-700">Uncertainty:</span> {data.uncertainty}</p>
        <p><span className="font-bold text-gray-700">Confidence:</span> {data.confidenceStatement}</p>
        <p><span className="font-bold text-gray-700">Missing Evidence:</span> {data.missingEvidence}</p>
      </div>
    </div>
  )
}

export function GrowthTimelineSection({ data }: { data: GrowthTimelineEntry[] }) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      {data.map((entry, i) => (
        <div key={i} className="rounded-xl border border-gray-100 p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 capitalize">{entry.direction.replace('_', ' ')}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border bg-gray-50 text-gray-600 border-gray-100">
              confidence {entry.confidence}%
            </span>
          </div>
          <p>{entry.trajectory}</p>
          <p className="text-xs text-gray-500">
            Evidence window: {new Date(entry.windowStart).toLocaleDateString('en-KE', { dateStyle: 'medium' })} to {new Date(entry.windowEnd).toLocaleDateString('en-KE', { dateStyle: 'medium' })}
          </p>
          <p className="text-xs text-gray-500">
            Supporting evidence: {entry.supportingEvidenceIds.length} item{entry.supportingEvidenceIds.length === 1 ? '' : 's'} · latest evidence {entry.coverage.latestEvidenceAt ? new Date(entry.coverage.latestEvidenceAt).toLocaleDateString('en-KE', { dateStyle: 'medium' }) : 'unknown'}
          </p>
        </div>
      ))}
    </div>
  )
}

export function RiskSection({ data }: { data: RiskData }) {
  return (
    <div className="space-y-3 text-sm text-gray-700">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${RISK_TONE[data.overallRiskLevel]}`}>
          {data.overallRiskLevel.replace('_', ' ')}
        </span>
        <span className="text-xs text-gray-500">
          confidence {data.confidence}% · {data.coverage.evidenceCount} evidence item{data.coverage.evidenceCount === 1 ? '' : 's'}
        </span>
      </div>
      {data.flags.length === 0 ? (
        <p>No active risk flag is supported across the available scored evidence.</p>
      ) : (
        data.flags.map((flag, i) => (
          <div key={i} className="rounded-xl border border-gray-100 p-3">
            <p className="font-bold text-gray-900">{flag.subject ?? 'General'} · {flag.severity.replace('_', ' ')}</p>
            <p className="mt-1">{flag.reason}</p>
            <p className="mt-1 text-xs text-gray-500">Evidence references: {flag.evidenceIds.length}</p>
          </div>
        ))
      )}
      <p className="text-xs text-gray-500">
        Latest supporting evidence: {data.coverage.latestEvidenceAt ? new Date(data.coverage.latestEvidenceAt).toLocaleDateString('en-KE', { dateStyle: 'medium' }) : 'unknown'}
      </p>
    </div>
  )
}

const PRIORITY_STYLE: Record<string, string> = {
  critical: 'bg-red-50 text-red-700 border-red-100',
  important: 'bg-amber-50 text-amber-700 border-amber-100',
  suggested: 'bg-teal-50 text-teal-700 border-teal-100',
  completed: 'bg-gray-100 text-gray-500 border-gray-200',
}

export function RecommendedNextStepsSection({ data }: { data: RecommendedNextStepsData }) {
  return (
    <div className="space-y-2">
      {data.actions.map((action, i) => (
        <div key={i} className="rounded-xl border border-gray-100 p-3 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-gray-900">{action.title}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold ${PRIORITY_STYLE[action.priority]}`}>
              {action.priority}
            </span>
          </div>
          <p className="text-xs text-gray-500">{action.description}</p>
          <p className="text-[10px] text-gray-300">Source: {action.sourceDomain}</p>
        </div>
      ))}
    </div>
  )
}
