// The variant review card and its view model expose answer keys and teacher
// notes (audit F-02). They must only ever be imported from teacher surfaces.
// Static scan, no I/O beyond reading source files.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const REPO_ROOT = join(__dirname, '..', '..')

// Every surface a learner or parent renders or calls.
const LEARNER_FACING_ROOTS = ['app/student', 'app/(parent)', 'app/api/student', 'app/api/parent', 'components/student', 'components/parent']

const TEACHER_ONLY_MODULES = [/components\/teacher\/VariantReviewContent/, /lib\/assignments\/variantReview/, /lib\/assignments\/answerLeakage/]

function sourceFiles(dir: string): string[] {
  let entries: string[]
  try { entries = readdirSync(dir) } catch { return [] }
  return entries.flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx)$/.test(name) ? [path] : []
  })
}

test('no learner- or parent-facing file imports the teacher variant review (answer keys stay off learner surfaces)', () => {
  const files = LEARNER_FACING_ROOTS.flatMap(root => sourceFiles(join(REPO_ROOT, root)))
  assert.ok(files.length > 0, 'expected to scan real learner-facing files — a path rename would make this test vacuous')

  const offenders = files.filter(file => {
    const imports = readFileSync(file, 'utf8').match(/from\s+['"][^'"]+['"]/g) ?? []
    return imports.some(spec => TEACHER_ONLY_MODULES.some(pattern => pattern.test(spec)))
  })
  assert.deepEqual(offenders.map(f => relative(REPO_ROOT, f)), [])
})
