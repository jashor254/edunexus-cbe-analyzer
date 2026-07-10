// lib/projection/batch.ts
// Batch/whole-class recomputation entry points. Built on
// recomputeLearnerProjections' bounded-concurrency worker pool (recompute.ts)
// — the same function scales from "one learner" to "a few hundred," the
// realistic ceiling for synchronous in-process execution.
//
// Honest scope note: true district/national scale (potentially millions of
// learners) needs actual queue/worker infrastructure per Constitution
// Principle 14 ("long-running operations happen in background jobs, not in
// request handlers") — not built here. What IS built is queue-ready:
// recomputeLearnerProjection (singular, recompute.ts) operates on one
// learner with no shared state, so a future worker can call it per queued
// learner ID without any redesign of the computation itself.

import { repos } from '@/lib/repositories'
import { recomputeLearnerProjections } from './recompute'

/** Recomputes projections for every student on one teacher's roster (the "whole class/school" scope available in the legacy schema). */
export async function recomputeForTeacher(teacherId: string): Promise<{ learnerCount: number }> {
  const roster = await repos.intelligence.findStudentsByTeacher(teacherId)
  const learnerIds = roster.map(s => s.id)
  await recomputeLearnerProjections(learnerIds)
  return { learnerCount: learnerIds.length }
}
