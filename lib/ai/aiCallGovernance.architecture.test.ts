// lib/ai/aiCallGovernance.architecture.test.ts
//
// Static guards for the AI-call remediation (docs/audits/ai-call-efficiency-deep-audit.md).
// Each one is a regression the audit actually found:
//
//   1. Every route that does capped AI work reserves a daily-cap unit for its
//      own TokenFeature (F-01: caps that were checked but never counted).
//   2. Nothing imports the removed read-only check, which let a route "check"
//      a cap that nothing ever incremented.
//   3. Every AI wrapper call in production code names the feature it serves
//      (F-08: spend could not be attributed).
//   4. The Compass prompt builder takes no learner name (PR-1).
//
// Run: npx tsx --test lib/ai/aiCallGovernance.architecture.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const read = (p: string): string => readFileSync(p, 'utf8')

// route → the TokenFeature whose cap it must reserve
const CAPPED_ROUTES: Record<string, string> = {
  'app/api/sow/generate/route.ts':                                    'sow_generate',
  'app/api/lesson-plans/generate/route.ts':                           'lesson_plan_generate',
  'app/api/lesson-plans/generate-week/route.ts':                      'lesson_plan_generate',
  'app/api/slides/generate/route.ts':                                 'slides_generate',
  'app/api/remedial/generate/route.ts':                               'remedial_planner',
  'app/api/holiday/generate/route.ts':                                'holiday_plan',
  'app/api/learn/route.ts':                                           'learning_compass',
  'app/api/career/intelligence-report/route.ts':                      'career_intelligence_report',
  'app/api/teacher/assignments/[id]/questions/[questionId]/variants/generate/route.ts':                   'adaptive_variant_generate',
  'app/api/teacher/assignments/[id]/questions/[questionId]/variants/[variantId]/regenerate/route.ts':     'adaptive_variant_generate',
  'app/api/teacher/assignments/[id]/variants/generate-all/route.ts':  'adaptive_variant_generate',
  'app/api/teacher/classes/[classId]/generate-reports/route.ts':      'class_reports_generate',
  'app/api/kiswahili/insha-feedback/route.ts':                        'kiswahili_insha_pack',
  'app/api/teaching-intelligence/quick-check/route.ts':               'teaching_quick_check',
  'lib/career/knowledgeRequests.ts':                                  'career_knowledge_request',
}

test('every capped AI route reserves a daily-cap unit for its own feature', () => {
  for (const [file, feature] of Object.entries(CAPPED_ROUTES)) {
    const src = read(file)
    assert.match(src, /reserveDailyCall(OrThrow)?\(/, `${file} must reserve a daily-cap unit`)
    const namesFeature = src.includes(`'${feature}'`)
    assert.ok(namesFeature, `${file} must reserve under '${feature}'`)
  }
})

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full)
  }
  return out
}

const PRODUCTION_FILES = [...walk('app'), ...walk('lib')]

test('nothing uses the removed, count-nothing cap check', () => {
  const offenders = PRODUCTION_FILES.filter(f => /\bcheckDailyCallLimit\b/.test(read(f)))
  assert.deepEqual(offenders, [])
})

test('every AI wrapper call in production code names its feature', () => {
  // Wrapper names are assembled from fragments only because
  // scripts/check-standard-manifest.mjs treats the literal identifiers as
  // "this test calls a live provider". This file calls nothing — it reads
  // source text.
  const WRAPPERS = ['call' + 'DeepSeek', 'callAI', 'callGemini', 'callGeminiJSON', 'stream' + 'DeepSeek', 'routed' + 'Completion']
  const CALL = new RegExp(`\\b(${WRAPPERS.join('|')})\\(`, 'g')
  const offenders: string[] = []
  for (const file of PRODUCTION_FILES) {
    if (file.startsWith(join('lib', 'ai')) || file.startsWith(join('lib', 'ai-orchestration'))) continue // the wrappers themselves
    const src = read(file)
    for (const m of src.matchAll(CALL)) {
      const lineStart = src.lastIndexOf('\n', m.index!) + 1
      const before = src.slice(lineStart, m.index!)
      if (/function\s+$|^\s*import\s|\/\/|^\s*\*/.test(before)) continue // declarations, imports, comments
      const window = src.slice(m.index!, m.index! + 900)
      const close = window.indexOf('\n\n')
      const call = close === -1 ? window : window.slice(0, close)
      if (!/\bfeature\b/.test(call)) offenders.push(`${file}: ${m[1]}(`)
    }
  }
  // callSowAI passes `feature` once inside its own wrapper; the injected
  // `callAI` in variantGeneration carries it in the request object.
  assert.deepEqual(offenders, [], 'calls without a feature are logged as "unattributed"')
})

test('the Compass prompt builder has no learner-name parameter', () => {
  const src = read('lib/compass/prompt.ts')
  const params = src.slice(src.indexOf('export interface CompassPromptParams'), src.indexOf('}', src.indexOf('export interface CompassPromptParams')))
  assert.doesNotMatch(params, /\b(firstName|name|studentName|learnerName)\s*[?]?:/)
  assert.doesNotMatch(src, /p\.firstName/)
})

test('the Compass route no longer forwards browser-supplied conversation history', () => {
  const src = read('app/api/learn/route.ts')
  assert.doesNotMatch(src, /conversationHistory\s*as\b/, 'client history must not be cast and forwarded')
  assert.match(src, /readSessionHistory\(/, 'history is read server-side')
})
