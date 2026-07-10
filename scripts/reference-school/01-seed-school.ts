// scripts/reference-school/01-seed-school.ts
//
// Creates the `schools` row for Mwatate Ridge Senior School, plus its
// Academic Year, 3 Terms, and 3 Streams — per the frozen
// docs/reference-school/01-school-profile-and-structure.md and
// docs/reference-school/02-academic-structure.md.
//
// Idempotent: safe to re-run — looks up the school by name before creating.
//
// Run: npx tsx scripts/reference-school/01-seed-school.ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { db, SCHOOL_NAME } from './shared'

export async function seedSchool() {
  const supabase = db()

  const { data: existing } = await supabase
    .from('schools')
    .select('id')
    .eq('school_name', SCHOOL_NAME)
    .maybeSingle()

  let schoolId: string
  if (existing) {
    schoolId = existing.id
    console.log(`[school] already exists: ${schoolId}`)
  } else {
    const { data: school, error } = await supabase
      .from('schools')
      .insert({
        school_name: SCHOOL_NAME,
        school_type: 'secondary',
        county: 'Reference County', // deliberately fictional, per Module 1 freeze
        sub_county: 'Reference Sub-County',
        ward: 'Ridge Ward',
        address: 'P.O. Box 000-00000, Reference Sub-County',
        contact_email: 'info@mwatateridge.ac.ke.example',
        contact_phone: '0700000000',
        motto: 'Bidii na Maarifa',
        subscription_tier: 'free',
        is_active: true,
      })
      .select('id')
      .single()
    if (error) throw error
    schoolId = school.id
    console.log(`[school] created: ${schoolId}`)
  }

  const { data: existingYear } = await supabase
    .from('academic_years')
    .select('id')
    .eq('school_id', schoolId)
    .eq('name', '2026')
    .maybeSingle()

  let academicYearId: string
  if (existingYear) {
    academicYearId = existingYear.id
    console.log(`[academic_year] already exists: ${academicYearId}`)
  } else {
    const { data: year, error } = await supabase
      .from('academic_years')
      .insert({ school_id: schoolId, name: '2026', start_date: '2026-01-06', end_date: '2026-10-30', is_current: true })
      .select('id')
      .single()
    if (error) throw error
    academicYearId = year.id
    console.log(`[academic_year] created: ${academicYearId}`)
  }

  const termDefs = [
    { term_number: 1, name: 'Term 1 2026', start_date: '2026-01-06', end_date: '2026-04-03', is_current: false },
    { term_number: 2, name: 'Term 2 2026', start_date: '2026-05-04', end_date: '2026-08-07', is_current: true },
    { term_number: 3, name: 'Term 3 2026', start_date: '2026-09-01', end_date: '2026-10-30', is_current: false },
  ]

  const termIds: Record<number, string> = {}
  for (const t of termDefs) {
    const { data: existingTerm } = await supabase
      .from('terms')
      .select('id')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYearId)
      .eq('term_number', t.term_number)
      .maybeSingle()

    if (existingTerm) {
      termIds[t.term_number] = existingTerm.id
      continue
    }
    const { data: term, error } = await supabase
      .from('terms')
      .insert({ school_id: schoolId, academic_year_id: academicYearId, ...t })
      .select('id')
      .single()
    if (error) throw error
    termIds[t.term_number] = term.id
  }
  console.log(`[terms] ready: ${Object.values(termIds).length} terms`)

  const streamNames = ['East', 'West', 'Central']
  const streamIds: Record<string, string> = {}
  for (const name of streamNames) {
    const { data: existingStream } = await supabase
      .from('streams')
      .select('id')
      .eq('school_id', schoolId)
      .eq('name', name)
      .maybeSingle()

    if (existingStream) {
      streamIds[name] = existingStream.id
      continue
    }
    const { data: stream, error } = await supabase
      .from('streams')
      .insert({ school_id: schoolId, name })
      .select('id')
      .single()
    if (error) throw error
    streamIds[name] = stream.id
  }
  console.log(`[streams] ready: ${Object.keys(streamIds).join(', ')}`)

  return { schoolId, academicYearId, termIds, streamIds }
}

if (require.main === module) {
  seedSchool().then((r) => console.log('[done]', r)).catch((e) => { console.error(e); process.exit(1) })
}
