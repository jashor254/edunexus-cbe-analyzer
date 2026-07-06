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
import { repos } from '@/lib/repositories'

const SUBJECT   = 'mathematics'
const GRADE     = 7
const FROM_DATE = '2026-05-01T00:00:00.000Z'
const TO_DATE   = '2026-07-05T00:00:00.000Z'

// From the seed script's console output.
const LEARNERS: Array<{ id: string; label: string }> = [
  { id: 'd5fed1ce-40ca-4e59-9715-ee79254ecab0', label: 'Broadly improving' },
  { id: 'e99f07b1-8db5-46b5-884f-36a3e3f8d3a6', label: 'Flat / stagnant (no learning took place)' },
  { id: '1e85b939-985f-43f8-8a92-e36cbee11aa9', label: 'Regressing broadly' },
  { id: '8665935d-c98f-426c-b4e0-23eb0cf7ada7', label: 'Weak root: Whole Numbers stuck (high blast radius)' },
  { id: '09289f12-f48d-4208-818a-52733c050198', label: 'Weak root: Fractions stuck (hard-blocks Decimals + Percentages)' },
  { id: '7346bed9-3171-4e9b-8e5a-cc01bcc17afa', label: 'Mostly mastered, one topic crosses the ME threshold' },
  { id: 'fd15edf6-0e2d-45b2-bed8-730e3178c3eb', label: 'Weak root: Angles stuck (blocks Geometrical/Transformations chain)' },
  { id: '8da7acce-5b75-4aaa-8589-37095054d66b', label: 'Mixed bag — some up, some down, some flat' },
  { id: '93c7197e-67f0-4c90-898b-4b88340e53dd', label: 'Partial data — some topics only assessed once (insufficient_data)' },
  { id: 'ce60ffcf-a22a-463b-88a2-dbc396e99826', label: 'Weak root: Data Collection stuck (blocks Data Representation)' },
  { id: '109341b8-eacd-42f8-bebb-edf31297b4a6', label: 'Weak in Integers only, otherwise solid' },
  { id: '83fd909b-50cb-4006-b1e0-eda56938bce3', label: 'Weak root: Whole Numbers stuck AND downstream genuinely unmastered (real high blast radius)' },
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
    '09289f12-f48d-4208-818a-52733c050198', // Fractions stuck
    'fd15edf6-0e2d-45b2-bed8-730e3178c3eb', // Angles stuck
    '83fd909b-50cb-4006-b1e0-eda56938bce3', // Whole Numbers, genuinely broad
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

  console.log('')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('PLANNER FIX PROOF — lib/remedial/planner.ts prerequisite lookup')
  console.log('═══════════════════════════════════════════════════════════════')
  console.log('Reproducing planner.ts step 4 exactly (findNodeByConceptLike -> getPrerequisiteEdges -> getNodesByIds)')
  console.log('for subStrand = "Fractions", both the old (buggy) and new (fixed) way.\n')

  const currentNode = await repos.knowledgeGraph.findNodeByConceptLike('Fractions')
  console.log(`findNodeByConceptLike('Fractions') ->`, currentNode)

  if (currentNode) {
    const beforeEdges = await repos.knowledgeGraph.getPrerequisiteEdges(currentNode.id) // BEFORE: uuid (the bug)
    console.log(`\nBEFORE (bug): getPrerequisiteEdges(currentNode.id /* uuid */) -> ${beforeEdges.length} edges`)

    const afterEdges = await repos.knowledgeGraph.getPrerequisiteEdges(currentNode.node_id) // AFTER: text node_id (the fix)
    console.log(`AFTER (fixed): getPrerequisiteEdges(currentNode.node_id /* text */) -> ${afterEdges.length} edges`)

    if (afterEdges.length > 0) {
      const prereqIds = afterEdges.map(e => e.prerequisite_node_id)
      const prereqNodes = await repos.knowledgeGraph.getNodesByIds(prereqIds)
      console.log(`Resolved prerequisite concepts planner.ts would now surface:`, prereqNodes.map(n => n.name))
    }
  }
}

main().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1) })
