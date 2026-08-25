export function gradeLabel(grade: number): string {
  if (grade === 11) return 'Form 3'
  if (grade === 12) return 'Form 4'
  return `Grade ${grade}`
}

export function curriculumBadge(grade: number): string {
  if (grade <= 9)    return 'CBC Junior'
  if (grade === 10)  return 'CBC Senior'
  if (grade === 11)  return '8-4-4 Form 3'
  if (grade === 12)  return '8-4-4 Form 4'
  return 'CBC'
}

// ── Career Intelligence curriculum framing ─────────────────────────────────
//
// students.curriculum_type is the authoritative signal for which curriculum
// a learner is in — grade number alone cannot tell CBC Senior School apart
// from 8-4-4 Form 3/4, because CBC's own Senior School (Grade 10-12) will
// occupy the same numeric range 8-4-4's remaining Form 3/4 cohort uses today
// (lib/config/curriculumPhaseOut.ts). curriculumBadge() above infers from
// grade alone and is therefore not safe to reuse for this decision.
//
// A learner may only be shown terminology admissible to their actual
// curriculum: CBC pathway vocabulary (STEM / Social Sciences / Arts & Sports
// Science / Business) is a CBC Senior School concept and must never be
// framed as a recommendation for an 8-4-4/KCSE learner, or for a curriculum
// this resolver doesn't recognise.

export type CurriculumFraming = {
  /** Human-readable curriculum + stage label, e.g. "Grade 11 — CBC Senior", "8-4-4 Form 3". */
  label: string
  /** Whether CBC Senior School pathway vocabulary may be shown for this learner. */
  cbcPathwayAdmissible: boolean
}

const UNKNOWN_CURRICULUM_FRAMING: CurriculumFraming = {
  label: 'Curriculum not recorded',
  cbcPathwayAdmissible: false,
}

/**
 * Resolves curriculum-aware display label and CBC-pathway-vocabulary
 * admissibility for Career Intelligence. Never infers curriculum identity
 * from grade — an unrecognised or missing curriculumType always returns the
 * neutral fallback rather than guessing CBC or 8-4-4.
 */
export function resolveCurriculumFraming(
  curriculumType: string | null | undefined,
  grade: number,
): CurriculumFraming {
  const type = curriculumType?.toLowerCase().trim()

  if (type === 'cbc') {
    return {
      label: grade <= 9 ? `Grade ${grade} — CBC Junior` : `Grade ${grade} — CBC Senior`,
      cbcPathwayAdmissible: true,
    }
  }

  if (type === '844') {
    const form = gradeLabel(grade)
    return {
      label: form.startsWith('Form') ? `8-4-4 ${form}` : `8-4-4 — Grade ${grade}`,
      cbcPathwayAdmissible: false,
    }
  }

  return UNKNOWN_CURRICULUM_FRAMING
}
