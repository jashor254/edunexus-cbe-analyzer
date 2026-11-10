// scripts/standardRunnerSupport.test.ts
//
// Tests for scripts/standard-runner-support.mjs — the protection that makes
// sure every file in scripts/standard-tests.json really executes tests.
//
// Background: Node's test runner treats file arguments as globs, so a manifest
// entry containing `[learnerId]` matched nothing and "ran" zero tests while the
// suite stayed green. These tests pin the cause, the fix and the guard.
//
// Pure: reads the manifest and the file system only. No network, no database.
//
// Run: npx tsx --test scripts/standardRunnerSupport.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  globSafe, resolveProblems, filesWithTests, filesWithoutTests, reportAttributesTestsToFiles, countTestcases,
} from './standard-runner-support.mjs'

// fs.globSync is stable enough on the Node versions this suite needs (22+) but missing from older @types/node
type GlobSync = (pattern: string, options?: { cwd?: string }) => string[]
const globSync = (fs as unknown as { globSync: GlobSync }).globSync

const ROOT = resolve(__dirname, '..')
const BRACKETED = [
  'app/api/student/blueprint/[learnerId]/pdf/route.test.ts',
  'app/school-concepts/[schoolSlug]/homepageStructure.test.tsx',
]

test('RUNNER-001 the cause: a bracketed path used as a glob matches no file', () => {
  for (const p of BRACKETED) {
    assert.ok(fs.existsSync(join(ROOT, p)), `${p} exists`)
    assert.deepEqual(globSync(p, { cwd: ROOT }), [], 'as a raw glob, [learnerId] is a character class and matches nothing')
  }
})

test('RUNNER-002 globSafe replaces glob-active characters and leaves ordinary paths alone', () => {
  assert.equal(globSafe('app/api/[id]/x.test.ts'), 'app/api/?id?/x.test.ts')
  assert.equal(globSafe('a/{b,c}/d*.test.ts'), 'a/?b,c?/d?.test.ts')
  assert.equal(globSafe('lib/row/recordOfWorkCompletion.test.ts'), 'lib/row/recordOfWorkCompletion.test.ts')
  assert.equal(globSafe('app/(auth)/signup/x.test.ts'), 'app/(auth)/signup/x.test.ts', 'parentheses already match literally')
})

test('RUNNER-003 the fix: each bracketed entry resolves to exactly its own file', () => {
  assert.deepEqual(resolveProblems(BRACKETED, globSync, ROOT), [])
  for (const p of BRACKETED) assert.deepEqual(globSync(globSafe(p), { cwd: ROOT }), [p])
})

test('RUNNER-004 every registered standard test resolves to exactly one file (the manifest cannot silently rot)', () => {
  const manifest: string[] = JSON.parse(readFileSync(join(ROOT, 'scripts/standard-tests.json'), 'utf8')).files
  const all = [...manifest, 'utils/supabase/test-service.test.ts', 'utils/supabase/service.test.ts']
  assert.deepEqual(resolveProblems(all, globSync, ROOT), [])
})

test('RUNNER-005 an entry that resolves to nothing, or to the wrong file, is reported', () => {
  const problems = resolveProblems(['lib/does/not/exist.test.ts', 'lib/row/recordOfWorkCompletion.test.ts'], globSync, ROOT)
  assert.equal(problems.length, 1)
  assert.equal(problems[0].file, 'lib/does/not/exist.test.ts')
  assert.deepEqual(problems[0].matches, [])
  // a pattern that is ambiguous after substitution is also a problem
  const ambiguous = resolveProblems(['lib/row/?completion.test.ts'], () => ['lib/row/a.test.ts', 'lib/row/b.test.ts'], ROOT)
  assert.equal(ambiguous.length, 1)
})

const XML = `<?xml version="1.0" encoding="utf-8"?>
<testsuites>
  <testcase name="a" time="0.1" classname="test" file="${ROOT}/lib/a.test.ts"/>
  <testcase name="b" time="0.1" classname="test" file="${ROOT}/lib/a.test.ts"/>
  <testcase name="c" time="0.1" classname="test" file="${ROOT}/app/x/[id]/route.test.ts"/>
  <testcase name="d" time="0.1" classname="test" file="${ROOT}/lib/with&amp;amp.test.ts"/>
  <testcase name="lib/empty.test.ts" time="0.4" classname="test" file="${ROOT}/lib/empty.test.ts"/>
  <testcase name="${ROOT}/lib/empty-abs.test.ts" time="0.4" classname="test" file="${ROOT}/lib/empty-abs.test.ts"/>
  <testcase name="lib/boom.test.ts" time="0.5" classname="test" file="${ROOT}/lib/boom.test.ts" failure="test failed"><failure type="testCodeFailure" message="test failed"/></testcase>
</testsuites>`

test('RUNNER-006 filesWithTests reads every file that has at least one test case', () => {
  const found = filesWithTests(XML, ROOT)
  assert.ok(found.has(`${ROOT}/lib/a.test.ts`))
  assert.ok(found.has(`${ROOT}/app/x/[id]/route.test.ts`), 'bracketed paths are matched as plain text')
  assert.ok(found.has(`${ROOT}/lib/with&amp.test.ts`), 'XML entities in the path are decoded')
})

test('RUNNER-007 the zero-test guard: a registered file with no executed test is reported', () => {
  const missing = filesWithoutTests(['lib/a.test.ts', 'app/x/[id]/route.test.ts', 'lib/silent.test.ts'], XML, ROOT)
  assert.deepEqual(missing, ['lib/silent.test.ts'])
  assert.deepEqual(filesWithoutTests(['lib/a.test.ts'], XML, ROOT), [])
})

test('RUNNER-009 a file that loads but registers no test is reported — Node lists it as a placeholder named after the file', () => {
  assert.deepEqual(filesWithoutTests(['lib/empty.test.ts', 'lib/empty-abs.test.ts', 'lib/a.test.ts'], XML, ROOT), ['lib/empty.test.ts', 'lib/empty-abs.test.ts'])
})

test('RUNNER-010 a file that fails at import has only the placeholder, so it is reported too', () => {
  assert.deepEqual(filesWithoutTests(['lib/boom.test.ts'], XML, ROOT), ['lib/boom.test.ts'])
})

test('RUNNER-008 an empty or malformed report reports every registered file (fail closed)', () => {
  assert.deepEqual(filesWithoutTests(['lib/a.test.ts', 'lib/b.test.ts'], '', ROOT), ['lib/a.test.ts', 'lib/b.test.ts'])
  assert.deepEqual(filesWithoutTests(['lib/a.test.ts'], '<testsuites></testsuites>', ROOT), ['lib/a.test.ts'])
})

test('RUNNER-011 a report that does not name files is detected, so the guard warns instead of failing every file', () => {
  assert.equal(reportAttributesTestsToFiles(XML), true)
  const unattributed = '<testsuites><testcase name="a" time="0.1" classname="test"/><testcase name="b" time="0.1" classname="test"/></testsuites>'
  assert.equal(reportAttributesTestsToFiles(unattributed), false)
  assert.equal(countTestcases(unattributed), 2)
})

test('RUNNER-012 an empty report means nothing ran at all', () => {
  assert.equal(countTestcases(''), 0)
  assert.equal(countTestcases('<testsuites></testsuites>'), 0)
  assert.equal(reportAttributesTestsToFiles(''), false)
})
