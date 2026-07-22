import { growthRepos } from '@/lib/growth/repositories'
import { computeFounderPriorityScore } from '@/lib/growth/targeting/score'
import { deriveNextAction } from '@/lib/growth/targeting/nextAction'
import { buildTodaysRoute } from '@/lib/growth/targeting/route'
import type { SchoolTargetingContext, TargetedSchool, RouteStep } from '@/lib/growth/targeting/types'

export type PilotTargetingData = {
  schools: TargetedSchool[]
  route: RouteStep[]
  // Sprint PE-7 Part 3 — "First Contact Queue": research complete, never
  // contacted, still sitting at the research stage. A named subset of
  // `schools`, not a separate query — narrower than Mission Today (which
  // also includes overdue follow-ups on schools already being worked).
  readyToContact: TargetedSchool[]
}

const BUCKET_RANK: Record<TargetedSchool['bucket'], number> = {
  '🔥 Contact Today': 0,
  '📅 Schedule This Week': 1,
  '⏳ Waiting': 2,
  '🚫 Low Priority': 3,
}

/**
 * Sprint PE-6 — the Pilot Targeting Engine. Reads only existing Growth
 * Engine data (growth_schools/growth_contacts/growth_follow_ups/
 * growth_activities), computes a fully-explained Founder Priority Score
 * and next action per school, and returns everyone — nothing is filtered
 * out or hidden, per the mission's "never hide a school" rule. Starred
 * schools sort first, then by score, both facts the founder can already
 * see on each card, so the ordering itself is never a surprise.
 */
export async function getPilotTargeting(): Promise<PilotTargetingData> {
  const [allSchools, firstContactPerSchool, openFollowUps, lastActivityPerSchool] = await Promise.all([
    growthRepos.schools.list(),
    growthRepos.contacts.listFirstContactPerSchool(),
    growthRepos.followUps.listOpen(),
    growthRepos.activities.lastActivityPerSchool(),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const openFollowUpBySchool = new Map(openFollowUps.map((f) => [f.school_id, f]))
  const activeSchools = allSchools.filter((s) => s.status === 'active' && s.pipeline_stage !== 'lost')

  const targeted: TargetedSchool[] = activeSchools.map((school) => {
    const contact = firstContactPerSchool.get(school.id) ?? null
    const followUp = openFollowUpBySchool.get(school.id) ?? null

    const context: SchoolTargetingContext = {
      hasContact: !!contact,
      contactName: contact?.full_name ?? null,
      contactRole: contact?.role ?? null,
      hasAnyActivity: lastActivityPerSchool.has(school.id),
      hasOpenFollowUp: !!followUp,
      followUpOverdue: !!followUp && followUp.due_date < today,
      followUpTask: followUp?.task ?? null,
    }

    const { score, bucket, factors } = computeFounderPriorityScore(school, context)
    const nextAction = deriveNextAction(school, context)

    return {
      schoolId: school.id,
      schoolName: school.name,
      category: school.category,
      pipelineStage: school.pipeline_stage,
      starred: school.starred,
      hasWhatsapp: !!school.whatsapp_number?.trim(),
      hasPhone: !!school.phone?.trim(),
      hasEmail: !!school.email?.trim(),
      hasWebsite: !!school.website?.trim(),
      score,
      bucket,
      factors,
      nextAction,
    }
  })

  targeted.sort((a, b) => {
    if (a.starred !== b.starred) return a.starred ? -1 : 1
    if (BUCKET_RANK[a.bucket] !== BUCKET_RANK[b.bucket]) return BUCKET_RANK[a.bucket] - BUCKET_RANK[b.bucket]
    return b.score - a.score
  })

  const readyToContact = targeted.filter(
    (s) =>
      s.pipelineStage === 'research' &&
      s.factors.some((f) => f.label.startsWith('Research complete') && f.satisfied) &&
      s.factors.some((f) => f.label.includes('fresh opportunity') && f.satisfied),
  )

  return { schools: targeted, route: buildTodaysRoute(targeted), readyToContact }
}
