// lib/career/careerEvolutionReport.test.ts
//
// Integration of the Career Evolution lens into the Career Intelligence Report,
// tested at the pure seam resolveCareerEvolutionForReport(mode, topCareerDetail).
// This exercises the planning-only gating, the ai_impact → durable/shifting
// wiring, and provenance survival against the REAL in-memory signal corpus —
// no DB, no AI, no fabrication. (The full report build is covered by the DEEP
// careerIntelligenceEvidenceFirst integration test.)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveCareerEvolutionForReport } from './careerEvolution'
import type { Career } from './types'

// The helper reads only slug + ai_impact.{human_advantage,replacing}; a minimal
// Career-shaped stub is enough and keeps the test honest about what it touches.
function careerStub(slug: string, human: string[], replacing: string[]): Career {
  return { slug, ai_impact: { human_advantage: human, replacing } } as unknown as Career
}

const HUMAN = ['judgment', 'advocacy']
const REPLACING = ['bulk research', 'first-draft documents']

// 'agricultural-scientist' has real signals in lib/career/careerSignals.ts.
const WITH_SIGNALS = 'agricultural-scientist'
const WITHOUT_SIGNALS = 'zzz-career-with-no-signals'

test('TEST 1 — planning mode with signals: populated, chronological, ai_impact-sourced, provenance intact', () => {
  const view = resolveCareerEvolutionForReport('planning', careerStub(WITH_SIGNALS, HUMAN, REPLACING))
  assert.ok(view, 'planning mode with a career must produce an evolution view')
  assert.equal(view.careerSlug, WITH_SIGNALS)
  assert.ok(view.signal_count > 0, 'the real corpus has signals for this career')

  // Chronological, oldest → newest.
  for (let i = 1; i < view.trajectory.length; i++) {
    assert.ok(view.trajectory[i - 1].observedAt <= view.trajectory[i].observedAt, 'trajectory must be chronological')
  }

  // Durable/shifting come from the passed ai_impact fields, unchanged.
  assert.deepEqual(view.durable_core, HUMAN)
  assert.deepEqual(view.shifting_tasks, REPLACING)

  // Provenance survives into the view model: each stage carries its source,
  // date and confidence.
  const stage = view.trajectory[0]
  assert.ok(stage.observedAt, 'stage keeps its observation date')
  assert.ok(stage.confidence, 'stage keeps its confidence tier')
  assert.ok(Array.isArray(stage.sources), 'stage keeps its sources array')
  if (stage.sources.length > 0) {
    assert.ok(stage.sources[0].url, 'a source keeps its url')
    assert.ok(stage.sources[0].publishedAt, 'a source keeps its date')
  }
})

test('TEST 2 — planning mode without signals: graceful, no fabrication, not called static', () => {
  const view = resolveCareerEvolutionForReport('planning', careerStub(WITHOUT_SIGNALS, HUMAN, REPLACING))
  assert.ok(view)
  assert.equal(view.signal_count, 0)
  assert.deepEqual(view.trajectory, [], 'no fabricated trajectory entries')
  assert.match(view.narrative, /not yet traced/)
  assert.match(view.narrative, /not evidence the role is static/)
})

test('TEST 3 — junior (exploration) mode: career_evolution is null', () => {
  const view = resolveCareerEvolutionForReport('exploration', careerStub(WITH_SIGNALS, HUMAN, REPLACING))
  assert.equal(view, null)
})

test('TEST 4 — non-planning mode returns null (only exploration | planning exist)', () => {
  // The report mode type is exactly 'exploration' | 'planning'; exploration is
  // the only non-planning mode, and it must yield null.
  assert.equal(resolveCareerEvolutionForReport('exploration', careerStub(WITH_SIGNALS, HUMAN, REPLACING)), null)
})

test('TEST 5 — missing career information: null, no throw', () => {
  assert.equal(resolveCareerEvolutionForReport('planning', null), null)
})
