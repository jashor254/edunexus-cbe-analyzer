// scripts/trace-consistency-audit.ts
//
// Read-only investigative trace: for a handful of real students with the
// richest cross-system evidence, calls the REAL lib functions (Evidence,
// Projection Engine, Blueprint, Career Intelligence, Holiday Planner,
// Monday Panel, Remedial Planner) directly and prints their actual output,
// to check whether "the same fact" (risk level, subject level) comes out
// consistently across consumers, or whether two different values appear
// for the same concept.
//
// No writes except recomputeLearnerProjection's own upserts to
// learner_projections (that function IS the read path every consumer
// uses — this is not a mutation introduced by this script).
//
// Run: npx tsx scripts/trace-consistency-audit.ts

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createServiceClient } from '@/utils/supabase/service'
import { recomputeLearnerProjection } from '@/lib/projection/recompute'
import { buildLearnerBlueprint } from '@/lib/learnerIntelligence/blueprint'
import { computeCapabilityMatches } from '@/lib/career/capabilityMatchEngine'
import { getCapabilityProfile, recomputeAndSaveCapabilityProfile, getAllCareersWithCOS } from '@/lib/career/careerEngine'
import { generateHolidayPlan } from '@/lib/holiday/planner'
import { buildTeacherPanel } from '@/lib/attentionFeed/panel'
import { getOrCreateLearnerProfile } from '@/lib/learnerModel'
import { generateRemedialPlan } from '@/lib/remedial/planner'

const CANDIDATES = [
  { id: 'cca93548-addb-4a16-b567-3999e7c55404', name: 'EVANS NDEGE', grade: 9,  classId: 'c2a5b2bc-1314-4ab9-b4d9-2767f151b857' },
  { id: '41f735d1-ddea-43a4-87f5-768b7f83a417', name: 'Cheruiyot Gitau', grade: 10, classId: 'f86af520-2e9f-40d2-8521-cd26f491cd07' },
  { id: '9391274b-e71f-4693-92e3-03aaa051203a', name: 'Kiprop Ochieng', grade: 10, classId: 'aa74cde1-108c-4b02-b9a3-ed28ac863d0a' },
]

function hr(title: string) {
  console.log('\n' + '='.repeat(70))
  console.log(title)
  console.log('='.repeat(70))
}

async function main() {
  const db = createServiceClient()

  for (const student of CANDIDATES) {
    hr(`STUDENT: ${student.name} (${student.id})`)

    // ── 1. Raw evidence/assessment rows ─────────────────────────────────
    const { data: evidenceRows } = await db
      .from('learner_evidence')
      .select('id, subject, assessment_type, cbc_level, lifecycle_state, created_at')
      .eq('learner_id', student.id)
      .order('created_at', { ascending: true })
    console.log('\n-- 1. Raw learner_evidence rows --')
    console.log(evidenceRows)

    const { data: assessmentRows } = await db
      .from('assessments')
      .select('id, subject_scores, term, year, created_at')
      .eq('student_id', student.id)
      .order('created_at', { ascending: true })
    console.log('\n-- 1b. Raw legacy assessments rows --')
    console.log(assessmentRows)

    // ── 2. Evidence Domain — confirmed evidence used by Projection ─────
    const { data: confirmedEvidence } = await db
      .from('learner_evidence')
      .select('id, subject, assessment_type, cbc_level, lifecycle_state, term, academic_year')
      .eq('learner_id', student.id)
      .in('lifecycle_state', ['auto_confirmed', 'reviewed_confirmed'])
    console.log('\n-- 2. Confirmed evidence (Evidence Domain, feeds Projection) --')
    console.log(confirmedEvidence)

    // ── 3. Projection Engine ────────────────────────────────────────────
    let projection: Awaited<ReturnType<typeof recomputeLearnerProjection>> | null = null
    try {
      projection = await recomputeLearnerProjection(student.id)
      console.log('\n-- 3. Projection Engine output --')
      console.log('academic:', JSON.stringify(projection.academic, null, 2))
      console.log('risk:', JSON.stringify(projection.risk, null, 2))
      console.log('capability:', JSON.stringify(projection.capability, null, 2))
      console.log('growth:', JSON.stringify(projection.growth, null, 2))
      console.log('knowledge:', JSON.stringify(projection.knowledge, null, 2))
    } catch (e) {
      console.log('\n-- 3. Projection Engine FAILED --')
      console.log(e)
    }

    // ── 4. Blueprint ─────────────────────────────────────────────────────
    try {
      const blueprint = await buildLearnerBlueprint(student.id)
      console.log('\n-- 4. Blueprint output --')
      console.log('evidenceSummary:', JSON.stringify(blueprint.evidenceSummary, null, 2))
      console.log('becoming.insights:', JSON.stringify(blueprint.becoming.insights, null, 2))
      console.log('opportunity.insight:', JSON.stringify(blueprint.opportunity.insight, null, 2))
      console.log('actions.parent:', JSON.stringify(blueprint.actions.parent, null, 2))
    } catch (e) {
      console.log('\n-- 4. Blueprint FAILED --')
      console.log(e)
    }

    // ── 5. Career Intelligence / Capability Matches ─────────────────────
    try {
      const profile = await recomputeAndSaveCapabilityProfile(student.id)
      console.log('\n-- 5. computeCapabilityProfile (assessments-table based, feeds Career Intelligence) --')
      console.log(JSON.stringify(profile, null, 2))

      if (profile) {
        const careers = await getAllCareersWithCOS()
        const report = computeCapabilityMatches(student.id, profile, careers)
        const allMatches = [...report.primary, ...report.stretch, ...report.alternative, ...report.entrepreneurial]
        console.log('\n-- 5b. computeCapabilityMatches top 5 --')
        console.log(JSON.stringify(allMatches.slice(0, 5), null, 2))
      } else {
        console.log('\n-- 5b. computeCapabilityMatches SKIPPED (no capability profile — no assessments evidence) --')
      }
    } catch (e) {
      console.log('\n-- 5. Career Intelligence FAILED --')
      console.log(e)
    }

    // ── 6. Holiday Planner ───────────────────────────────────────────────
    try {
      const holidayPlan = await generateHolidayPlan({
        studentId:     student.id,
        teacherId:     '45699ad6-f89c-4376-985f-31730a341801',
        term:          2,
        year:          2026,
        holidayPeriod: 'August Holiday 2026',
        holidayDays:   14,
      })
      console.log('\n-- 6. Holiday Planner output --')
      console.log('priority_gaps:', holidayPlan.priority_gaps)
      console.log('evidence_confidence:', holidayPlan.evidence_confidence)
      console.log('parent_summary:', holidayPlan.parent_summary)
    } catch (e) {
      console.log('\n-- 6. Holiday Planner FAILED --')
      console.log(e)
    }

    // ── 7. Monday Panel / Attention Feed — risk from Projection vs Learner Model ──
    try {
      const legacyProfile = await getOrCreateLearnerProfile(student.id)
      console.log('\n-- 7a. Learner Model (legacy learner_profiles) risk --')
      console.log('overall_risk_level:', legacyProfile.overall_risk_level)
      console.log('risk_flags:', JSON.stringify(legacyProfile.risk_flags, null, 2))

      console.log('\n-- 7b. Projection risk (same student, side by side) --')
      console.log('projection.risk.value.overallRiskLevel:', projection?.risk?.value.overallRiskLevel ?? '(no projection risk)')

      const panel = await buildTeacherPanel(student.classId, '45699ad6-f89c-4376-985f-31730a341801')
      const item = panel.students_needing_attention.find(s => s.student_id === student.id)
      console.log('\n-- 7c. Monday Panel students_needing_attention entry for this student --')
      console.log(item ?? '(not in attention list — risk normal or not in top 10)')
    } catch (e) {
      console.log('\n-- 7. Monday Panel FAILED --')
      console.log(e)
    }

    console.log('\n(Remedial Planner requires a real sowId/strand/subStrand tied to a scheme of work; see separate remedial trace below if this class has one.)')
  }

  // ── 8. Remedial Planner — separate section, needs sowId ──────────────
  hr('REMEDIAL PLANNER TRACE (Beta Testers class — has real sowId)')
  try {
    const CLASS_ID = '024a5fc3-812e-4358-ad97-6561ebbe0bc6'
    const TEACHER_ID = '45699ad6-f89c-4376-985f-31730a341801'
    const { data: sow } = await db
      .from('scheme_of_work')
      .select('id, subject, term, year')
      .eq('class_id', CLASS_ID)
      .limit(1)
      .maybeSingle()
    console.log('sow row found:', sow)

    if (sow) {
      const plan = await generateRemedialPlan({
        sowId:      sow.id,
        teacherId:  TEACHER_ID,
        classId:    CLASS_ID,
        strand:     'Numbers',
        subStrand:  'Fractions',
        subject:    sow.subject ?? 'mathematics',
        term:       sow.term ?? 2,
        year:       sow.year ?? 2026,
        currentWeek: 5,
        weeksRemaining: 5,
      })
      console.log('Remedial groups (level per student):', JSON.stringify(plan.groups, null, 2))
    } else {
      console.log('No scheme_of_work row for Beta Testers class — cannot call generateRemedialPlan with a real sowId.')
    }
  } catch (e) {
    console.log('Remedial Planner FAILED')
    console.log(e)
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
