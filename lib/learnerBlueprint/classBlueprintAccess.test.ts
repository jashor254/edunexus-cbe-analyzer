// lib/learnerBlueprint/classBlueprintAccess.test.ts
//
// A static guard on the Class Blueprint's one access-control boundary.
//
// `getClassRoster(classId, termId)` filters on class_id + term_id only — it has
// no school scoping of its own. The school-scoped `getClass(classId, schoolId)`
// is therefore the ONLY thing standing between a caller and another school's
// roster. The first version of classBlueprint.ts ran the two concurrently with
// `getClass(...).catch(() => null)`, which meant a foreign class id returned a
// full roster and merely lost the class name — a cross-school read with almost
// no visible symptom.
//
// This is a source-level assertion rather than an integration test on purpose:
// the failure mode is a *shape* (tolerating the guard, or ordering it after the
// roster fetch) that is easy to reintroduce during a refactor and expensive to
// catch with fixtures.
//
// Run: npx tsx --test lib/learnerBlueprint/classBlueprintAccess.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const RAW = readFileSync(path.resolve(__dirname, 'classBlueprint.ts'), 'utf8')

// Comments are stripped before matching. classBlueprint.ts documents the exact
// anti-pattern it must not contain ("getClass(...).catch(() => null)"), and a
// naive scan would flag that explanation as the bug it warns about — the guard
// has to read code, not prose.
const SOURCE = RAW
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

test('the school-scoped class lookup is never made tolerant', () => {
  assert.doesNotMatch(
    SOURCE,
    /getClass\([^)]*\)\s*\.catch/,
    'getClass() is the access-control boundary — swallowing its rejection re-opens the cross-school roster read',
  )
})

test('the class is resolved before the roster is fetched, never concurrently', () => {
  const guardAt  = SOURCE.indexOf('await getClass(')
  const rosterAt = SOURCE.indexOf('await getClassRoster(')

  assert.ok(guardAt !== -1, 'classBlueprint.ts must call getClass()')
  assert.ok(rosterAt !== -1, 'classBlueprint.ts must call getClassRoster()')
  assert.ok(
    guardAt < rosterAt,
    'the school-scoped lookup must complete before the unscoped roster read, so a foreign class never reaches it',
  )

  // Promise.all over the two would satisfy the ordering check above while still
  // issuing the roster read for a class the caller may not be entitled to.
  assert.doesNotMatch(
    SOURCE,
    /Promise\.all\(\[[^\]]*getClassRoster/,
    'the roster read must not be raced with the access-control lookup',
  )
})

test('the roster read is school-scoped only through getClass — no second, unguarded path exists', () => {
  const rosterCalls = SOURCE.match(/await getClassRoster\(/g) ?? []
  assert.equal(rosterCalls.length, 1, 'exactly one roster read, so there is one boundary to guard')
})
