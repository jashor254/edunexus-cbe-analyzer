// scripts/report-grade7-math-engines.ts
// Headless proof run over the synthetic Grade 7 Maths cohort seeded by
// scripts/seed-grade7-math-synthetic.ts. No UI, no wiring into
// Remedial Bank / AttentionFeed yet — just printing both engines' output so
// the numbers can be sanity-checked before anything goes teacher-facing.
//
// Note on the class aggregate: the synthetic learners aren't enrolled in a
// real teacher_classes row (no classId exists for them), so this calls
// didLearningTakePlace() per learner directly and feeds the results into
// aggregateClassLearningDeltas() — the exact same pure aggregator
// didLearningTakePlaceForClass() uses internally — rather than going through
// getClassEnrollment(classId). Everything else is the real code path.
//
// Run: npx tsx scripts/report-grade7-math-engines.ts
import { config } from 'dotenv'
config({ path: '.env.local' })

import { didLearningTakePlace, aggregateClassLearningDeltas } from '@/lib/learningSignal/didLearningTakePlace'
import { computeQuickWins } from '@/lib/knowledgeGraph'

const SUBJECT   = 'mathematics'
const GRADE     = 7
const FROM_DATE = '2026-05-01T00:00:00.000Z'
const TO_DATE   = '2026-07-05T00:00:00.000Z'

// From the seed script's console output.
const LEARNERS: Array<{ id: string; label: string }> = [
  { id: 'f9a83bd7-63b8-4001-9e28-713fa5d7729c', label: 'Broadly improving' },
  { id: '957d4c22-79cc-42ae-9fd8-078a95182355', label: 'Flat / stagnant (no learning took place)' },
  { id: 'bd103bac-1b54-44e5-905d-0dfd92ac86f1', label: 'Regressing broadly' },
  { id: '577a5b2e-57e7-46b6-815a-66d2c12df260', label: 'Weak root: Whole Numbers stuck (high blast radius)' },
  { id: '55afb521-c9bf-496e-b9dc-94e2dc0820c9', label: 'Weak root: Fractions stuck (hard-blocks Decimals + Percentages)' },
  { id: '90318c1d-ede2-461a-bf8c-ddc4395086c0', label: 'Mostly mastered, one topic crosses the ME threshold' },
  { id: '88081bab-f820-43f9-a626-aa35b224a7e0', label: 'Weak root: Angles stuck (blocks Geometrical/Transformations chain)' },
  { id: 'd459896d-8b3c-49d3-a5c3-2748ac786ab7', label: 'Mixed bag — some up, some down, some flat' },
  { id: '82299de1-c36d-49ae-bc74-9fb5f566e681', label: 'Partial data — some topics only assessed once (insufficient_data)' },
  { id: '86bdce0d-35ec-4426-8310-1d2ce11b6091', label: 'Weak root: Data Collection stuck (blocks Data Representation)' },
  { id: '7ad50239-c300-45e5-9a86-3346a46b029b', label: 'Weak in Integers only, otherwise solid' },
]

async function main() {
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('LAYER 1 — didLearningTakePlace: class aggregate per topic')
  console.log('═══════════════════════════════════════════════════════════════')

  const perLearnerReports = await Promise.all(
    LEARNERS.map(l => didLearningTakePlace(l.id, SUBJECT, GRADE, FROM_DATE, TO_DATE)),
  )

  const classAggregate = aggregateClassLearningDeltas(perLearnerReports.map(r => r.topics))

  console.table(
    classAggregate.map(t => ({
      strand:      t.strand,
      topic:       t.topic,
      learners:    t.learnerCount,
      movedUp:     t.movedUpCount,
      flat:        t.flatCount,
      regressed:   t.regressedCount,
      '%movedUp':  t.pctMovedUp,
    })),
  )

  console.log('')
  console.log('Per-learner detail (first 3 learners, illustrating movement + crossedThreshold):')
  for (const report of perLearnerReports.slice(0, 3)) {
    const learner = LEARNERS.find(l => l.id === report.learnerId)!
    console.log(`\n-- ${learner.label} (${report.learnerId}) --`)
    console.table(report.topics.map(t => ({
      topic: t.topic, ratingT1: t.ratingT1, ratingT2: t.ratingT2, delta: t.delta,
      movement: t.movement, crossedThreshold: t.crossedThreshold,
    })))
  }

  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('LAYER 2 — computeQuickWins: what to fix first, for 3 weak learners')
  console.log('═══════════════════════════════════════════════════════════════')

  const weakLearnerIds = [
    '577a5b2e-57e7-46b6-815a-66d2c12df260', // Whole Numbers stuck
    '55afb521-c9bf-496e-b9dc-94e2dc0820c9', // Fractions stuck
    '88081bab-f820-43f9-a626-aa35b224a7e0', // Angles stuck
  ]

  for (const id of weakLearnerIds) {
    const learner = LEARNERS.find(l => l.id === id)!
    const quickWins = await computeQuickWins(id, SUBJECT, GRADE)
    console.log(`\n-- ${learner.label} (${id}) --`)
    if (quickWins.length === 0) {
      console.log('  (no weak topics found)')
      continue
    }
    quickWins.forEach((w, i) => {
      console.log(`  ${i + 1}. [rating ${w.rating}] ${w.reason}`)
      console.log(`     blastRadius=${w.blastRadius} hardBlocked=${w.hardBlockedCount} softBlocked=${w.softBlockedCount}`)
    })
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
