// scripts/test-pathway-logic.ts
// Verifies the new calculateJuniorPathwayAffinity() logic against spec test cases.
// Run: npx tsx scripts/test-pathway-logic.ts

import { calculateJuniorPathwayAffinity } from '@/lib/pathwayCalculator'

// CBC conversion: 75-100→4, 50-74→3, 25-49→2, 0-24→1
function toCBC(raw: number): 1 | 2 | 3 | 4 {
  if (raw >= 75) return 4
  if (raw >= 50) return 3
  if (raw >= 25) return 2
  return 1
}

function makeScores(
  maths: number, eng: number, kisw: number, sci: number,
  pretech: number, ca: number, sst: number, cre: number, agri: number,
) {
  return {
    mathematics:           toCBC(maths),
    english:               toCBC(eng),
    kiswahili:             toCBC(kisw),
    integrated_science:    toCBC(sci),
    pre_technical_studies: toCBC(pretech),
    creative_arts_sports:  toCBC(ca),
    social_studies:        toCBC(sst),
    cre:                   toCBC(cre),
    agriculture_nutrition: toCBC(agri),
  }
}

const CASES = [
  {
    name:             'MARION WAIRIMU (9G)',
    scores:           makeScores(58, 75, 90, 84, 81, 80, 74, 83, 82),
    expected_tier:    'high',
    expected_pathway: 'STEM',
    expected_conf:    'low',
    note:             'Highest scorer — STEM from high-performer bias despite social also strong',
  },
  {
    name:             'TUCYLA NYAWIRA (9Y)',
    scores:           makeScores(25, 78, 78, 56, 80, 66, 42, 66, 78),
    expected_tier:    'high',
    expected_pathway: 'Social Sciences',
    expected_conf:    'low',
    note:             'Strong languages, weak maths → Social Sciences wins despite STEM boost',
  },
  {
    name:             'ALEX GICHOBI (9G)',
    scores:           makeScores(46, 70, 75, 76, 80, 81, 66, 81, 65),
    expected_tier:    'high',
    expected_pathway: 'STEM',
    expected_conf:    'low',
    note:             'Spec: science strong, maths needs work → STEM (may go Social — edge case)',
  },
  {
    name:             'FRANKLINE BUNDI (9G)',
    scores:           makeScores(30, 63, 68, 57, 80, 71, 60, 75, 70),
    expected_tier:    'high',
    expected_pathway: 'Social Sciences',
    expected_conf:    'low',
    note:             'Languages stronger than sciences → Social Sciences',
  },
  {
    name:             'MORGAN WAWERU (9Y) — LOW',
    scores:           makeScores(3, 10, 16, 12, 16, 12, 4, 3, 14),
    expected_tier:    'low',
    expected_pathway: 'Arts & Sports Science',
    expected_conf:    'high',
    note:             'All CBC Level 1 → Arts with HIGH confidence',
  },
  {
    name:             'DENNIS MACHARIA (9Y) — LOW',
    scores:           makeScores(4, 24, 31, 17, 43, 25, 13, 23, 35),
    expected_tier:    'low',
    expected_pathway: 'Arts & Sports Science',
    expected_conf:    'high',
    note:             'Low performer → Arts with HIGH confidence',
  },
  {
    name:             'BENSON MURIMI (9Y) — LOW (absent)',
    scores:           makeScores(9, 19, 0, 0, 0, 7, 0, 0, 9),
    expected_tier:    'low',
    expected_pathway: 'Arts & Sports Science',
    expected_conf:    'high',
    note:             'Absent in several subjects, all CBC ≤ 1 → Arts HIGH confidence',
  },
]

function sep(char = '─', len = 70) { return char.repeat(len) }

let passed = 0
let failed = 0

console.log(sep('═'))
console.log('  PATHWAY LOGIC TEST — calculateJuniorPathwayAffinity()')
console.log(sep('═'))

for (const tc of CASES) {
  const r      = calculateJuniorPathwayAffinity(tc.scores)
  const cbcAvg = (Object.values(tc.scores).reduce((a, b) => a + b, 0) / 9).toFixed(2)

  const tierOk    = r.performance_tier === tc.expected_tier
  const pathwayOk = r.top_pathway      === tc.expected_pathway
  const confOk    = r.confidence       === tc.expected_conf

  const allOk = tierOk && pathwayOk && confOk

  if (allOk) passed++ ; else failed++

  const icon = allOk ? '✓' : '✗'
  console.log(`\n  ${icon}  ${tc.name}`)
  console.log(`     CBC avg: ${cbcAvg}  tier: ${r.performance_tier}  stem_viable: ${r.stem_viable}`)
  console.log(`     Pathway : ${r.top_pathway}  (expected: ${tc.expected_pathway})  ${pathwayOk ? '✓' : '✗ FAIL'}`)
  console.log(`     Conf    : ${r.confidence}  (expected: ${tc.expected_conf})  ${confOk ? '✓' : '✗ FAIL'}`)
  console.log(`     Scores  : STEM=${r.stem_score}  Social=${r.social_sciences_score}  Arts=${r.arts_sports_score}`)
  console.log(`     Note    : ${tc.note}`)
}

console.log(`\n${sep('─')}`)
console.log(`  Results: ${passed}/${CASES.length} passed  (${failed} failed)`)
console.log(sep('─'))

// Quick sanity checks
console.log('\n  SANITY CHECKS')
console.log('  (No high performer should get Arts & Sports Science unless languages clearly dominate)')

const highArts = CASES.filter(tc => {
  const r = calculateJuniorPathwayAffinity(tc.scores)
  return r.performance_tier === 'high' && r.top_pathway === 'Arts & Sports Science'
})

if (highArts.length === 0) {
  console.log('  ✓ No HIGH performer assigned Arts & Sports Science')
} else {
  console.log(`  ⚠  ${highArts.length} HIGH performer(s) assigned Arts & Sports Science:`)
  highArts.forEach(tc => console.log(`     ${tc.name}`))
}

const lowStem = CASES.filter(tc => {
  const r = calculateJuniorPathwayAffinity(tc.scores)
  return r.performance_tier === 'low' && r.top_pathway === 'STEM'
})

if (lowStem.length === 0) {
  console.log('  ✓ No LOW performer assigned STEM')
} else {
  console.log(`  ✗ ${lowStem.length} LOW performer(s) incorrectly assigned STEM:`)
  lowStem.forEach(tc => console.log(`     ${tc.name}`))
}

console.log()
if (failed > 0) process.exit(1)
