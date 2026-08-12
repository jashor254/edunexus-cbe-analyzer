// lib/config/kjseaRules.test.ts
//
// Guards the two properties that make this module worth having:
//   1. Every cycle's band table is internally sound — tiles 0-100 with no gap
//      or overlap, points strictly ordered, levels consistent. A silent gap
//      here would throw at runtime on a real learner's mark.
//   2. Nothing reintroduces a hardcoded gate or a false claim of official
//      status. KJSEA's rules change per cycle; the regression this file exists
//      to prevent is a number quietly outliving the year it was true for.
//
// Run: npx tsx --test lib/config/kjseaRules.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import {
  listKjseaCycles,
  getKjseaRuleSet,
  getActiveKjseaRuleSet,
  isKjseaRuleSetVerified,
  kjseaRuleCaveat,
  kjseaBandFromScore,
  kjseaPointsFromScore,
  cbcLevelToKjseaPointsFloor,
  isKjseaPointsAmbiguousForLevel,
  getPathwayMinimum,
} from './kjseaRules'
import {
  cbcToKJSEAPoints,
  calculateKJSEAComposite,
  isCompositeUnderestimated,
  getPathwayCompositeMinimum,
  buildPathwayDisclaimer,
} from '@/lib/pathwayCalculator'

// ── Band table integrity, for every cycle ────────────────────────────────────

for (const cycle of listKjseaCycles()) {
  test(`${cycle}: bands tile 0-100 with no gap or overlap`, () => {
    const bands = [...getKjseaRuleSet(cycle).bands].sort((a, b) => a.minPct - b.minPct)
    assert.equal(bands[0].minPct, 0, 'lowest band must start at 0 so a zero mark still lands somewhere')
    assert.equal(bands[bands.length - 1].maxPct, 100, 'highest band must reach 100')
    for (let i = 1; i < bands.length; i++) {
      assert.equal(
        bands[i].minPct,
        bands[i - 1].maxPct + 1,
        `gap or overlap between ${bands[i - 1].code} and ${bands[i].code}`,
      )
    }
  })

  test(`${cycle}: every whole percentage 0-100 resolves to exactly one band`, () => {
    const ruleSet = getKjseaRuleSet(cycle)
    for (let pct = 0; pct <= 100; pct++) {
      const matches = ruleSet.bands.filter(b => pct >= b.minPct && pct <= b.maxPct)
      assert.equal(matches.length, 1, `${pct}% matched ${matches.length} bands`)
    }
  })

  test(`${cycle}: higher percentage never yields fewer points`, () => {
    const ruleSet = getKjseaRuleSet(cycle)
    let previous = -Infinity
    for (let pct = 0; pct <= 100; pct++) {
      const points = kjseaPointsFromScore(pct, ruleSet)
      assert.ok(points >= previous, `points fell from ${previous} to ${points} at ${pct}%`)
      previous = points
    }
  })

  test(`${cycle}: each band's cbcLevel agrees with its neighbours' ordering`, () => {
    const bands = [...getKjseaRuleSet(cycle).bands].sort((a, b) => a.points - b.points)
    let previousLevel = 0
    for (const band of bands) {
      assert.ok(band.cbcLevel >= previousLevel, `${band.code} level ${band.cbcLevel} is below a lower-point band`)
      previousLevel = band.cbcLevel
    }
  })
}

// ── The specific bug this work fixed ─────────────────────────────────────────

test('the top of every band is reachable from a real mark — the EE1/ME1 bug', () => {
  // Before this change the only mapping available was level-based and returned
  // the floor of each band, so 8 and 6 could never be produced at all.
  assert.equal(kjseaPointsFromScore(95), 8, 'a 95% learner must be able to score EE1')
  assert.equal(kjseaPointsFromScore(76), 7)
  assert.equal(kjseaPointsFromScore(60), 6, 'a 60% learner must be able to score ME1')
  assert.equal(kjseaPointsFromScore(45), 5)
  assert.equal(kjseaPointsFromScore(35), 4)
  assert.equal(kjseaPointsFromScore(25), 3)
  assert.equal(kjseaPointsFromScore(15), 2)
  assert.equal(kjseaPointsFromScore(5),  1)
})

test('level-only points are an explicit lower bound, and say so', () => {
  assert.equal(cbcLevelToKjseaPointsFloor(4), 7, 'level 4 alone cannot prove EE1')
  assert.equal(cbcLevelToKjseaPointsFloor(3), 5)
  assert.equal(cbcLevelToKjseaPointsFloor(2), 3)
  assert.equal(cbcLevelToKjseaPointsFloor(1), 1)
  assert.equal(cbcLevelToKjseaPointsFloor(0), 0, 'no evidence yields no points, never a guess')

  for (const level of [1, 2, 3, 4]) {
    assert.equal(isKjseaPointsAmbiguousForLevel(level), true, `level ${level} spans two bands, so it must report ambiguity`)
  }
})

test('a real mark never scores below the level-only floor', () => {
  for (let pct = 0; pct <= 100; pct++) {
    const band = kjseaBandFromScore(pct)
    assert.ok(
      kjseaPointsFromScore(pct) >= cbcLevelToKjseaPointsFloor(band.cbcLevel),
      `${pct}% scored below its own level's floor`,
    )
  }
})

test('kjseaBandFromScore rejects impossible percentages rather than guessing', () => {
  assert.throws(() => kjseaBandFromScore(-1), /0-100/)
  assert.throws(() => kjseaBandFromScore(101), /0-100/)
  assert.throws(() => kjseaBandFromScore(Number.NaN), /0-100/)
})

// ── Composites ───────────────────────────────────────────────────────────────

test('composite uses real marks where present and the floor where absent', () => {
  const levels = { mathematics: 4, english: 4 }

  // Levels only: both floored to 7.
  assert.equal(calculateKJSEAComposite(levels), 14)

  // With real marks, the 95% learner is correctly worth 8.
  assert.equal(calculateKJSEAComposite(levels, { mathematics: 95, english: 76 }), 15)

  // A partial mark set is fine — English falls back to its floor.
  assert.equal(calculateKJSEAComposite(levels, { mathematics: 95 }), 15)
})

test('a level of 0 still means "no evidence" and contributes nothing', () => {
  assert.equal(calculateKJSEAComposite({ mathematics: 4, english: 0 }), 7)
  assert.equal(calculateKJSEAComposite({ mathematics: 4, english: 0 }, { english: 90 }), 7,
    'a mark for a subject with no confirmed level must not conjure evidence')
})

test('out-of-range marks fall back to the level floor instead of throwing mid-composite', () => {
  assert.equal(calculateKJSEAComposite({ mathematics: 4 }, { mathematics: 150 }), 7)
  assert.equal(calculateKJSEAComposite({ mathematics: 4 }, { mathematics: -5 }), 7)
})

test('isCompositeUnderestimated flags exactly the subjects missing a real mark', () => {
  assert.equal(isCompositeUnderestimated({ mathematics: 4, english: 4 }), true)
  assert.equal(isCompositeUnderestimated({ mathematics: 4, english: 4 }, { mathematics: 95 }), true, 'English is still a guess')
  assert.equal(isCompositeUnderestimated({ mathematics: 4, english: 4 }, { mathematics: 95, english: 80 }), false)
  assert.equal(isCompositeUnderestimated({ mathematics: 0 }), false, 'no evidence is not an underestimate')
})

// ── Gates and provenance ─────────────────────────────────────────────────────

test('pathway gates come from the rule set, and an unpublished gate is null not a guess', () => {
  assert.equal(getPathwayCompositeMinimum('STEM'), getPathwayMinimum('STEM'))
  assert.equal(getPathwayCompositeMinimum('Languages'), null,
    'no minimum was published for Languages & Literature — it must stay absent')
})

test('an unknown cycle throws rather than silently reusing another year', () => {
  assert.throws(() => getKjseaRuleSet('1999'), /No KJSEA rule set for cycle/)
})

test('the active rule set is provisional, and advertises that fact', () => {
  const active = getActiveKjseaRuleSet()
  assert.equal(isKjseaRuleSetVerified(active), false,
    'if this fails, someone marked the rules verified — confirm a primary KNEC source exists in `sources` before allowing it')
  assert.match(kjseaRuleCaveat(active) ?? '', /not yet confirmed/)
})

test('a rule set may only claim verified status with a primary source attached', () => {
  for (const cycle of listKjseaCycles()) {
    const ruleSet = getKjseaRuleSet(cycle)
    if (ruleSet.status === 'verified') {
      assert.ok(
        ruleSet.sources.some(s => s.primary),
        `${cycle} is marked verified but cites no primary source`,
      )
    }
  }
})

test('the disclaimer tracks verification status and never over-claims', () => {
  const disclaimer = buildPathwayDisclaimer()
  assert.match(disclaimer.full, /not yet confirmed against an official KNEC publication/)
  assert.doesNotMatch(disclaimer.full, /the official KNEC/,
    'provisional rules must not be described as official')
  assert.match(disclaimer.full, /not placement guarantees/)
})

test('the disclaimer quotes the gates from the rule set rather than repeating them in prose', () => {
  const stem = getPathwayMinimum('STEM')
  assert.ok(stem !== null)
  assert.match(buildPathwayDisclaimer().full, new RegExp(`STEM ${stem}\\+ points`))
})

// ── Static-regression guard ──────────────────────────────────────────────────

test('pathwayCalculator holds no hardcoded KJSEA gate or points table', () => {
  const source = readFileSync(path.resolve(__dirname, '../pathwayCalculator.ts'), 'utf8')

  assert.doesNotMatch(source, /kjsea_composite_min/,
    'composite minimums must live only in lib/config/kjseaRules.ts')
  assert.doesNotMatch(source, /kjsea_stem_threshold:\s*\d/,
    'the STEM threshold must be read from the rule set, not written as a literal')
  assert.doesNotMatch(source, /case 4:\s*return 7/,
    'the level→points table must not be reintroduced as a switch')
})
