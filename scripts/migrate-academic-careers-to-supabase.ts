// scripts/migrate-academic-careers-to-supabase.ts
// One-off migration: copies the 25 careers from lib/academicClinic/careerEngine.ts's
// CAREER_DATABASE that have no equivalent row yet in the Supabase `careers` table
// (the other 15 already exist there under a different slug — see ALIAS_MAP in
// lib/academicClinic/careerEngine.ts) so the Academic Clinic report and the
// Career Explorer share one source of truth.
//
//   npx tsx scripts/migrate-academic-careers-to-supabase.ts
//
// ALREADY RUN — do not re-run without checking scripts/backfill-career-doors.ts
// first. This script only writes 'employment' + 'ai_era' doors; the backfill
// script adds 'self_employment' + 'entrepreneurship' + ai_sovereignty on top.
// Re-running this upsert would wipe that backfill back to 2 thin doors.

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env.local') })

import { createClient } from '@supabase/supabase-js'
import { CAREER_DATABASE, type CareerData, type EarningPotential } from '../lib/academicClinic/careerEngine'
import { STANDARD_DISCLAIMER, type Career, type CareerCategory, type CareerPathway } from '../lib/career/types'

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// academicClinic id -> existing Supabase slug (already covers these careers under a
// different name/id format — do not create duplicates for them).
const ALIAS_MAP: Record<string, string> = {
  software_engineer: 'software-engineer',
  medical_doctor: 'medical-doctor',
  civil_engineer: 'civil-engineer',
  agricultural_scientist: 'agricultural-scientist',
  environmental_scientist: 'environmental-scientist',
  journalist: 'journalist-content-creator',
  graphic_designer: 'graphic-designer-creative-technologist',
  teacher: 'teacher-education-technologist',
  accountant_cpa: 'accountant-financial-analyst',
  lawyer: 'advocate-lawyer',
  social_worker: 'social-worker-community-developer',
  economist: 'economist-policy-analyst',
  psychologist: 'counselling-psychologist',
  athlete: 'sports-coach-athlete-development',
  sports_manager: 'sports-coach-athlete-development',
}

const SALARY_BANDS: Record<EarningPotential, { entry: [number, number]; mid: [number, number]; senior: [number, number] }> = {
  lower_but_stable: { entry: [25000, 40000], mid: [40000, 70000], senior: [70000, 120000] },
  moderate:         { entry: [35000, 60000], mid: [60000, 120000], senior: [120000, 200000] },
  lucrative:        { entry: [50000, 90000], mid: [90000, 180000], senior: [180000, 350000] },
  very_lucrative:   { entry: [80000, 150000], mid: [150000, 350000], senior: [350000, 700000] },
  exceptional:      { entry: [100000, 200000], mid: [200000, 500000], senior: [500000, 1200000] },
}

function toPathway(p: CareerData['pathway']): CareerPathway {
  return p === 'Arts & Sports' ? 'Arts & Sports Science' : p
}

const CATEGORY_MAP: Record<string, CareerCategory> = {
  data_scientist: 'technology',
  pharmacist: 'health',
  architect: 'trades',
  electrical_engineer: 'trades',
  veterinarian: 'health',
  cybersecurity_analyst: 'technology',
  ux_ui_designer: 'technology',
  renewable_energy_engineer: 'environment',
  drone_pilot_gis: 'technology',
  actuary: 'finance',
  quantity_surveyor: 'trades',
  digital_health_specialist: 'health',
  creative_director: 'creative',
  musician: 'creative',
  interior_designer: 'creative',
  film_director: 'creative',
  event_planner: 'creative',
  fashion_designer: 'creative',
  animator_game_developer: 'creative',
  human_resources: 'business',
  diplomat: 'business',
  tourism_safari_manager: 'business',
  supply_chain_manager: 'business',
  insurance_specialist: 'finance',
  urban_planner: 'trades',
}

function toCareer(c: CareerData): Omit<Career, 'id' | 'created_at' | 'updated_at'> {
  const band = SALARY_BANDS[c.marketReality.earningPotential]
  const aiLevel = c.aiImpact.disruptionRisk === 'very_low' || c.aiImpact.disruptionRisk === 'low'
    ? 'low' as const
    : c.aiImpact.disruptionRisk === 'moderate' ? 'medium' as const
    : c.aiImpact.disruptionRisk === 'high' ? 'high' as const
    : 'transforming' as const

  return {
    slug: c.id.replace(/_/g, '-'),
    title: c.name,
    category: CATEGORY_MAP[c.id] ?? 'business',
    pathway: toPathway(c.pathway),
    description: c.realityCheck.typicalDay,
    doors: [
      {
        type: 'employment',
        title: c.name,
        description: c.marketReality.kenyanContext,
        salary_tiers: {
          entry:  { min: band.entry[0],  max: band.entry[1],  label: 'Entry level (0-2 years)' },
          mid:    { min: band.mid[0],    max: band.mid[1],    label: 'Mid level (3-5 years)' },
          senior: { min: band.senior[0], max: band.senior[1], label: 'Senior (5+ years)' },
          note: 'Kenya rates — varies by employer and region.',
        },
        employers: c.cbeReadiness.universities,
      },
      {
        type: 'ai_era',
        title: `${c.name} in the AI Era`,
        description: c.aiImpact.timeline.midTerm,
        ai_opportunity: c.aiImpact.timeline.longTerm,
        skills_needed: c.aiImpact.survivalStrategy,
      },
    ],
    ai_impact: {
      level: aiLevel,
      replacing: [],
      creating: c.aiImpact.survivalStrategy,
      human_advantage: c.realityCheck.pros.slice(0, 3),
      timeline: `${c.aiImpact.timeline.shortTerm} ${c.aiImpact.timeline.midTerm}`,
      honest_summary: c.aiImpact.timeline.longTerm,
    },
    kenya_market_outlook: c.marketReality.kenyanContext,
    salary_range_kes: {
      entry:  { min: band.entry[0],  max: band.entry[1],  label: 'Entry level (0-2 years)' },
      mid:    { min: band.mid[0],    max: band.mid[1],    label: 'Mid level (3-5 years)' },
      senior: { min: band.senior[0], max: band.senior[1], label: 'Senior (5+ years)' },
      note: 'Kenya rates — varies by employer and region.',
    },
    required_subjects: c.matchRequirements.primarySubjects,
    subject_importance: Object.fromEntries(
      c.matchRequirements.primarySubjects.map(s => [
        s,
        (c.matchRequirements.minimumLevels[s] ?? 0) >= 4 ? 'critical' as const
          : (c.matchRequirements.minimumLevels[s] ?? 0) === 3 ? 'important' as const
          : 'helpful' as const,
      ])
    ),
    skill_timeline: [
      { age_range: '10–13', phase: 'Foundation', skills: c.cbeReadiness.coreCompetencies.slice(0, 2), why: `Builds the foundation ${c.name} requires.`, parent_action: 'Encourage curiosity in this area through books, clubs, and conversation.' },
      { age_range: '14–16', phase: 'Building', skills: c.matchRequirements.primarySubjects.map(s => s.replace(/_/g, ' ')), why: `Core subjects for ${c.name} are set in this phase.`, parent_action: 'Support consistent performance in the core subjects above.' },
      { age_range: '17–19', phase: 'Specializing', skills: [c.cbeReadiness.recommendedSeniorPath], why: 'Senior pathway choice determines university/TVET options.', parent_action: 'Help research the universities and TVET options listed for this career.' },
      { age_range: '20–24', phase: 'Career Entry', skills: c.aiImpact.survivalStrategy.slice(0, 2), why: 'Early-career skills that keep this career resilient to AI disruption.', parent_action: 'Encourage internships or entry-level roles in this field.' },
    ],
    future_skills: c.aiImpact.survivalStrategy,
    kenya_examples: null,
    disclaimer: STANDARD_DISCLAIMER,
    source: 'seed',
    search_count: 0,
  } as unknown as Omit<Career, 'id' | 'created_at' | 'updated_at'>
}

async function main() {
  const toMigrate = CAREER_DATABASE.filter(c => !ALIAS_MAP[c.id])
  console.log(`Migrating ${toMigrate.length} careers (skipping ${CAREER_DATABASE.length - toMigrate.length} already aliased to existing Supabase rows)...`)

  let inserted = 0
  const errors: string[] = []
  for (const c of toMigrate) {
    const row = toCareer(c)
    const { error } = await db.from('careers').upsert(row, { onConflict: 'slug' })
    if (error) errors.push(`${row.slug}: ${error.message}`)
    else inserted++
  }

  console.log(`Inserted/updated ${inserted} careers.`)
  if (errors.length > 0) console.error('Errors:', errors)
}

main()
