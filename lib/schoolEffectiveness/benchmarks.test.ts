// lib/schoolEffectiveness/benchmarks.test.ts
//
// Config integrity for the eight CBC-adapted Gatsby benchmarks. These lock the
// framework's shape so a later edit cannot silently drop a benchmark, break a
// rubric, or — the honesty invariant — map a horizon benchmark (employer
// encounters / workplace experiences) to a programme EduNexus does not have.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CBC_GATSBY_BENCHMARKS } from './benchmarks'

test('8 Gatsby-core + 3 EduNexus-beyond benchmarks, unique ids, orders 1–11', () => {
  assert.equal(CBC_GATSBY_BENCHMARKS.length, 11)

  const ids = new Set(CBC_GATSBY_BENCHMARKS.map((b) => b.id))
  assert.equal(ids.size, 11, 'benchmark ids must be unique')

  const orders = CBC_GATSBY_BENCHMARKS.map((b) => b.order).sort((a, b) => a - b)
  assert.deepEqual(orders, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'orders 1–11, each once')

  const core = CBC_GATSBY_BENCHMARKS.filter((b) => b.framework === 'gatsby_core')
  const beyond = CBC_GATSBY_BENCHMARKS.filter((b) => b.framework === 'edunexus_beyond')
  assert.equal(core.length, 8, '8 Gatsby-core benchmarks')
  assert.equal(beyond.length, 3, '3 EduNexus-beyond benchmarks')

  const gatsbyNumbers = core.map((b) => b.gatsbyNumber).sort((a, b) => (a ?? 0) - (b ?? 0))
  assert.deepEqual(gatsbyNumbers, [1, 2, 3, 4, 5, 6, 7, 8], 'Gatsby numbers 1–8, each once, on core only')
})

test('EduNexus-beyond dimensions: orders 9–11, no Gatsby number, all addressable (none horizon)', () => {
  const beyond = CBC_GATSBY_BENCHMARKS.filter((b) => b.framework === 'edunexus_beyond')
  assert.deepEqual(beyond.map((b) => b.order).sort((a, b) => a - b), [9, 10, 11])
  for (const b of beyond) {
    assert.equal(b.gatsbyNumber, undefined, `${b.id} is not a Gatsby benchmark — no Gatsby number`)
    assert.equal(b.horizon, false, `${b.id} is a shipped EduNexus dimension, not a horizon`)
    assert.ok(b.addressed_by.length >= 1, `${b.id} maps to at least one shipped programme`)
  }
  // The three beyond-dimensions we claim.
  assert.deepEqual(
    beyond.map((b) => b.id).sort(),
    ['ai_era_readiness', 'enterprise_livelihood', 'whole_child_talent'],
  )
})

test('every rubric has exactly five bands, levels 0..4 in order, with non-empty descriptors', () => {
  for (const b of CBC_GATSBY_BENCHMARKS) {
    assert.equal(b.rubric.length, 5, `${b.id} rubric must have 5 bands`)
    b.rubric.forEach((band, i) => {
      assert.equal(band.level, i, `${b.id} band ${i} must be level ${i}`)
      assert.ok(band.descriptor.trim().length > 0, `${b.id} level ${i} needs a descriptor`)
    })
  }
})

test('every benchmark has a definition and a signal', () => {
  for (const b of CBC_GATSBY_BENCHMARKS) {
    assert.ok(b.name.trim().length > 0, `${b.id} needs a name`)
    assert.ok(b.definition.trim().length > 0, `${b.id} needs a definition`)
    assert.ok(b.signal.trim().length > 0, `${b.id} needs a signal`)
  }
})

test('HONESTY: horizon benchmarks (5, 6) map to NO programme; non-horizon map to ≥1 available programme', () => {
  for (const b of CBC_GATSBY_BENCHMARKS) {
    if (b.horizon) {
      assert.equal(
        b.addressed_by.length,
        0,
        `${b.id} is horizon — it must not claim a programme EduNexus does not have`,
      )
    } else {
      assert.ok(
        b.addressed_by.length >= 1,
        `${b.id} is addressed — it must map to at least one programme`,
      )
      for (const p of b.addressed_by) {
        assert.equal(p.status, 'available', `${b.id} must only map to available programmes`)
      }
    }
  }
})

test('exactly benchmarks 5 and 6 are horizon (employer encounters, workplace experiences)', () => {
  const horizon = CBC_GATSBY_BENCHMARKS.filter((b) => b.horizon).map((b) => b.order).sort((a, b) => a - b)
  assert.deepEqual(horizon, [5, 6])
})
