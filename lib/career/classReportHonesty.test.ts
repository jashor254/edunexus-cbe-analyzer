// lib/career/classReportHonesty.test.ts
//
// Class reports must not look complete when their AI step failed
// (docs/audits/ai-call-efficiency-deep-audit.md F-03). The Compass briefing
// used to fail silently (null) while the learner was still counted 'ok' —
// and the run charged. Now the learner is an error, and their existing
// learning context is left untouched.
//
// No DB: a minimal typed fake of the Supabase query chain records writes.
//
// Run: npx tsx --experimental-test-module-mocks --test lib/career/classReportHonesty.test.ts
import { test, before, beforeEach, mock } from 'node:test'
import assert from 'node:assert/strict'

let aiFails = true
mock.module('@/lib/ai/deepseek', {
  namedExports: {
    callDeepSeek: async () => {
      if (aiFails) throw new Error('All providers failed')
      return JSON.stringify({
        sessionGoal: 'LLM goal', firstSubject: 'mathematics', firstConcept: 'fractions', startDifficulty: 2,
        subjectPriorities: [], weeklyMilestones: [{ week: 1, goal: 'g', subject: 'mathematics', checkConcept: 'fractions' }],
        parentWhatsAppMessage: 'hi',
      })
    },
  },
})
mock.module('./clinicReportBuilder', { namedExports: { buildClinicReport: async () => ({}) } })

type Write = { table: string; payload: Record<string, unknown> }
let writes: Write[] = []
let knowledgeRootCauses: unknown = null

const TABLE_ROWS: Record<string, () => unknown> = {
  class_students: () => [{ student_id: 's1' }],
  students: () => [{ id: 's1', name: 'Synthetic Learner', grade: 8, curriculum_type: 'cbc' }],
  student_learning_context: () => ({ overall_tier: 'approaching_expectations', subject_tiers: {}, subject_action_steps: {}, compass_bridge: {}, knowledge_root_causes: knowledgeRootCauses }),
  assessments: () => [{ subject_scores: { mathematics: 2 } }],
}

class FakeQuery {
  constructor(private readonly table: string) {}
  select(): this { return this }
  eq(): this { return this }
  in(): this { return this }
  order(): this { return this }
  limit(): this { return this }
  update(payload: Record<string, unknown>): this { writes.push({ table: this.table, payload }); return this }
  private rows(): unknown { return TABLE_ROWS[this.table]?.() ?? null }
  private first(): unknown { const r = this.rows(); return Array.isArray(r) ? r[0] ?? null : r }
  single(): Promise<{ data: unknown; error: null }> { return Promise.resolve({ data: this.first(), error: null }) }
  maybeSingle(): Promise<{ data: unknown; error: null }> { return Promise.resolve({ data: this.first(), error: null }) }
  then<T>(resolve: (v: { data: unknown; error: null }) => T): Promise<T> { return Promise.resolve({ data: this.rows(), error: null }).then(resolve) }
}
type ReportDb = Parameters<typeof import('./autoReportGenerator').generateClassReports>[2]
const db = { from: (table: string) => new FakeQuery(table) } as unknown as ReportDb

let generateClassReports: typeof import('./autoReportGenerator').generateClassReports
before(async () => { ({ generateClassReports } = await import('./autoReportGenerator')) })
beforeEach(() => { writes = []; aiFails = true; knowledgeRootCauses = null })

test('a failed Compass briefing makes the learner an error (not ok) and writes nothing to their context', async () => {
  const r = await generateClassReports('c1', ['a1'], db)
  assert.equal(r.success, 0, 'nothing complete → nothing to charge for')
  assert.equal(r.failed, 1)
  assert.match(r.results[0].error ?? '', /Compass briefing could not be generated/)
  assert.equal(writes.filter(w => w.table === 'student_learning_context').length, 0)
})

test('with graph root causes present, a successful briefing still never overwrites session_goal / guided_topics', async () => {
  aiFails = false
  knowledgeRootCauses = [{ subject: 'mathematics', failing_topic_name: 'Algebra', performance: 1, root_causes: [] }]
  const r = await generateClassReports('c1', ['a1'], db)
  assert.equal(r.success, 1)
  const ctxWrite = writes.find(w => w.table === 'student_learning_context')
  assert.ok(ctxWrite, 'the bridge itself is still written')
  assert.ok(!('session_goal' in ctxWrite!.payload), 'graph-derived session_goal kept')
  assert.ok(!('guided_topics' in ctxWrite!.payload), 'graph-derived guided_topics kept')
})

test('without graph data a successful briefing writes its goal and topics as before', async () => {
  aiFails = false
  await generateClassReports('c1', ['a1'], db)
  const ctxWrite = writes.find(w => w.table === 'student_learning_context')
  assert.equal(ctxWrite?.payload.session_goal, 'LLM goal')
  assert.deepEqual(ctxWrite?.payload.guided_topics, ['fractions'])
})
