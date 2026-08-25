// scripts/career-corpus-audit.ts
//
// Run: npx tsx scripts/career-corpus-audit.ts
//
// A read-only health report on the platform's career knowledge. Writes nothing,
// deletes nothing — every problem it finds needs a judgement call that belongs
// to a person, so it reports and stops.
//
// Why this exists
// ---------------
// Career knowledge sits in two places that no code keeps in agreement:
//
//   `careers` (Postgres)   — read by the capability match engine, the Career
//                            Explorer, Parent Career Intelligence and the
//                            Blueprint.
//   `CAREER_DATABASE`      — 40 careers hardcoded in
//   (lib/academicClinic/     lib/academicClinic/careerEngine.ts, still live via
//    careerEngine.ts)        assessmentPipeline → /api/teacher/assessments/
//                            process and /api/parent/assessments/process.
//
// They were authored independently and cover substantially the same careers
// under different slugs and titles, which means a teacher processing an
// assessment and the same learner's Blueprint can describe the same career with
// independently written facts. Consolidating them is a real migration (the two
// shapes are genuinely different: `matchRequirements`/`kenyaShortageScore`
// versus `required_capabilities`/`kenya_demand`), not a cleanup, and it touches
// a live pipeline. Until that is done deliberately, this script at least makes
// the drift visible instead of silent.
//
// Phase 9.1.6 update: this drift for the EXISTING 40 CAREER_DATABASE careers
// is still real and unresolved (rewriting their scores would require
// reconstructing `kenyaShortageScore` and precise `minimumLevels`, neither of
// which survives in Postgres — see canonicalCareerAdapter.ts's header). What
// changed is additive only: CareerEngine.matchCareers() now ALSO scores any
// canonical Postgres career CAREER_DATABASE doesn't already represent (via
// lib/academicClinic/canonicalCareerAdapter.ts, wired in
// assessmentPipeline.ts), so a career published after this audit script was
// written is no longer invisible to Academic Clinic. It just doesn't fix the
// near-duplicate/independently-authored problem this script documents below
// for the 40 that were already there.
//
// It also catches a second problem that has nothing to do with the split: the
// `careers` table contains near-duplicate rows. Two careers with the same
// category and the same capability cluster score almost identically, so a
// learner's top-5 matches can spend two slots on what is effectively one
// career under two names.

import { config } from 'dotenv'
config({ path: '.env.local' })

import { createServiceClient } from '@/utils/supabase/service'
import { CAREER_DATABASE } from '@/lib/academicClinic/careerEngine'
import { assessCareerKnowledge } from '@/lib/career/knowledgeLifecycle'

type CareerRow = {
  slug: string
  title: string
  category: string
  capability_cluster: string[] | null
  knowledge_verified_at: string | null
}

/** "software_engineer" and "software-engineer" are the same career. */
function canonical(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Tokens a title shares with another, ignoring the connective words that make
 * "Graphic Designer & Creative Director" and "Graphic Designer / Creative
 * Technologist" look less similar than they are.
 */
function titleTokens(title: string): Set<string> {
  const stop = new Set(['and', 'or', 'the', 'of', 'a', 'specialist', 'manager', 'officer'])
  return new Set(
    title.toLowerCase().split(/[^a-z]+/).filter(t => t.length > 2 && !stop.has(t)),
  )
}

function overlapRatio(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  const shared = [...a].filter(t => b.has(t)).length
  return shared / Math.min(a.size, b.size)
}

/**
 * Overlap is only trustworthy when both titles carry enough words to disagree.
 * Dividing by the smaller set means a one-token title ("UX/UI Designer") scores
 * 100% against anything else containing "designer", which claimed a rename that
 * had not happened. Two tokens minimum on both sides before a ratio is quoted.
 */
function confidentOverlap(a: Set<string>, b: Set<string>): number | null {
  if (a.size < 2 || b.size < 2) return null
  return overlapRatio(a, b)
}

async function main(): Promise<void> {
  const db = createServiceClient()
  const { data, error } = await db
    .from('careers')
    .select('slug, title, category, capability_cluster, knowledge_verified_at')
    .order('slug')
  if (error) throw new Error(`Failed to read careers: ${error.message}`)

  const careers = (data ?? []) as CareerRow[]

  console.log('\n=== CAREER CORPUS AUDIT ===\n')
  console.log(`careers table:    ${careers.length} rows`)
  console.log(`CAREER_DATABASE:  ${CAREER_DATABASE.length} hardcoded entries\n`)

  // ── 1. Near-duplicates inside `careers` ───────────────────────────────────
  console.log('--- Near-duplicate careers (same category + same capability cluster) ---')
  let duplicatePairs = 0
  for (let i = 0; i < careers.length; i++) {
    for (let j = i + 1; j < careers.length; j++) {
      const a = careers[i]
      const b = careers[j]
      if (a.category !== b.category) continue

      // Sharing a capability cluster is not by itself evidence of duplication:
      // there are only six capability dimensions and 43 careers, so Actuary and
      // Accountant legitimately share [analytical_reasoning|technical_aptitude]
      // while being entirely different jobs. A duplicate needs BOTH the same
      // cluster and a genuinely overlapping name.
      //
      // The threshold is 0.3 rather than 0.5 because the real duplicate pair in
      // this corpus — "Journalist / Content Creator" and "Journalist & Media
      // Producer" — shares only its first token and scores 33%. At 0.5 the
      // check misses the very thing it was written to find; at 0.25 it starts
      // pulling in Creative Director vs Film Director, which are distinct.
      const clusterA = (a.capability_cluster ?? []).join('|')
      const clusterB = (b.capability_cluster ?? []).join('|')
      if (clusterA === '' || clusterA !== clusterB) continue

      const similarity = overlapRatio(titleTokens(a.title), titleTokens(b.title))
      if (similarity < 0.3) continue

      duplicatePairs++
      console.log(`  ${a.slug}`)
      console.log(`  ${b.slug}`)
      console.log(`    category=${a.category} cluster=[${clusterA}] title overlap=${Math.round(similarity * 100)}%`)
      console.log('    → these score almost identically; a learner can spend two top-5 slots on one career\n')
    }
  }
  if (duplicatePairs === 0) console.log('  none found\n')

  // ── 2. Divergence against the hardcoded corpus ────────────────────────────
  console.log('--- Careers in CAREER_DATABASE with no matching slug in `careers` ---')
  const dbSlugs = new Set(careers.map(c => canonical(c.slug)))
  const orphans = CAREER_DATABASE.filter(c => !dbSlugs.has(canonical(c.id)))
  if (orphans.length === 0) {
    console.log('  none\n')
  } else {
    for (const o of orphans) {
      // A slug miss is usually a rename, not an absence — surface the closest
      // title so a reader can tell which it is without opening both files.
      const tokens = titleTokens(o.name)
      const closest = careers
        .map(c => ({ slug: c.slug, score: confidentOverlap(tokens, titleTokens(c.title)) }))
        .filter((c): c is { slug: string; score: number } => c.score !== null)
        .sort((x, y) => y.score - x.score)[0]
      const hint = closest && closest.score >= 0.5
        ? `probably renamed to '${closest.slug}' (${Math.round(closest.score * 100)}% title overlap)`
        : 'no confident match — either genuinely absent, or renamed beyond what titles can show'
      console.log(`  ${o.id.padEnd(34)} "${o.name}"`)
      console.log(`    → ${hint}`)
    }
    console.log(`\n  ${orphans.length} of ${CAREER_DATABASE.length} hardcoded careers do not resolve by slug.`)
    console.log('  Every one of these is a career the assessment pipeline can recommend')
    console.log('  and the Blueprint cannot, or can only under a different name.\n')
  }

  // ── 3. Knowledge freshness ────────────────────────────────────────────────
  console.log('--- Knowledge freshness ---')
  const buckets: Record<string, number> = { fresh: 0, aging: 0, stale: 0, unknown: 0 }
  let oldest: { slug: string; ageDays: number } | null = null
  for (const c of careers) {
    const state = assessCareerKnowledge(c.knowledge_verified_at)
    buckets[state.freshness]++
    if (state.ageDays !== null && (oldest === null || state.ageDays > oldest.ageDays)) {
      oldest = { slug: c.slug, ageDays: state.ageDays }
    }
  }
  for (const [k, v] of Object.entries(buckets)) {
    console.log(`  ${k.padEnd(8)} ${v}`)
  }
  if (oldest) console.log(`  oldest:  ${oldest.slug} (${oldest.ageDays} days since confirmation)`)
  if (buckets.unknown > 0) {
    console.log(`\n  ${buckets.unknown} career(s) have never been confirmed by anyone.`)
  }

  // ── 4. Review queue depth ─────────────────────────────────────────────────
  const { data: pending } = await db
    .from('career_review_queue')
    .select('career_name, request_count')
    .eq('status', 'pending')
    .order('request_count', { ascending: false })
    .limit(10)

  console.log('\n--- Careers learners asked for that we do not have ---')
  if (!pending || pending.length === 0) {
    console.log('  queue empty\n')
  } else {
    for (const p of pending) {
      console.log(`  ${String(p.request_count).padStart(4)}x  ${p.career_name}`)
    }
    console.log('')
  }

  console.log('=== END ===\n')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
