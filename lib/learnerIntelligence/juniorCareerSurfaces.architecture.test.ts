// lib/learnerIntelligence/juniorCareerSurfaces.architecture.test.ts
//
// Junior alignment (2026-10-06) — source guards for the surfaces a pure test
// can't render. Agreed rule: Grades 7–9 are guided toward a Senior School
// pathway, not toward careers.
//
// Run: npm test -- lib/learnerIntelligence/juniorCareerSurfaces.architecture.test.ts

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
const read = (rel: string): string => readFileSync(join(ROOT, rel), 'utf8')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const rel = join(dir, name)
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(rel)
  }
  return out
}

test('student Career Explorer: Juniors get the pathway panel, not the career catalogue', () => {
  const page = read('app/student/career/page.tsx')
  assert.ok(page.includes("import { careerModeForGrade } from '@/lib/learnerIntelligence/careerIntelligence'"), 'must use the one canonical grade gate')
  assert.ok(page.includes("careerModeForGrade(grade) === 'exploration'"))
  const gateAt = page.indexOf('isJunior && grade !== null ? (')
  const catalogueAt = page.indexOf('Explore All Careers')
  assert.ok(gateAt >= 0 && catalogueAt > gateAt, 'the catalogue must sit behind the Junior gate')
  assert.ok(page.includes('if (learnerResolved && !isJunior) loadCareers()'), 'the catalogue must not even be fetched for Juniors')
  assert.ok(page.includes('<JuniorPathwayPanel'))
})

test('the pathway → fields content has exactly one copy', () => {
  const marker = "'Medicine & Health', 'Engineering', 'Computing', 'Applied Sciences'"
  const holders = walk('lib').concat(walk('app'), walk('components')).filter(f => read(f).includes(marker))
  assert.deepEqual(holders, ['lib/curriculum/pathwayFields.ts'])
})

test('Junior families no longer carry career titles anywhere in app or components', () => {
  const offenders = walk('app').concat(walk('components'), walk('lib')).filter(f => read(f).includes('exampleCareerTitles'))
  assert.deepEqual(offenders, [])
})

test('Career Intelligence Report AI prompt forbids job titles for Juniors', () => {
  assert.ok(read('lib/career/careerIntelligenceEngine.ts').includes('Do not name any specific job title or profession at all'))
})

test('Holiday Plan points Juniors to pathways through the canonical gate', () => {
  const planner = read('lib/holiday/planner.ts')
  assert.ok(planner.includes("careerModeForGrade(grade) === 'exploration'"))
  assert.ok(planner.includes('three Senior School pathways'))
})
