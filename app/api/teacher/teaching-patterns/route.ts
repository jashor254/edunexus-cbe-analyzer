// GET /api/teacher/teaching-patterns?classId=...&termWeeks=8
// The closed loop: teacher sees what their OWN formative signals reveal about their teaching.
// Where do students consistently land in 'lost'? That's a teaching pattern, not a student problem.

import { createClient } from '@/utils/supabase/server'
import { createServiceClient } from '@/utils/supabase/service'
import { apiSuccess, apiError, apiUnauthorized, apiForbidden } from '@/lib/api/response'
import type { TeachingPatternInsight } from '@/lib/learnerModel/types'

export async function GET(req: Request): Promise<Response> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiUnauthorized()

    const db = createServiceClient()
    const { data: teacher } = await db
      .from('teachers')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!teacher) return apiForbidden()

    const url       = new URL(req.url)
    const classId   = url.searchParams.get('classId')
    const termWeeks = parseInt(url.searchParams.get('termWeeks') ?? '8', 10)
    if (!classId) return apiError('classId is required', 400)

    // Verify teacher owns this class
    const { data: cls } = await db
      .from('teacher_classes')
      .select('id')
      .eq('id', classId)
      .eq('teacher_id', teacher.id)
      .maybeSingle()
    if (!cls) return apiForbidden()

    // Fetch last N weeks of formative signals
    const since = new Date()
    since.setDate(since.getDate() - termWeeks * 7)

    const { data: signals, error: sigErr } = await db
      .from('formative_signals')
      .select('subject, sub_strand, got_it_ids, confused_ids, lost_ids, recorded_at')
      .eq('teacher_id', teacher.id)
      .eq('class_id', classId)
      .gte('recorded_at', since.toISOString())
      .order('recorded_at', { ascending: false })

    if (sigErr) throw new Error(sigErr.message)

    const rows = signals ?? []

    // ── Aggregate by substrand ────────────────────────────────────────────────
    // Count how many SIGNALS (not student-ids within a signal) each substrand
    // appears in for each outcome bucket.

    type SubstrandBucket = {
      substrand:      string
      got_it_count:   number
      confused_count: number
      lost_count:     number
    }

    const buckets = new Map<string, SubstrandBucket>()

    for (const row of rows) {
      const substrand = (row.sub_strand as string | null) ?? 'Unknown substrand'

      if (!buckets.has(substrand)) {
        buckets.set(substrand, { substrand, got_it_count: 0, confused_count: 0, lost_count: 0 })
      }

      const b = buckets.get(substrand)!

      // Count the signal's presence in each bucket (not the array length of student ids)
      const gotItIds    = (row.got_it_ids   as string[] | null) ?? []
      const confusedIds = (row.confused_ids as string[] | null) ?? []
      const lostIds     = (row.lost_ids     as string[] | null) ?? []

      if (gotItIds.length   > 0) b.got_it_count++
      if (confusedIds.length > 0) b.confused_count++
      if (lostIds.length    > 0) b.lost_count++
    }

    // ── Build patterns — only substrands with lost_count >= 2 ────────────────
    const patterns: TeachingPatternInsight[] = []

    for (const b of buckets.values()) {
      if (b.lost_count < 2) continue

      const suggestion = b.lost_count >= 5
        ? 'Consider a whole-class reteach with a different approach'
        : b.lost_count >= 3
          ? 'This substrand may have a prerequisite gap — check the knowledge graph'
          : 'Watch this substrand — 2 \'lost\' signals is an early warning'

      patterns.push({
        pattern:    `Students consistently struggle with ${b.substrand} — marked 'lost' ${b.lost_count} time${b.lost_count !== 1 ? 's' : ''} in ${termWeeks} weeks`,
        count:      b.lost_count,
        suggestion,
        substrands: [b.substrand],
      })
    }

    // Sort strongest patterns first
    patterns.sort((a, b) => b.count - a.count)

    // ── Overall stats ─────────────────────────────────────────────────────────
    const totalSignals = rows.length

    let totalGotIt    = 0
    let totalStudents = 0

    for (const row of rows) {
      const gotItIds    = (row.got_it_ids   as string[] | null) ?? []
      const confusedIds = (row.confused_ids as string[] | null) ?? []
      const lostIds     = (row.lost_ids     as string[] | null) ?? []
      const rowTotal    = gotItIds.length + confusedIds.length + lostIds.length
      totalGotIt    += gotItIds.length
      totalStudents += rowTotal
    }

    const avgGotItPct = totalStudents > 0
      ? Math.round((totalGotIt / totalStudents) * 100)
      : 0

    // Most consistent strength = substrand with highest got_it ratio (min 2 signals)
    let mostConsistentStrength: string | null = null
    let highestGotItRatio = 0

    for (const b of buckets.values()) {
      const total = b.got_it_count + b.confused_count + b.lost_count
      if (total < 2) continue
      const ratio = b.got_it_count / total
      if (ratio > highestGotItRatio) {
        highestGotItRatio     = ratio
        mostConsistentStrength = b.substrand
      }
    }

    return apiSuccess({
      patterns,
      stats: {
        total_signals:           totalSignals,
        avg_got_it_pct:          avgGotItPct,
        most_consistent_strength: mostConsistentStrength,
        weeks_analyzed:          termWeeks,
      },
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[teaching-patterns]', msg)
    return apiError('Failed to load teaching patterns')
  }
}
