// lib/teacherReflection/reflection.ts
//
// The canonical Teacher Reflection service (Sprint 12O, ADR-0006 §6).
// Owns: permission checks, versioning, publishing, validation, and the
// Draft -> Teacher Editing -> Published -> Snapshot -> Historical lifecycle
// (Phase 5). No Supabase client is ever used directly here — every read/
// write goes through `repos.teacherReflections`
// (lib/repositories/teacherReflection.repository.ts), which owns the
// table exclusively.
//
// Educational constraints (Phase 7 — evidence-grounded, growth-focused,
// specific, respectful, actionable; never diagnosis, predictions,
// personality typing, medical claims, family assumptions, political or
// religious judgments, or AI-generated facts) are a policy this module
// documents and enforces only at the level automated validation can
// honestly reach: required fields, sensible length limits. Content-level
// judgment (is this sentence respectful, is this specific enough) cannot be
// automated without an AI content-classification step, which Phase 8 itself
// forbids ("AI must never invent evidence" / Phase 2 "no AI fields, no
// calculations") — so this is a human editorial responsibility, not a gap
// this service silently works around. See sprint-12o doc §7 for the full
// reasoning.

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireSchoolStaff } from '@/lib/core/permissions'
import { repos } from '@/lib/repositories'
import type { TeacherReflectionRow } from '@/lib/repositories/teacherReflection.repository'

const MAX_FIELD_LENGTH = 2000

export type ReflectionFields = {
  strengths: string
  growthArea: string
  learningHabits: string
  recommendedSupport: string
  holidayFocus: string | null
}

function validateFields(fields: ReflectionFields): void {
  const required: Array<[string, string]> = [
    ['strengths', fields.strengths],
    ['growthArea', fields.growthArea],
    ['learningHabits', fields.learningHabits],
    ['recommendedSupport', fields.recommendedSupport],
  ]
  for (const [name, value] of required) {
    if (!value || !value.trim()) throw new Error(`Teacher Reflection: "${name}" is required.`)
    if (value.length > MAX_FIELD_LENGTH) throw new Error(`Teacher Reflection: "${name}" exceeds ${MAX_FIELD_LENGTH} characters.`)
  }
  if (fields.holidayFocus && fields.holidayFocus.length > MAX_FIELD_LENGTH) {
    throw new Error(`Teacher Reflection: "holidayFocus" exceeds ${MAX_FIELD_LENGTH} characters.`)
  }
}

/**
 * Starts a new reflection cycle for a learner. Throws if a draft already
 * exists for this learner — `updateDraft` continues an in-progress one
 * instead of a caller silently creating a second, orphaned draft.
 */
export async function createDraft(
  client: SupabaseClient,
  schoolId: string,
  learnerId: string,
  actorUserId: string,
  fields: ReflectionFields
): Promise<TeacherReflectionRow> {
  await requireSchoolStaff(client, schoolId)
  validateFields(fields)

  const existingDraft = await repos.teacherReflections.findDraft(learnerId, schoolId)
  if (existingDraft) {
    throw new Error('A draft reflection already exists for this learner — edit it instead of starting a new one.')
  }

  const nextVersion = (await repos.teacherReflections.findHighestVersion(learnerId, schoolId)) + 1
  const teacherRow = await repos.teachers.findSchoolUser(actorUserId, schoolId).catch(() => null)

  return repos.teacherReflections.createReflection({
    learner_id: learnerId,
    school_id: schoolId,
    teacher_id: teacherRow?.id ?? null,
    version: nextVersion,
    strengths: fields.strengths,
    growth_area: fields.growthArea,
    learning_habits: fields.learningHabits,
    recommended_support: fields.recommendedSupport,
    holiday_focus: fields.holidayFocus,
  })
}

/** Edits an existing draft. The DB trigger rejects this outright once the row is published — this check exists to give a clean, actionable error instead of surfacing that raw DB exception. */
export async function updateDraft(
  client: SupabaseClient,
  schoolId: string,
  reflectionId: string,
  fields: Partial<ReflectionFields>
): Promise<TeacherReflectionRow> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.teacherReflections.findById(reflectionId, schoolId)
  if (!existing) throw new Error('Reflection not found.')
  if (existing.status !== 'draft') throw new Error('This reflection is already published and can never be edited — publish a new version instead.')

  const merged: ReflectionFields = {
    strengths: fields.strengths ?? existing.strengths,
    growthArea: fields.growthArea ?? existing.growth_area,
    learningHabits: fields.learningHabits ?? existing.learning_habits,
    recommendedSupport: fields.recommendedSupport ?? existing.recommended_support,
    holidayFocus: fields.holidayFocus !== undefined ? fields.holidayFocus : existing.holiday_focus,
  }
  validateFields(merged)

  return repos.teacherReflections.updateReflection(reflectionId, schoolId, {
    strengths: merged.strengths,
    growth_area: merged.growthArea,
    learning_habits: merged.learningHabits,
    recommended_support: merged.recommendedSupport,
    holiday_focus: merged.holidayFocus,
  })
}

/**
 * Publishes a draft — permanent, one-way (Phase 5: "Never edit a published
 * reflection. Ever."). Captures the teacher's own display name as
 * `teacher_signature` at this moment, so the signature survives the
 * authoring teacher later leaving the school (mirrors `blueprint_snapshots
 * .created_by`'s own SET NULL precedent, but for a human-readable name
 * rather than a foreign key).
 */
export async function publish(
  client: SupabaseClient,
  schoolId: string,
  reflectionId: string,
  actorUserId: string
): Promise<TeacherReflectionRow> {
  await requireSchoolStaff(client, schoolId)

  const existing = await repos.teacherReflections.findById(reflectionId, schoolId)
  if (!existing) throw new Error('Reflection not found.')
  if (existing.status === 'published') throw new Error('This reflection is already published.')

  const signature = (await repos.teachers.findProfileFullName(actorUserId).catch(() => null)) ?? 'Class Teacher'
  return repos.teacherReflections.publishReflection(reflectionId, schoolId, signature)
}

/** The one function Blueprint calls — the current *published* reflection, or null if none exists yet. Never a draft. */
export async function findCurrent(learnerId: string, schoolId: string): Promise<TeacherReflectionRow | null> {
  return repos.teacherReflections.findCurrent(learnerId, schoolId)
}

/** Every published reflection for a learner, newest first — the Historical Viewer's future source once Report Cards/Blueprint history need it directly (Blueprint itself reads history only via its own Snapshots, per Phase 9). */
export async function history(learnerId: string, schoolId: string): Promise<TeacherReflectionRow[]> {
  return repos.teacherReflections.history(learnerId, schoolId)
}
