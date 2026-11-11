// lib/ai/childDataPolicy.test.ts
//
// Pins the learner-data AI containment switch and proves the classification of
// every AI-provider feature in the source tree is explicit (default deny).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import {
  CHILD_DATA_AI_ENABLED,
  CHILD_DATA_AI_FEATURES,
  GENERIC_CONTENT_AI_FEATURES,
  CHILD_DATA_AI_PAUSED_CODE,
  CHILD_DATA_AI_PAUSED_MESSAGE,
  ChildDataAIPausedError,
  assertAIFeatureAllowed,
  isChildDataAIBlocked,
  isChildDataAIPaused,
} from './childDataPolicy'

test('the switch is OFF and pinned in source (a flip must be a reviewed code change, never an env var)', () => {
  assert.equal(CHILD_DATA_AI_ENABLED, false)
  assert.equal(isChildDataAIPaused(), true)
  const src = readFileSync(join(process.cwd(), 'lib/ai/childDataPolicy.ts'), 'utf8')
  assert.match(src, /CHILD_DATA_AI_ENABLED:\s*boolean\s*=\s*false/)
  assert.doesNotMatch(src, /process\.env/, 'the switch must not be readable from the environment')
})

test('classification lists are disjoint and free of duplicates', () => {
  const child = new Set<string>(CHILD_DATA_AI_FEATURES)
  const generic = new Set<string>(GENERIC_CONTENT_AI_FEATURES)
  assert.equal(child.size, CHILD_DATA_AI_FEATURES.length)
  assert.equal(generic.size, GENERIC_CONTENT_AI_FEATURES.length)
  for (const f of child) assert.ok(!generic.has(f), `${f} is in both lists`)
})

test('every learner-data feature is blocked; only listed generic features pass; everything else is denied', () => {
  for (const f of CHILD_DATA_AI_FEATURES) assert.equal(isChildDataAIBlocked(f), true, f)
  for (const f of GENERIC_CONTENT_AI_FEATURES) assert.equal(isChildDataAIBlocked(f), false, f)
  for (const f of [undefined, null, '', 'unattributed', 'some_new_feature', 'LEARNING_COMPASS']) {
    assert.equal(isChildDataAIBlocked(f as string | null | undefined), true, String(f))
  }
})

test('assertAIFeatureAllowed throws a typed, honest error and never mentions maintenance', () => {
  assert.throws(() => assertAIFeatureAllowed('learning_compass'), (err: unknown) => {
    assert.ok(err instanceof ChildDataAIPausedError)
    assert.equal(err.code, CHILD_DATA_AI_PAUSED_CODE)
    assert.equal(err.feature, 'learning_compass')
    return true
  })
  assert.doesNotThrow(() => assertAIFeatureAllowed('sow_generate'))
  assert.doesNotMatch(CHILD_DATA_AI_PAUSED_MESSAGE, /maintenance|technical|outage|try again later/i)
  assert.match(CHILD_DATA_AI_PAUSED_MESSAGE, /review/i)
  assert.match(CHILD_DATA_AI_PAUSED_MESSAGE, /not affected/i)
})

// ── Architecture: every provider-call feature in the source tree is classified ──

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

// Provider entry points whose options carry a `feature` attribution. Names are assembled from parts so this
// source-scanning test does not itself read as an AI-boundary call to the STANDARD-tier manifest guard.
const ENTRY_POINTS = [['call', 'DeepSeek'], ['call', 'AI'], ['routed', 'Completion'], ['call', 'GeminiJSON'], ['stream', 'DeepSeek'], ['start', 'LogicalCall']]
  .map(parts => parts.join(''))
const CALL_TOKEN = new RegExp(`\\b(${ENTRY_POINTS.join('|')})\\s*\\(`, 'g')

function featuresFromSource(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  const roots = ['lib', 'app'].map(r => join(process.cwd(), r))
  for (const file of roots.flatMap(r => walk(r))) {
    const rel = file.slice(process.cwd().length + 1)
    // The provider layer itself passes features through; it declares none.
    if (rel.startsWith('lib/ai/') || rel.startsWith('lib/ai-orchestration/')) continue
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(CALL_TOKEN)) {
      const window = text.slice(m.index!, m.index! + 800)
      const feat = window.match(/feature:\s*('([^']+)'|([A-Za-z_][A-Za-z0-9_]*))/)
      if (!feat) continue
      let value = feat[2]
      if (!value && feat[3]) {
        const decl = text.match(new RegExp(`const\\s+${feat[3]}\\b[^=]*=\\s*'([^']+)'`))
        value = decl?.[1]
      }
      if (!value) continue
      found.set(value, [...(found.get(value) ?? []), rel])
    }
  }
  return found
}

test('every provider-call feature in lib/ and app/ is explicitly classified (new features default to blocked and fail this test)', () => {
  const found = featuresFromSource()
  assert.ok(found.size >= 12, `source scan found only ${found.size} features — the scan has rotted`)
  const classified = new Set<string>([...CHILD_DATA_AI_FEATURES, ...GENERIC_CONTENT_AI_FEATURES])
  const unclassified = [...found.entries()].filter(([f]) => !classified.has(f)).map(([f, files]) => `${f} (${[...new Set(files)].join(', ')})`)
  assert.deepEqual(unclassified, [], `unclassified AI features: ${unclassified.join('; ')}`)
  // The learner-data features the audit identified must really be wired somewhere.
  for (const f of ['learning_compass', 'kiswahili_insha_pack', 'paper_intelligence_mark_script', 'paper_intelligence_mark_page', 'career_intelligence_report', 'holiday_plan', 'class_reports_generate']) {
    assert.ok(found.has(f), `expected ${f} to be attributed in source`)
  }
})
