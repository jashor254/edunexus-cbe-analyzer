// lib/pilot/students.ts
//
// The selectable-student list behind the pilot admin "Add Student" picker.
//
// WHY THIS EXISTS AT ALL
// app/admin/pilot/page.tsx used to build this list in the browser, with
// `createClient().from('students').select('id, name, grade')`. That worked only
// because of the `Admin full access on students` RLS policy — which trusted
// `teachers.role = 'admin'`, a value any authenticated user could write to
// their own row. Migration 20260812190000 removed that policy, and with it the
// browser's cross-tenant reach. This module is the legitimate replacement: the
// same list, resolved server-side behind requireGrowthUser(), so platform-wide
// read authority lives on the server and never in a browser session.
//
// This is a READ. It performs no mutation, and deliberately exposes no field
// the picker does not render.

import { createServiceClient } from '@/utils/supabase/service'

/**
 * The minimum a picker option needs: a value to submit and a label to show.
 * Deliberately excludes guardian names, phone numbers, school, curriculum,
 * notes, and every other column on `students` — a dropdown does not need a
 * learner's contact details, and cross-tenant PII should not cross the wire
 * because a query was convenient.
 */
export type SelectableStudent = {
  id: string
  name: string
  grade: number
}

export async function listSelectableStudents(): Promise<SelectableStudent[]> {
  const db = createServiceClient()

  const { data, error } = await db
    .from('students')
    .select('id, name, grade')
    .order('name')

  if (error) throw new Error(`listSelectableStudents: ${error.message}`)
  return data ?? []
}
