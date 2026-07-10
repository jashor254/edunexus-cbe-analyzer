// scripts/reference-school/smoke-test.ts
//
// Plumbing smoke test: proves the Reference School is reachable end-to-end
// through the real app-level lib/core/* functions (not raw Supabase calls,
// unlike the seed scripts) — school -> classes -> learners -> guardians.
// This is the baseline that must pass before any intelligence-layer work
// reads from this data.
//
// Note: must be run with `--env-file`, not an in-script dotenv.config() call.
// lib/core/school.ts pulls in lib/repositories/index.ts, which eagerly
// instantiates every repository (each creating a Supabase client) at
// import time. Under Node's ESM loader, `import` statements are hoisted and
// resolved before any of the script's own top-level code runs — so an
// in-script `dotenv.config()` executes too late to matter. Loading env vars
// via --env-file happens before module resolution even starts, sidestepping
// the ordering problem entirely.
//
// Run: npx tsx --env-file=.env.local scripts/reference-school/smoke-test.ts
import { getReferenceSchool, getCurrentTerm } from '@/lib/core/school'
import { listClasses } from '@/lib/core/classes'
import { listLearners, getLearner } from '@/lib/core/learners'

async function main() {
  const school = await getReferenceSchool()
  console.log(`[school] ${school.school_name} (${school.id}) — ${school.school_type}, ${school.county}`)

  const classes = await listClasses(school.id)
  console.log(`[classes] ${classes.length} classes:`, classes.map((c) => c.display_name).join(', '))
  if (classes.length === 0) throw new Error('Expected 9 classes, found 0')

  const currentTerm = await getCurrentTerm(school.id)
  if (!currentTerm) throw new Error('Expected a current term, found none')

  const firstClass = classes[0]
  const learners = await listLearners(school.id, { classId: firstClass.id, termId: currentTerm.id })
  console.log(`[learners] ${firstClass.display_name} (${currentTerm.name}): ${learners.length} learners (sample: ${learners.slice(0, 3).map((l) => `${l.first_name} ${l.last_name}`).join(', ')})`)
  if (learners.length === 0) throw new Error(`Expected learners in ${firstClass.display_name}, found 0`)

  const learnerWithGuardians = await getLearner(learners[0].id, school.id)
  const guardianCount = learnerWithGuardians.learner_guardians?.length ?? 0
  console.log(`[guardians] ${learnerWithGuardians.first_name} ${learnerWithGuardians.last_name}: ${guardianCount} guardian(s)`)
  if (guardianCount === 0) throw new Error(`Expected at least one guardian for ${learnerWithGuardians.first_name}, found 0`)

  console.log('\n✅ Smoke test passed: school -> classes -> learners -> guardians all reachable via lib/core/*')
}

main().catch((e) => { console.error('❌ Smoke test failed:', e instanceof Error ? e.message : e); process.exit(1) })
