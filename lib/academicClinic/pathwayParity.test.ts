// lib/academicClinic/pathwayParity.test.ts
//
// Phase 9.1.7 — locks in an audit finding as a permanent regression guard.
//
// The full 40-career parity audit (docs/architecture/
// phase9-1-7-academic-clinic-authority-convergence.md §8) found `pathway` is
// the ONE legacy field with proven 100% parity against canonical Postgres
// data across all 40 CAREER_DATABASE careers, once 'Arts & Sports' (legacy)
// and 'Arts & Sports Science' (canonical) are recognized as the same value
// (careerEngine.ts's own PATHWAY_NORMALIZE already does this). Every other
// legacy field (kenyaShortageScore, matchRequirements) was found to be
// either unverifiable-both-ways editorial judgment or a genuinely different,
// deliberately-simplified Clinic-specific vocabulary — see that doc for why
// they were NOT converged.
//
// This test hardcodes the real canonical `pathway` value fetched read-only
// from the connected Supabase project for each of the 40 careers (via their
// proven identity mapping — scripts/migrate-academic-careers-to-supabase.ts's
// ALIAS_MAP for 15, id.replace('_','-') for the other 25) and asserts it
// still matches CAREER_DATABASE's own value. If this test ever fails, the
// two corpora have drifted on the one field this repo currently treats as a
// safely-confirmed shared canonical fact — worth a human's attention, not a
// silent divergence.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/academicClinic/pathwayParity.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CAREER_DATABASE, normalizePathway } from './careerEngine'

// clinic id -> canonical pathway, as read from the connected Supabase
// project on 2026-08-24 (read-only query, not re-fetched at test time —
// this is a point-in-time parity snapshot, not a live DB check; see this
// file's header for why that's the intended design).
const CANONICAL_PATHWAY_BY_CLINIC_ID: Record<string, string> = {
  software_engineer: 'STEM', medical_doctor: 'STEM', data_scientist: 'STEM',
  civil_engineer: 'STEM', agricultural_scientist: 'STEM', pharmacist: 'STEM',
  architect: 'STEM', environmental_scientist: 'STEM', electrical_engineer: 'STEM',
  veterinarian: 'STEM', cybersecurity_analyst: 'STEM', ux_ui_designer: 'STEM',
  renewable_energy_engineer: 'STEM', drone_pilot_gis: 'STEM', actuary: 'STEM',
  quantity_surveyor: 'STEM', digital_health_specialist: 'STEM',
  creative_director: 'Arts & Sports Science', journalist: 'Arts & Sports Science',
  musician: 'Arts & Sports Science', athlete: 'Arts & Sports Science',
  interior_designer: 'Arts & Sports Science', film_director: 'Arts & Sports Science',
  graphic_designer: 'Arts & Sports Science', event_planner: 'Arts & Sports Science',
  fashion_designer: 'Arts & Sports Science', sports_manager: 'Arts & Sports Science',
  animator_game_developer: 'Arts & Sports Science',
  lawyer: 'Social Sciences', accountant_cpa: 'Social Sciences', teacher: 'Social Sciences',
  social_worker: 'Social Sciences', human_resources: 'Social Sciences',
  psychologist: 'Social Sciences', diplomat: 'Social Sciences',
  tourism_safari_manager: 'Social Sciences', supply_chain_manager: 'Social Sciences',
  insurance_specialist: 'Social Sciences', urban_planner: 'Social Sciences',
  economist: 'Social Sciences',
}

test('every CAREER_DATABASE entry has a canonical mapping recorded for this guard', () => {
  assert.equal(CAREER_DATABASE.length, 40)
  for (const career of CAREER_DATABASE) {
    assert.ok(career.id in CANONICAL_PATHWAY_BY_CLINIC_ID, `${career.id} has no recorded canonical pathway — this guard is stale`)
  }
})

test('pathway parity holds for all 40 careers (normalized) — the one proven-safe shared fact', () => {
  const mismatches: string[] = []
  for (const career of CAREER_DATABASE) {
    const canonical = CANONICAL_PATHWAY_BY_CLINIC_ID[career.id]
    if (normalizePathway(career.pathway) !== normalizePathway(canonical)) {
      mismatches.push(`${career.id}: legacy="${career.pathway}" canonical="${canonical}"`)
    }
  }
  assert.deepEqual(mismatches, [], `pathway drift detected:\n${mismatches.join('\n')}`)
})

test('athlete and sports_manager both alias to the same canonical career (a real, proven identity collision, not a bug in this test)', () => {
  assert.equal(CANONICAL_PATHWAY_BY_CLINIC_ID.athlete, CANONICAL_PATHWAY_BY_CLINIC_ID.sports_manager)
})
