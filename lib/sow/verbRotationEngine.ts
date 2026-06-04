// lib/sow/verbRotationEngine.ts
// Tracks recently used verbs across lesson batches and provides
// rotation instructions for the AI prompt, ensuring outcome variety.

import { getVerbPool, normalizeVerb, scoreOutcome, VERB_SCORES } from './verbLibrary'

// ─── Types ────────────────────────────────────────────────────────────────────

interface VerbRecord {
  verb: string
  lessonIndex: number
}

// ─── VerbRotationEngine ───────────────────────────────────────────────────────

export class VerbRotationEngine {
  private history: VerbRecord[] = []
  private lessonCounter = 0
  private readonly WINDOW: number

  constructor(windowSize = 15) {
    this.WINDOW = windowSize
  }

  // ── Record verbs from a successfully generated lesson ─────────────────────

  recordUsed(outcomes: string[]): void {
    this.lessonCounter++
    for (const outcome of outcomes) {
      const verb = this.extractOpeningVerb(outcome)
      if (verb) {
        this.history.push({ verb, lessonIndex: this.lessonCounter })
      }
    }
    // Prune history beyond 3× window to keep memory bounded
    const cutoff = this.lessonCounter - this.WINDOW * 3
    this.history = this.history.filter(r => r.lessonIndex > cutoff)
  }

  // ── Get the list of recently used verbs (for prompt injection) ────────────

  getRecentVerbs(): string[] {
    const cutoff = this.lessonCounter - this.WINDOW
    const recent = this.history
      .filter(r => r.lessonIndex > cutoff)
      .map(r => r.verb)
    return [...new Set(recent)]
  }

  // ── Format a prompt-ready avoid instruction ───────────────────────────────

  formatAvoidInstruction(): string {
    const recent = this.getRecentVerbs()
    if (recent.length === 0) {
      return 'This is the first lesson — choose verbs freely from the curriculum verb list.'
    }
    return (
      `VERB ROTATION — DO NOT use these as opening verbs in learning outcomes:\n` +
      `  ${recent.join(', ')}\n` +
      `Use fresh verbs from the full curriculum verb list instead.`
    )
  }

  // ── Pick a fresh verb for a given cognitive level + subject ───────────────
  // Useful for seeding suggestions in prompts or testing.

  pickVerb(level: 0 | 1 | 2, subjectType: string): string {
    const pool = getVerbPool(level, subjectType)
    const recent = new Set(this.getRecentVerbs())

    // Priority 1: unused + high score
    const fresh = pool.filter(v => !recent.has(normalizeVerb(v)))
    if (fresh.length > 0) {
      return this.selectWeighted(fresh)
    }

    // Fallback: least-recently used from full pool
    const lruMap = new Map<string, number>()
    for (const r of this.history) {
      lruMap.set(r.verb, r.lessonIndex)
    }
    const sorted = [...pool].sort((a, b) => {
      const aIdx = lruMap.get(normalizeVerb(a)) ?? 0
      const bIdx = lruMap.get(normalizeVerb(b)) ?? 0
      return aIdx - bIdx  // oldest used first
    })
    return sorted[0] ?? pool[0]
  }

  // ── Get a formatted verb suggestions block for the AI prompt ─────────────

  getSuggestionsBlock(subjectType: string): string {
    const l1 = this.pickVerb(0, subjectType)
    const l2 = this.pickVerb(1, subjectType)
    const l3 = this.pickVerb(2, subjectType)
    return (
      `SUGGESTED VERBS FOR THIS LESSON (rotate from these, avoid repeats):\n` +
      `  Level 1 (knowledge): ${l1} — or any similar fresh verb\n` +
      `  Level 2 (application): ${l2} — or any similar fresh verb\n` +
      `  Level 3 (values): ${l3} — or any similar fresh verb`
    )
  }

  // ── Reset for a new scheme ────────────────────────────────────────────────

  reset(): void {
    this.history = []
    this.lessonCounter = 0
  }

  // ── Internal: extract the opening verb from an outcome sentence ───────────

  private extractOpeningVerb(outcome: string): string {
    const words = outcome
      .toLowerCase()
      .replace(/^(by the end[^,]+,\s*)/i, '')  // strip "by the end of the lesson..."
      .replace(/^(learners?\s+(will\s+)?(be able to\s+)?)/i, '')  // strip "learners will..."
      .trim()
      .split(/[\s,;.(]+/)
    for (const w of words.slice(0, 3)) {
      const norm = normalizeVerb(w)
      if (norm.length >= 3) return norm
    }
    return ''
  }

  // ── Internal: weighted random selection (higher VERB_SCORES = more likely) ─

  private selectWeighted(verbs: string[]): string {
    const weights = verbs.map(v => {
      const norm = normalizeVerb(v)
      return VERB_SCORES[norm] ?? VERB_SCORES[v] ?? 5
    })
    const total = weights.reduce((a, b) => a + b, 0)
    let r = Math.random() * total
    for (let i = 0; i < verbs.length; i++) {
      r -= weights[i]
      if (r <= 0) return verbs[i]
    }
    return verbs[verbs.length - 1]
  }
}
