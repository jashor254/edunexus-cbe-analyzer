// lib/learningSignal/didLearningTakePlace.ts
// Layer 1 — the universal "did learning take place" primitive.
//
// Graph-free and subject/grade agnostic by design: this module must NEVER
// import from lib/knowledgeGraph. It answers one question, for any subject:
// between two timepoints, did this learner's rating on each topic go up,
// stay flat, or regress — and did any topic cross from "not yet meeting
// expectations" to "meeting expectations" (the CBC threshold)?
//
// The comparison logic (computeLearningDeltas) is pure and unit-tested in
// isolation from the DB. The two exported async functions are thin wrappers
// that fetch rows and hand them to the pure function.

import { repos } from '@/lib/repositories'
import type { StrandAssessmentSample } from '@/lib/repositories/learning-signal.repository'
import type {
  TopicLearningDelta,
  LearnerLearningReport,
  ClassTopicAggregate,
  ClassLearningReport,
} from './types'

// Same CBC convention as lib/knowledgeGraph/traversal.ts's MASTERY_THRESHOLD —
// intentionally redefined here, not imported, to keep this module graph-free.
const MASTERY_THRESHOLD = 3

// ── Pure core ──────────────────────────────────────────────────────────────────

/**
 * Groups strand_assessments rows (already filtered to one learner/subject/
 * grade/date-range, any order) by (strand, topic) and compares the earliest
 * vs. latest rating in range per topic.
 *
 * A topic with only one sample in range is reported as 'insufficient_data' —
 * a single snapshot can't tell you whether learning happened between two
 * timepoints, only that the learner was somewhere at some point.
 */
export function computeLearningDeltas(rows: StrandAssessmentSample[]): TopicLearningDelta[] {
  const byTopic = new Map<string, StrandAssessmentSample[]>()
  for (const row of rows) {
    const key = `${row.strand}|${row.topic}`
    const list = byTopic.get(key) ?? []
    list.push(row)
    byTopic.set(key, list)
  }

  const results: TopicLearningDelta[] = []

  for (const [key, samples] of byTopic) {
    const [strand, topic] = key.split('|')
    const sorted = [...samples].sort((a, b) => a.created_at.localeCompare(b.created_at))

    if (sorted.length < 2) {
      results.push({
        topic, strand,
        ratingT1: sorted[0]?.rating ?? null,
        ratingT2: null,
        delta: null,
        movement: 'insufficient_data',
        crossedThreshold: false,
      })
      continue
    }

    const ratingT1 = sorted[0].rating
    const ratingT2 = sorted[sorted.length - 1].rating
    const delta    = ratingT2 - ratingT1

    results.push({
      topic, strand,
      ratingT1, ratingT2, delta,
      movement: delta > 0 ? 'movedUp' : delta < 0 ? 'regressed' : 'flat',
      crossedThreshold: ratingT1 < MASTERY_THRESHOLD && ratingT2 >= MASTERY_THRESHOLD,
    })
  }

  return results.sort((a, b) => a.strand.localeCompare(b.strand) || a.topic.localeCompare(b.topic))
}

/** Aggregates a set of per-learner reports into per-topic class statistics. */
export function aggregateClassLearningDeltas(
  reports: TopicLearningDelta[][],
): ClassTopicAggregate[] {
  const byTopic = new Map<string, { strand: string; deltas: TopicLearningDelta[] }>()

  for (const report of reports) {
    for (const d of report) {
      const key = `${d.strand}|${d.topic}`
      const entry = byTopic.get(key) ?? { strand: d.strand, deltas: [] }
      entry.deltas.push(d)
      byTopic.set(key, entry)
    }
  }

  const results: ClassTopicAggregate[] = []
  for (const [key, { strand, deltas }] of byTopic) {
    const [, topic] = key.split('|')
    const usable = deltas.filter(d => d.movement !== 'insufficient_data')
    const movedUp   = usable.filter(d => d.movement === 'movedUp').length
    const flat      = usable.filter(d => d.movement === 'flat').length
    const regressed = usable.filter(d => d.movement === 'regressed').length

    results.push({
      topic, strand,
      learnerCount:   usable.length,
      movedUpCount:   movedUp,
      flatCount:      flat,
      regressedCount: regressed,
      pctMovedUp:     usable.length > 0 ? Math.round((movedUp / usable.length) * 100) : 0,
    })
  }

  return results.sort((a, b) => a.strand.localeCompare(b.strand) || a.topic.localeCompare(b.topic))
}

// ── Thin DB-fetching wrappers ──────────────────────────────────────────────────

export async function didLearningTakePlace(
  learnerId: string,
  subject:   string,
  grade:     number,
  fromDate:  string,
  toDate:    string,
): Promise<LearnerLearningReport> {
  const rows = await repos.learningSignal.getStrandAssessmentsInRange(learnerId, subject, grade, fromDate, toDate)
  return {
    learnerId, subject, grade, fromDate, toDate,
    topics: computeLearningDeltas(rows),
  }
}

export async function didLearningTakePlaceForClass(
  classId:  string,
  subject:  string,
  grade:    number,
  fromDate: string,
  toDate:   string,
): Promise<ClassLearningReport> {
  const learnerIds = await repos.learnerIntelligence.getClassEnrollment(classId)

  const perLearner = await Promise.all(
    learnerIds.map(id => repos.learningSignal.getStrandAssessmentsInRange(id, subject, grade, fromDate, toDate)),
  )

  const reports = perLearner.map(rows => computeLearningDeltas(rows))

  return {
    classId, subject, grade, fromDate, toDate,
    topics: aggregateClassLearningDeltas(reports),
  }
}
