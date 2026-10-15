// lib/schoolEffectiveness/benchmarks.test.ts
//
// Config integrity for the eight CBC-adapted Gatsby benchmarks. These lock the
// framework's shape so a later edit cannot silently drop a benchmark, break a
// rubric, or — the honesty invariant — map a horizon benchmark (employer
// encounters / workplace experiences) to a programme EduNexus does not have.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CBC_GATSBY_BENCHMARKS } from './benchmarks'

test('there are exactly eight benchmarks with unique ids and Gatsby numbers 1–8', () => {
  assert.equal(CBC_GATSBY_BENCHMARKS.length, 8)

  const ids = new Set(CBC_GATSBY_BENCHMARKS.map((b) => b.id))
  assert.equal(ids.size, 8, 'benchmark ids must be unique')

  const numbers = CBC_GATSBY_BENCHMARKS.map((b) => b.gatsbyNumber).sort((a, b) => a - b)
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8], 'Gatsby numbers 1–8, each once')
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
  const horizon = CBC_GATSBY_BENCHMARKS.filter((b) => b.horizon).map((b) => b.gatsbyNumber).sort()
  assert.deepEqual(horizon, [5, 6])
})
