// lib/intelligence/identityResolution.ts
// One shared learner-identity-resolution routine, per
// docs/architecture/intelligence-ingestion-engine.md §5: every ingestion
// source resolves identity through this function rather than inventing its
// own ad hoc matching (the mistake found in three separate legacy CSV
// features — admission-number lookup against a column that doesn't exist,
// case-insensitive name matching, and manual form entry, none shared).
//
// Scoped to matching against EXISTING students only. This routine does not
// create new learner records — Phase 1 assumes the learner already has an
// EduNexus account (a stronger assumption than a full roster importer would
// make, deliberately, to keep this slice small).

import { repos } from '@/lib/repositories'
import type { StudentIdentityCandidate } from '@/lib/repositories/intelligence.repository'
import { asStudentId, type StudentId } from '@/lib/core/identityTypes'

export type IdentityMatchType = 'external_id' | 'exact_name_grade' | 'fuzzy_name' | 'none'

export type IdentityResolution = {
  /**
   * IDENTITY-1 (2026-08-14): this field was named `learnerId` while every
   * value it has ever carried came from a `students` query (see
   * `intelligence.repository.findStudentsBy*`, which selects `.from('students')`).
   * A reader reasonably assumed a Core `learners.id`. Renamed to match the
   * domain it actually resolves against; the roster this matches on IS the
   * legacy student roster.
   */
  studentId:  StudentId | null
  confidence: number   // 0-100
  matchType:  IdentityMatchType
}

export type IdentityCandidateInput = {
  name:        string
  externalId?: string | null
  grade?:      number | null
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const prev = Array.from({ length: n + 1 }, (_, i) => i)
  const curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

function nameSimilarity(a: string, b: string): number {
  const normA = a.trim().toLowerCase().replace(/\s+/g, ' ')
  const normB = b.trim().toLowerCase().replace(/\s+/g, ' ')
  if (normA === normB) return 1
  const distance = levenshtein(normA, normB)
  const maxLen = Math.max(normA.length, normB.length)
  if (maxLen === 0) return 0
  return 1 - distance / maxLen
}

/**
 * Resolves one candidate against a pre-fetched roster (the caller batches
 * roster fetches per teacher rather than round-tripping per row — see
 * pipeline.ts).
 */
export function resolveAgainstRoster(
  candidate: IdentityCandidateInput,
  roster:    StudentIdentityCandidate[],
): IdentityResolution {
  // 1. External ID — exact, unambiguous, highest confidence.
  if (candidate.externalId) {
    const match = roster.find(s => s.external_id === candidate.externalId)
    if (match) return { studentId: asStudentId(match.id), confidence: 100, matchType: 'external_id' }
  }

  // 2. Exact name (case/whitespace-insensitive) + grade match.
  const exactMatches = roster.filter(s =>
    s.name.trim().toLowerCase() === candidate.name.trim().toLowerCase() &&
    (candidate.grade == null || s.grade === candidate.grade),
  )
  if (exactMatches.length === 1) {
    return { studentId: asStudentId(exactMatches[0].id), confidence: 90, matchType: 'exact_name_grade' }
  }
  if (exactMatches.length > 1) {
    // Ambiguous — same name, same grade, multiple students. Never guess.
    return { studentId: null, confidence: 0, matchType: 'none' }
  }

  // 3. Fuzzy name match — flagged for review, never auto-confirmed.
  const scored = roster
    .filter(s => candidate.grade == null || s.grade === candidate.grade)
    .map(s => ({ student: s, similarity: nameSimilarity(candidate.name, s.name) }))
    .sort((a, b) => b.similarity - a.similarity)

  const best = scored[0]
  if (best && best.similarity >= 0.75) {
    return {
      studentId:  asStudentId(best.student.id),
      confidence: Math.round(best.similarity * 60), // capped well below auto-confirm threshold — see confidence.ts
      matchType:  'fuzzy_name',
    }
  }

  return { studentId: null, confidence: 0, matchType: 'none' }
}

export async function fetchRosterForTeacher(teacherId: string): Promise<StudentIdentityCandidate[]> {
  return repos.intelligence.findStudentsByTeacher(teacherId)
}
