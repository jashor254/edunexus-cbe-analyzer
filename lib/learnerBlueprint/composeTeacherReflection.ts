// lib/learnerBlueprint/composeTeacherReflection.ts
//
// Teacher Reflection -> one canonical read only (ADR-0005 §2.7, ADR-0006
// §6, Sprint 12O). Reads via `findCurrent()`
// (lib/teacherReflection/reflection.ts) only — never queries
// `teacher_reflections` directly, never assembles or formats the
// reflection's content. Blueprint reads only; it never creates, edits, or
// publishes a reflection (Phase 6: "Blueprint reads only. Never edits.
// Never stores another copy.").
//
// `status` is 'available' | 'unavailable' from this sprint onward — never
// 'not_implemented' again, since the domain now genuinely exists (Sprint
// 12G/12H/12K/12L/12M/12N all correctly reported 'not_implemented' because
// no Teacher Reflection domain existed yet; that was accurate at the time,
// not a placeholder to keep forever).

import { findCurrent } from '@/lib/teacherReflection/reflection'
import type { BlueprintSection, TeacherReflectionData } from './types'

const OWNER = 'lib/teacherReflection/reflection.findCurrent'

export async function composeTeacherReflection(
  coreLearnerId: string,
  schoolId: string
): Promise<BlueprintSection<TeacherReflectionData>> {
  try {
    const reflection = await findCurrent(coreLearnerId, schoolId)

    if (!reflection) {
      return {
        status: 'unavailable',
        owner: OWNER,
        freshness: 'live',
        data: null,
        unavailableReason: 'This learner\'s teacher has not yet published a reflection.',
      }
    }

    const data: TeacherReflectionData = {
      strengths: reflection.strengths,
      growthArea: reflection.growth_area,
      learningHabits: reflection.learning_habits,
      recommendedSupport: reflection.recommended_support,
      holidayFocus: reflection.holiday_focus,
      teacherSignature: reflection.teacher_signature,
      writtenAt: reflection.written_at,
      publishedAt: reflection.published_at,
      version: reflection.version,
    }

    return { status: 'available', owner: OWNER, freshness: 'live', data }
  } catch (error) {
    return {
      status: 'unavailable',
      owner: OWNER,
      freshness: 'live',
      data: null,
      unavailableReason: error instanceof Error ? error.message : 'Teacher Reflection composition failed',
    }
  }
}
