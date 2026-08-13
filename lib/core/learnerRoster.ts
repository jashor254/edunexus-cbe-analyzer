// lib/core/learnerRoster.ts
//
// Bulk learner roster import — the last P0 in the School YES → LIVE journey.
//
// A 400-learner school cannot be onboarded one learner at a time, and the
// alternative was SQL. This takes the file a school administrator already has
// (Excel/Sheets → Save as CSV) and turns it into canonical `learners` rows
// owned by the right school.
//
// WHAT IT REUSES, AND WHAT IT DOES NOT
// The canonical institutional learner is `learners` (school-scoped, created by
// lib/core/learners.ts::admitLearner). The legacy `students` table has its own
// consumer-oriented creation path (app/api/students/create — plan limits,
// parent ownership, no school) which is NOT the institutional contract and is
// deliberately untouched here.
//
// This import applies exactly `admitLearner`'s definition of a valid learner —
// same AdmitLearnerInput, same defaults — batched rather than reinterpreted.
// It deliberately does NOT call admitLearner() itself, because that function's
// guardian branch fires createGuardianInvite(); roster import creates no
// guardians (see PII minimisation below), so it uses the same repository
// insert with no guardian input.
//
// WHAT IT NEVER WRITES
// No learner_evidence, no projections, no Blueprint, no Compass, no career
// intelligence, no guardians, no classes. Creating a learner is not evidence
// about that learner. A freshly imported learner correctly begins with
// "insufficient evidence" — that is truthful, and fabricating anything from
// roster metadata would poison the intelligence layer at its source.

import Papa from 'papaparse'
import { repos } from '@/lib/repositories'
import { getCurrentTerm } from '@/lib/core/school'
import { listClasses } from '@/lib/core/classes'
import { logger } from '@/lib/observability/logger'
import type { AdmitLearnerInput, Gender } from '@/types/core'

// ── Format ───────────────────────────────────────────────────────────────────
//
// Only columns the canonical learner contract actually needs, plus one
// optional convenience (class). Everything else `learners` can hold —
// date_of_birth, upi, county_of_origin, notes, special_needs, photo — is
// deliberately absent: none is required to create an operational learner, and
// a roster import is the wrong place to collect data the school has not been
// asked for. No guardian names, phones, addresses, national IDs or medical
// information are accepted at any point in this flow.

export const ROSTER_COLUMNS = ['admission_number', 'first_name', 'last_name', 'middle_name', 'gender', 'class'] as const
export const REQUIRED_ROSTER_COLUMNS = ['admission_number', 'first_name', 'last_name'] as const

/** Clearly fictional sample rows — never seeded with real learner information. */
export const ROSTER_TEMPLATE_CSV =
  'admission_number,first_name,last_name,middle_name,gender,class\n' +
  'ADM001,Asha,Mwangi,Nyokabi,female,Grade 7 East\n' +
  'ADM002,Brian,Otieno,,male,Grade 7 East\n' +
  'ADM003,Faith,Njeri,Wambui,female,Grade 8 North\n'

/** Pilot-scale bounds. Not million-row ingestion infrastructure. */
export const MAX_ROSTER_ROWS = 1500
export const MAX_ROSTER_BYTES = 1_000_000

export type RosterVerdict = 'new' | 'already_exists' | 'duplicate_in_file' | 'invalid'

export type RosterRow = {
  /** 1-based data row number as the admin sees it in their spreadsheet (header excluded). */
  rowNumber: number
  admissionNumber: string
  firstName: string
  middleName: string | null
  lastName: string
  gender: Gender | null
  className: string | null
  resolvedClassId: string | null
  verdict: RosterVerdict
  /** Human-readable reasons, safe to show a school admin. Never a raw DB error. */
  issues: string[]
}

export type RosterAnalysis = {
  rows: RosterRow[]
  /** Fatal problems with the file itself — nothing can be imported. */
  fileIssues: string[]
  summary: {
    total: number
    new: number
    alreadyExists: number
    duplicateInFile: number
    invalid: number
    willEnroll: number
  }
  /** True when the school has a current term, i.e. the `class` column can do anything. */
  enrollmentAvailable: boolean
  currentTermName: string | null
}

export type RosterImportResult = {
  analysis: RosterAnalysis
  created: number
  enrolled: number
  skippedExisting: number
  skippedInvalid: number
}

const normalise = (v: string | undefined | null): string => (v ?? '').trim()
const normaliseKey = (v: string): string => v.trim().toLowerCase().replace(/\s+/g, ' ')

// ── Parse + validate ─────────────────────────────────────────────────────────

/**
 * Parses and validates a roster without writing anything.
 *
 * Used by BOTH preview and import: the commit path re-runs this from the same
 * raw CSV rather than trusting a client-supplied "accepted rows" list, so the
 * browser cannot smuggle a row past validation or claim a school it does not
 * own. Preview and import therefore cannot disagree.
 */
export async function analyseLearnerRoster(schoolId: string, csv: string): Promise<RosterAnalysis> {
  const empty = (fileIssues: string[]): RosterAnalysis => ({
    rows: [], fileIssues,
    summary: { total: 0, new: 0, alreadyExists: 0, duplicateInFile: 0, invalid: 0, willEnroll: 0 },
    enrollmentAvailable: false, currentTermName: null,
  })

  if (csv.length > MAX_ROSTER_BYTES) {
    return empty([`File is too large. Please import at most ${MAX_ROSTER_BYTES / 1000}KB (about ${MAX_ROSTER_ROWS} learners) at a time.`])
  }

  // papaparse, not a hand-rolled split(',') — a name like "Otieno, Brian" or a
  // quoted field would silently shift every column after it. This mirrors the
  // parser choice lib/intelligence/csvSource.ts already standardised on.
  const parsed = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: 'greedy',   // ignores blank and whitespace-only rows
    transformHeader: h => h.trim().toLowerCase(),
  })

  const headers = parsed.meta.fields ?? []
  const missing = REQUIRED_ROSTER_COLUMNS.filter(c => !headers.includes(c))
  if (missing.length > 0) {
    return empty([
      `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. ` +
      `Expected a header row with: ${ROSTER_COLUMNS.join(', ')}.`,
    ])
  }

  const duplicateHeaders = headers.filter((h, i) => headers.indexOf(h) !== i)
  if (duplicateHeaders.length > 0) {
    return empty([`Duplicate column${duplicateHeaders.length > 1 ? 's' : ''}: ${[...new Set(duplicateHeaders)].join(', ')}. Each column may appear once.`])
  }

  if (parsed.data.length === 0) return empty(['The file has a header row but no learners.'])
  if (parsed.data.length > MAX_ROSTER_ROWS) {
    return empty([`This file has ${parsed.data.length} rows. Please import at most ${MAX_ROSTER_ROWS} learners at a time.`])
  }

  // Class resolution: match names the school already has. Roster import never
  // CREATES a class — activateSchool() already provisions them, and inventing
  // a class from a spelling in a spreadsheet would be a guess.
  const [classes, currentTerm] = await Promise.all([
    listClasses(schoolId),
    getCurrentTerm(schoolId).catch(() => null),
  ])
  // BOTH name columns are nullable, and a school activated through
  // activateSchool() carries its label in display_name with class_name NULL —
  // so indexing on class_name alone threw on the whole file before a single
  // row was read. Every name a school might legitimately be using is indexed;
  // a class with neither is simply unmatchable, which is not a crash.
  const classByName = new Map<string, string>()
  for (const c of classes) {
    for (const name of [c.display_name, c.class_name]) {
      const key = normalise(name)
      if (key) classByName.set(normaliseKey(key), c.id)
    }
  }
  const enrollmentAvailable = currentTerm !== null && classes.length > 0

  const rows: RosterRow[] = []
  const seenInFile = new Map<string, number>()

  parsed.data.forEach((raw, i) => {
    const rowNumber = i + 1
    const issues: string[] = []

    const admissionNumber = normalise(raw.admission_number)
    const firstName       = normalise(raw.first_name)
    const lastName        = normalise(raw.last_name)
    const middleName      = normalise(raw.middle_name) || null
    const genderRaw       = normalise(raw.gender).toLowerCase()
    const className       = normalise(raw.class) || null

    if (!admissionNumber) issues.push('Admission number is required.')
    if (!firstName)       issues.push('First name is required.')
    if (!lastName)        issues.push('Last name is required.')

    let gender: Gender | null = null
    if (genderRaw) {
      // Only the three values the database accepts. Never inferred from a name.
      if (genderRaw === 'male' || genderRaw === 'female' || genderRaw === 'other') {
        gender = genderRaw
      } else {
        issues.push(`Gender "${normalise(raw.gender)}" is not recognised. Use male, female, other, or leave it blank.`)
      }
    }

    let resolvedClassId: string | null = null
    if (className) {
      resolvedClassId = classByName.get(normaliseKey(className)) ?? null
      if (!resolvedClassId) {
        // Same precedence as the index above, and unnameable classes are left
        // out entirely — a school activated with display_name only would
        // otherwise be told "Existing classes: , , , ,".
        const nameable = classes.map(c => normalise(c.display_name) || normalise(c.class_name)).filter(Boolean)
        const available = nameable.slice(0, 8).join(', ')
        issues.push(
          `Class "${className}" does not exist at this school.` +
          (available ? ` Existing classes: ${available}${nameable.length > 8 ? '…' : ''}.` : ' This school has no classes yet.')
        )
      } else if (!currentTerm) {
        issues.push('This school has no current term set, so learners cannot be placed in a class yet. Leave the class column blank to import them without a class.')
      }
    }

    let verdict: RosterVerdict = issues.length > 0 ? 'invalid' : 'new'

    if (verdict === 'new') {
      const key = normaliseKey(admissionNumber)
      const firstSeen = seenInFile.get(key)
      if (firstSeen !== undefined) {
        verdict = 'duplicate_in_file'
        issues.push(`Admission number ${admissionNumber} also appears on row ${firstSeen}. Only the first will be imported.`)
      } else {
        seenInFile.set(key, rowNumber)
      }
    }

    rows.push({ rowNumber, admissionNumber, firstName, middleName, lastName, gender, className, resolvedClassId, verdict, issues })
  })

  // Existing-roster check: one batched query against the school's real
  // admission numbers. This is what makes re-uploading the same file safe.
  const candidates = rows.filter(r => r.verdict === 'new').map(r => r.admissionNumber)
  const existing = await repos.learners.findExistingAdmissionNumbers(schoolId, candidates)
  for (const row of rows) {
    if (row.verdict === 'new' && existing.has(row.admissionNumber)) {
      row.verdict = 'already_exists'
      row.issues.push(`A learner with admission number ${row.admissionNumber} is already on this school's roster. This row will be skipped.`)
    }
  }

  const summary = {
    total:            rows.length,
    new:              rows.filter(r => r.verdict === 'new').length,
    alreadyExists:    rows.filter(r => r.verdict === 'already_exists').length,
    duplicateInFile:  rows.filter(r => r.verdict === 'duplicate_in_file').length,
    invalid:          rows.filter(r => r.verdict === 'invalid').length,
    willEnroll:       rows.filter(r => r.verdict === 'new' && r.resolvedClassId !== null).length,
  }

  return {
    rows,
    fileIssues: [],
    summary,
    enrollmentAvailable,
    currentTermName: currentTerm?.name ?? null,
  }
}

// ── Import ───────────────────────────────────────────────────────────────────

/**
 * Imports the NEW rows of a validated roster.
 *
 * CONSISTENCY MODEL — idempotent-resumable, not all-or-nothing.
 * There is no multi-statement transaction available to the Supabase JS client
 * without an RPC, and an RPC is not worth a migration here, because the domain
 * already has something better: UNIQUE (school_id, admission_number). If a
 * chunk fails partway, the admin re-uploads the same file — every learner
 * already created comes back as `already_exists` and is skipped, and the rest
 * are created. All-or-nothing would instead throw away 399 good rows because
 * row 400 was malformed, and offers nothing extra for a roster.
 *
 * Nothing is written unless the row passed validation in THIS call.
 */
export async function importLearnerRoster(schoolId: string, csv: string): Promise<RosterImportResult> {
  const analysis = await analyseLearnerRoster(schoolId, csv)

  if (analysis.fileIssues.length > 0) {
    return { analysis, created: 0, enrolled: 0, skippedExisting: 0, skippedInvalid: 0 }
  }

  const toCreate = analysis.rows.filter(r => r.verdict === 'new')
  if (toCreate.length === 0) {
    return {
      analysis, created: 0, enrolled: 0,
      skippedExisting: analysis.summary.alreadyExists,
      skippedInvalid:  analysis.summary.invalid + analysis.summary.duplicateInFile,
    }
  }

  const inputs: AdmitLearnerInput[] = toCreate.map(r => ({
    admission_number: r.admissionNumber,
    first_name:       r.firstName,
    middle_name:      r.middleName ?? undefined,
    last_name:        r.lastName,
    gender:           r.gender ?? undefined,
  }))

  const created = await repos.learners.insertMany(schoolId, inputs)

  // Enrollment, only for rows that named a class the school actually has.
  let enrolled = 0
  const currentTerm = await getCurrentTerm(schoolId).catch(() => null)
  if (currentTerm) {
    const byAdmission = new Map(created.map(l => [l.admission_number, l.id]))
    const enrollments = toCreate
      .filter(r => r.resolvedClassId !== null)
      .map(r => ({
        school_id:        schoolId,
        learner_id:       byAdmission.get(r.admissionNumber)!,
        class_id:         r.resolvedClassId!,
        term_id:          currentTerm.id,
        academic_year_id: currentTerm.academic_year_id,
      }))
      .filter(e => e.learner_id !== undefined)

    enrolled = await repos.learners.upsertEnrollments(enrollments)
  }

  logger.info('importLearnerRoster: roster imported', {
    service:   'core-learner-roster',
    school_id: schoolId,
    created:   created.length,
    enrolled,
    skipped_existing: analysis.summary.alreadyExists,
    skipped_invalid:  analysis.summary.invalid + analysis.summary.duplicateInFile,
  })

  return {
    analysis,
    created:         created.length,
    enrolled,
    skippedExisting: analysis.summary.alreadyExists,
    skippedInvalid:  analysis.summary.invalid + analysis.summary.duplicateInFile,
  }
}
