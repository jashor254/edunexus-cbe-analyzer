// lib/remedial/planner.ts
// Generates a differentiated remedial plan for a class.
// Input:  substrand health + learner marks + learner models + knowledge graph
// Output: 3-4 student groups with specific actions per group, teacher allocation,
//         Compass assignments, peer pairings — based on real data, not guesses.

import { repos } from '@/lib/repositories'
import { callDeepSeek } from '@/lib/ai/deepseek'
import { getClassLearnerProfiles } from '@/lib/learnerModel/queries'
import type { RemedialGroup, RemedialPlan, RemedialStudent, TeacherAllocation } from './types'

type PlannerInput = {
  sowId:      string
  teacherId:  string
  classId:    string
  strand:     string
  subStrand:  string
  subject:    string
  term:       number
  year:       number
  currentWeek: number
  weeksRemaining: number
}

export async function generateRemedialPlan(input: PlannerInput): Promise<RemedialPlan> {
  // 1. Get substrand health record
  const health = await repos.learnerIntelligence.getSubstrandHealthSingle(input.sowId, input.strand, input.subStrand)

  // 2. Get all learner marks for this class — latest assessment for this subject
  const latestAssessment = await repos.assessments.findLatestAssessmentForClass(input.teacherId, input.classId)

  let marks: Array<{ student_name: string; student_id: string | null; subject_scores: Record<string, number> }> = []
  if (latestAssessment?.id) {
    marks = await repos.assessments.findMarksByAssessmentForRemedial(latestAssessment.id, input.teacherId)
  }

  // 3. Get learner profiles for this class
  const profiles = await getClassLearnerProfiles(input.classId)
  const profileMap = new Map(profiles.map(p => [p.student_id, p]))

  // 4. Get prerequisite concepts from knowledge graph
  const currentNode = await repos.knowledgeGraph.findNodeByConceptLike(input.subStrand)

  let prerequisiteConcepts: string[] = []
  if (currentNode?.node_id) {
    // getPrerequisiteEdges filters on the text node_id (e.g. 'G7-MAT-NUM-T02'),
    // not the uuid primary key — passing currentNode.id here silently
    // returned zero edges every time.
    const prereqEdges = await repos.knowledgeGraph.getPrerequisiteEdges(currentNode.node_id)
    if (prereqEdges.length) {
      const prereqIds = prereqEdges.map(e => e.prerequisite_node_id as string)
      const prereqNodes = await repos.knowledgeGraph.getNodesByIds(prereqIds)
      prerequisiteConcepts = prereqNodes.map(n => n.name)
    }
  }

  // 5. Get enrolled students (even without linked accounts)
  const enrollmentIds = await repos.learnerIntelligence.getClassEnrollment(input.classId)
  const enrolledIds = new Set(enrollmentIds)

  // 6. Classify each student by their gap severity
  const maxScore = latestAssessment?.max_score ?? 100
  const subjectKey = input.subject

  type StudentData = {
    name:       string
    student_id: string | null
    score:      number | null   // 0–100 raw mark
    level:      number          // 1–4 CBC level
    rootCause:  string | null
    flags:      number          // risk flag count
  }

  const students: StudentData[] = marks.map(m => {
    const raw     = (m.subject_scores[subjectKey] ?? m.subject_scores[Object.keys(m.subject_scores)[0]] ?? 0) as number
    const pct     = maxScore > 0 ? (raw / maxScore) * 100 : raw
    const level   = pct >= 75 ? 4 : pct >= 50 ? 3 : pct >= 25 ? 2 : 1
    const profile = m.student_id ? profileMap.get(m.student_id) : null
    const flags   = profile?.risk_flags?.length ?? 0
    const rootCause = health?.root_cause ?? null

    return { name: m.student_name, student_id: m.student_id, score: pct, level, rootCause, flags }
  })

  // Also include enrolled students with no marks
  for (const id of enrolledIds) {
    if (!students.some(s => s.student_id === id)) {
      const profile = profileMap.get(id)
      if (profile) {
        students.push({ name: `Student (${id.slice(-4)})`, student_id: id, score: null, level: 1, rootCause: null, flags: profile.risk_flags?.length ?? 0 })
      }
    }
  }

  // 7. Build groups based on classification
  const criticalStudents  = students.filter(s => s.level === 1 && s.flags >= 2)
  const prereqStudents    = students.filter(s => s.level <= 2 && !criticalStudents.includes(s))
  const confusedStudents  = students.filter(s => s.level === 3)
  const onTrackStudents   = students.filter(s => s.level === 4)

  // Build peer pairs: match on-track students with prereq-gap students
  const peerPairs: [string, string][] = []
  const helpers = [...onTrackStudents]
  for (let i = 0; i < Math.min(prereqStudents.length, helpers.length); i++) {
    peerPairs.push([helpers[i].name, prereqStudents[i].name])
  }

  const toStudent = (s: StudentData, gap: string): RemedialStudent => ({
    student_id:    s.student_id,
    student_name:  s.name,
    gap_detail:    gap,
    root_cause:    s.rootCause,
    compass_topic: input.subStrand,
  })

  const groups: RemedialGroup[] = []

  if (criticalStudents.length > 0) {
    groups.push({
      type:    'critical_gap',
      label:   `Group D — Needs Direct Support (${criticalStudents.length} students)`,
      students: criticalStudents.map(s => toStudent(s, `Multiple prerequisite gaps — missing foundational concepts`)),
      teaching_action: 'One-on-one or very small group. Start from prerequisites, not current substrand.',
      compass_action:  prerequisiteConcepts[0] ?? input.subStrand,
      lessons_needed:  3,
      suggested_activity: `Individual diagnostic: ask each student to explain ${prerequisiteConcepts[0] ?? input.subStrand} in their own words to locate exact gap.`,
    })
  }

  if (prereqStudents.length > 0) {
    groups.push({
      type:    'prerequisite_gap',
      label:   `Group A — Prerequisite Gap (${prereqStudents.length} students)`,
      students: prereqStudents.map(s => toStudent(s, `Missing: ${prerequisiteConcepts[0] ?? 'foundational concept'}`)),
      teaching_action: `Re-teach ${prerequisiteConcepts[0] ?? input.subStrand} first (2 lessons), then return to ${input.subStrand}.`,
      compass_action:  prerequisiteConcepts[0] ?? input.subStrand,
      peer_pairs:      peerPairs,
      lessons_needed:  2,
      suggested_activity: prerequisiteConcepts[0]
        ? `Practical activity on ${prerequisiteConcepts[0]} before returning to ${input.subStrand}.`
        : `Diagnostic questions to locate exact gap in ${input.subStrand}.`,
    })
  }

  if (confusedStudents.length > 0) {
    groups.push({
      type:    'concept_confusion',
      label:   `Group B — Concept Confusion (${confusedStudents.length} students)`,
      students: confusedStudents.map(s => toStudent(s, `Understands basics but confused on ${input.subStrand} application`)),
      teaching_action: `1 focused lesson with worked examples and peer discussion on ${input.subStrand}.`,
      compass_action:  input.subStrand,
      lessons_needed:  1,
      suggested_activity: `Diagram or diagram comparison activity. Ask Group B to explain the concept to Group A after mastering it.`,
    })
  }

  if (onTrackStudents.length > 0) {
    groups.push({
      type:    'on_track',
      label:   `Group C — On Track (${onTrackStudents.length} students)`,
      students: onTrackStudents.map(s => toStudent(s, 'Meets expectations — ready for extension')),
      teaching_action: `Extension activity: deeper application of ${input.subStrand}. Use as peer teachers for Groups A & B.`,
      lessons_needed:  0,
      suggested_activity: `Cross-curricular project connecting ${input.subStrand} to real Kenya context. Let them lead a 10-min peer explanation.`,
    })
  }

  // 8. Build teacher allocation
  const totalLessons = groups.reduce((s, g) => s + g.lessons_needed, 0)
  const weeksNeeded  = Math.ceil(totalLessons / 2)
  const checkInWeek  = input.currentWeek + weeksNeeded + 1

  const weekPlan: string[] = []
  let week = input.currentWeek
  for (const group of groups.filter(g => g.type !== 'on_track')) {
    for (let l = 0; l < group.lessons_needed; l += 2) {
      weekPlan.push(`Week ${week}: ${group.label.split('—')[0].trim()} — ${group.suggested_activity.slice(0, 80)}`)
      week++
    }
  }
  weekPlan.push(`Week ${checkInWeek}: Re-assessment — measure recovery across all groups`)

  const allocation: TeacherAllocation = {
    total_remedial_weeks: weeksNeeded,
    week_by_week:         weekPlan,
    compass_assignments:  prereqStudents.length + criticalStudents.length + confusedStudents.length,
    check_in_week:        checkInWeek,
  }

  // 9. Enrich with AI — convert the structured plan into a clear teacher narrative
  const aiSummary = await enrichWithAI(groups, allocation, input, prerequisiteConcepts)
  if (aiSummary) {
    allocation.week_by_week = aiSummary.weekPlan ?? allocation.week_by_week
  }

  const plan: RemedialPlan = {
    sow_id:      input.sowId,
    teacher_id:  input.teacherId,
    class_id:    input.classId,
    term:        input.term,
    year:        input.year,
    week_start:  input.currentWeek,
    week_end:    checkInWeek,
    subject:     input.subject,
    strand:      input.strand,
    sub_strand:  input.subStrand,
    groups,
    allocation,
    generated_at: new Date().toISOString(),
  }

  // 10. Persist
  const savedId = await repos.learnerIntelligence.upsertRemedialPlan({
    sow_id:     plan.sow_id,
    teacher_id: plan.teacher_id,
    class_id:   plan.class_id,
    term:       plan.term,
    year:       plan.year,
    week_start: plan.week_start,
    week_end:   plan.week_end,
    subject:    plan.subject,
    strand:     plan.strand,
    sub_strand: plan.sub_strand,
    groups:     plan.groups,
    allocation: plan.allocation,
    check_in_week: allocation.check_in_week,
  })

  if (savedId) plan.id = savedId

  return plan
}

// ── AI enrichment — improves the week-by-week plan language ──────────────────

async function enrichWithAI(
  groups:       RemedialGroup[],
  allocation:   TeacherAllocation,
  input:        PlannerInput,
  prerequisites: string[],
): Promise<{ weekPlan: string[] } | null> {
  try {
    const groupSummary = groups
      .filter(g => g.type !== 'on_track')
      .map(g => `${g.label}: ${g.students.length} students — ${g.suggested_activity}`)
      .join('\n')

    const prompt = `You are helping a Kenyan CBC teacher build a remedial teaching plan.

Subject: ${input.subject}
Strand: ${input.strand}
Sub-strand: ${input.subStrand}
${prerequisites.length ? `Prerequisite concepts: ${prerequisites.join(', ')}` : ''}
Weeks available for remediation: ${allocation.total_remedial_weeks}

Student groups identified:
${groupSummary}

Write a ${allocation.total_remedial_weeks + 1}-week plan as a simple numbered list.
Each week: one clear sentence telling the teacher exactly what to do and with which group.
Week ${allocation.check_in_week}: always ends with a re-assessment of all groups.
Use plain English. No bullet sub-points. No markdown headers. Keep each sentence under 120 characters.`

    const response = await callDeepSeek(prompt, undefined, {
      maxTokens:   400,
      temperature: 0.3,
    })

    const lines = response
      .split('\n')
      .map(l => l.replace(/^\d+\.\s*/, '').trim())
      .filter(l => l.length > 10)

    return lines.length > 1 ? { weekPlan: lines } : null
  } catch {
    return null  // AI enrichment is best-effort — structured plan still returned
  }
}
