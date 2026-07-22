import { growthRepos } from '@/lib/growth/repositories'
import type { MissionControlData, MissionTodayItem, AtRiskItem, RecentWin } from '@/lib/growth/types'
import { PILOT_ACQUISITION_GOAL } from '@/lib/growth/constants'

// Sprint PO-5 (Founder Mission Control) — 7 days, matching the mission's
// own explicit "no activity for 7+ days" bar for At Risk (supersedes the
// prior 6-day threshold this file used, which came from a different
// worked example in docs/growth-os/edunexus-growth-engine-specification.md
// §13.1; this sprint's own stated number wins).
const AT_RISK_THRESHOLD_DAYS = 7
const ONE_DAY_MS = 24 * 60 * 60 * 1000

// Sprint PE-3 — Section 3 "Display highest urgency first." Rank order matches
// the mission's own example ordering exactly (no activity > missing contact >
// no follow-up > research incomplete); `sortValue` breaks ties within a rank
// (e.g. 12 days overdue before 8 days overdue).
const AT_RISK_RANK = {
  NO_ACTIVITY: 0,
  NO_CONTACT: 1,
  NO_FOLLOW_UP: 2,
  RESEARCH_INCOMPLETE: 3,
} as const

function daysSince(iso: string | null, now: Date): number | null {
  if (!iso) return null
  return Math.floor((now.getTime() - new Date(iso).getTime()) / ONE_DAY_MS)
}

/**
 * Composes the five-section Mission Control page purely from reads over
 * the five Sprint C0 Growth tables (plus the Sprint PO-1 research fields
 * on growth_schools) — owns no data itself, same rule the old
 * getFounderDashboard() followed. Every section answers "what should I do
 * next" (mission today, at risk) or "what actually happened" (pipeline
 * health, recent wins, this week) — nothing here is a projection or a
 * score.
 */
export async function getMissionControl(): Promise<MissionControlData> {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const sevenDaysAgoIso = new Date(now.getTime() - 7 * ONE_DAY_MS).toISOString()

  const [schools, openFollowUps, lastActivityPerSchool, schoolIdsWithContacts, recentActivities] = await Promise.all([
    growthRepos.schools.list(),
    growthRepos.followUps.listOpen(),
    growthRepos.activities.lastActivityPerSchool(),
    growthRepos.contacts.listDistinctSchoolIdsWithContacts(),
    growthRepos.activities.listSince(sevenDaysAgoIso),
  ])

  const schoolById = new Map(schools.map((s) => [s.id, s]))
  const activeSchools = schools.filter((s) => s.status === 'active' && s.pipeline_stage !== 'lost')
  const openFollowUpBySchool = new Map(openFollowUps.map((f) => [f.school_id, f]))
  const ENGAGED_STAGES = new Set(['contacted', 'discovery', 'demo_scheduled', 'demo_completed', 'pilot_offered', 'pilot_running'])

  // ── Section 1: Mission Today ──────────────────────────────────────────────
  const missionToday: MissionTodayItem[] = []

  for (const f of openFollowUps) {
    if (f.due_date > today) continue
    const school = schoolById.get(f.school_id)
    const isDemo = school?.pipeline_stage === 'demo_scheduled'
    missionToday.push({
      kind: isDemo ? 'demo' : 'follow_up',
      schoolId: f.school_id,
      schoolName: school?.name ?? 'Unknown school',
      label: f.task,
      urgency: f.due_date < today ? 'overdue' : 'today',
    })
  }

  const readyToContact = activeSchools.filter((s) => s.pipeline_stage === 'research' && !!s.selection_reason)
  for (const s of readyToContact) {
    missionToday.push({ kind: 'first_contact', schoolId: s.id, schoolName: s.name, label: 'Ready for first contact', urgency: 'today' })
  }

  const researchIncomplete = activeSchools.filter((s) => s.pipeline_stage === 'research' && !s.selection_reason)
  for (const s of researchIncomplete) {
    missionToday.push({ kind: 'research_incomplete', schoolId: s.id, schoolName: s.name, label: 'Research not yet complete', urgency: 'this_week' })
  }

  // First-week review: a pilot_running school with no logged activity in
  // 7+ days — last_contact_at is the only signal available (no
  // stage-transition timestamp exists), so this doubles as "due for its
  // scheduled check-in" per docs/commercial-assets/pilot-success-playbook.md
  // Stage 5. Documented approximation, not exact.
  const pilotRunning = activeSchools.filter((s) => s.pipeline_stage === 'pilot_running')
  for (const s of pilotRunning) {
    const lastAt = lastActivityPerSchool.get(s.id) ?? s.created_at
    const days = daysSince(lastAt, now) ?? 0
    if (days >= AT_RISK_THRESHOLD_DAYS) {
      missionToday.push({ kind: 'first_week_review', schoolId: s.id, schoolName: s.name, label: `No check-in logged in ${days} days`, urgency: 'today' })
    }
  }

  const URGENCY_RANK: Record<string, number> = { overdue: 0, today: 1, this_week: 2 }
  missionToday.sort((a, b) => URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency])

  // ── Section 2: Mission Progress ────────────────────────────────────────────
  const pilotSchools = activeSchools.filter((s) => s.pipeline_stage === 'pilot_running' || s.pipeline_stage === 'pilot_won')
  const pilotAcquisition = { goal: PILOT_ACQUISITION_GOAL, progress: pilotSchools.length }

  // ── Section 3: Pipeline Health ─────────────────────────────────────────────
  const pipelineHealth = {
    research: activeSchools.filter((s) => s.pipeline_stage === 'research').length,
    contacted: activeSchools.filter((s) => s.pipeline_stage === 'contacted').length,
    discovery: activeSchools.filter((s) => s.pipeline_stage === 'discovery').length,
    demo: activeSchools.filter((s) => s.pipeline_stage === 'demo_scheduled' || s.pipeline_stage === 'demo_completed').length,
    pilot: activeSchools.filter((s) => ['pilot_offered', 'pilot_running', 'pilot_won'].includes(s.pipeline_stage)).length,
  }

  // ── Section 4: At Risk ─────────────────────────────────────────────────────
  const atRiskRanked: (AtRiskItem & { rank: number; sortValue: number })[] = []
  for (const s of activeSchools) {
    const lastAt = lastActivityPerSchool.get(s.id) ?? null
    const days = daysSince(lastAt ?? s.created_at, now) ?? 0

    if (ENGAGED_STAGES.has(s.pipeline_stage) && days >= AT_RISK_THRESHOLD_DAYS) {
      atRiskRanked.push({ schoolId: s.id, schoolName: s.name, reason: `No activity in ${days} days`, rank: AT_RISK_RANK.NO_ACTIVITY, sortValue: days })
      continue // one reason each, most urgent first — avoid a school appearing three times over
    }
    if (ENGAGED_STAGES.has(s.pipeline_stage) && !schoolIdsWithContacts.has(s.id)) {
      atRiskRanked.push({ schoolId: s.id, schoolName: s.name, reason: 'No contact person on file', rank: AT_RISK_RANK.NO_CONTACT, sortValue: 0 })
      continue
    }
    if (ENGAGED_STAGES.has(s.pipeline_stage) && !openFollowUpBySchool.has(s.id)) {
      atRiskRanked.push({ schoolId: s.id, schoolName: s.name, reason: 'No follow-up scheduled', rank: AT_RISK_RANK.NO_FOLLOW_UP, sortValue: 0 })
      continue
    }
    if (s.pipeline_stage === 'research' && !s.selection_reason) {
      const ageDays = daysSince(s.created_at, now) ?? 0
      if (ageDays >= AT_RISK_THRESHOLD_DAYS) {
        atRiskRanked.push({ schoolId: s.id, schoolName: s.name, reason: `Added ${ageDays} days ago, research still incomplete`, rank: AT_RISK_RANK.RESEARCH_INCOMPLETE, sortValue: ageDays })
      }
    }
  }
  atRiskRanked.sort((a, b) => a.rank - b.rank || b.sortValue - a.sortValue || a.schoolName.localeCompare(b.schoolName))
  const atRisk: AtRiskItem[] = atRiskRanked.map(({ schoolId, schoolName, reason }) => ({ schoolId, schoolName, reason }))

  // ── Section 5: Recent Wins ─────────────────────────────────────────────────
  const recentWins: RecentWin[] = []
  for (const s of activeSchools) {
    if (s.pipeline_stage === 'demo_completed') recentWins.push({ kind: 'demo_completed', schoolId: s.id, schoolName: s.name, at: s.updated_at })
    if (s.pipeline_stage === 'pilot_running' || s.pipeline_stage === 'pilot_won') recentWins.push({ kind: 'pilot_accepted', schoolId: s.id, schoolName: s.name, at: s.updated_at })
  }
  const sevenDaysAgoDate = new Date(now.getTime() - 7 * ONE_DAY_MS)
  for (const s of schools) {
    if (new Date(s.created_at) >= sevenDaysAgoDate) recentWins.push({ kind: 'new_school', schoolId: s.id, schoolName: s.name, at: s.created_at })
  }
  // Testimonial/referral have no dedicated field (Sprint PO-5 mandate: no
  // new tables/entities) — approximated by scanning already-logged Activity
  // notes for the words themselves, a manual-logging convention documented
  // in docs/commercial-assets/pilot-success-playbook.md, not a tracked
  // field. False negatives (an activity logged without the keyword) are
  // expected and acceptable at this volume.
  for (const a of recentActivities) {
    const notes = a.notes?.toLowerCase() ?? ''
    const school = schoolById.get(a.school_id)
    if (!school) continue
    if (notes.includes('testimonial')) recentWins.push({ kind: 'testimonial', schoolId: a.school_id, schoolName: school.name, at: a.occurred_at })
    if (notes.includes('referral')) recentWins.push({ kind: 'referral', schoolId: a.school_id, schoolName: school.name, at: a.occurred_at })
  }
  recentWins.sort((a, b) => b.at.localeCompare(a.at))

  // ── Section 6: This Week ───────────────────────────────────────────────────
  const contactTypes = new Set(['called', 'whatsapp', 'visited', 'email'])
  const schoolsContactedIds = new Set(recentActivities.filter((a) => contactTypes.has(a.type)).map((a) => a.school_id))
  const discoveryMeetingIds = new Set(recentActivities.filter((a) => a.type === 'meeting').map((a) => a.school_id))
  const demoIds = new Set(recentActivities.filter((a) => a.type === 'demo').map((a) => a.school_id))
  const pilotAgreementSchools = activeSchools.filter(
    (s) => ['pilot_offered', 'pilot_running', 'pilot_won'].includes(s.pipeline_stage) && new Date(s.updated_at) >= sevenDaysAgoDate,
  )

  const thisWeek = {
    schoolsResearched: schools.filter((s) => new Date(s.created_at) >= sevenDaysAgoDate).length,
    schoolsContacted: schoolsContactedIds.size,
    discoveryMeetings: discoveryMeetingIds.size,
    demos: demoIds.size,
    pilotAgreements: pilotAgreementSchools.length,
    activePilots: activeSchools.filter((s) => s.pipeline_stage === 'pilot_running').length,
  }

  return { missionToday, pilotAcquisition, pipelineHealth, atRisk, recentWins, thisWeek }
}
