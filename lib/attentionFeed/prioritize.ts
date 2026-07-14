import type { AttentionItem } from './types'

// Pure, deterministic selection over an already-fetched, already-ranked
// feed (see aggregate.ts's dedupeAndRank). Today's Mission and the Teacher
// Intelligence feed both call this against the same endpoint's response so
// they agree on "what's already surfaced" without any cross-component
// state — Today's Mission shows the top N, Teacher Intelligence shows the
// rest. This is the seam a future AI-prioritization pass would replace;
// nothing downstream needs to change when it does (Sprint 5).
export function topPriorityItems(items: AttentionItem[], count: number): AttentionItem[] {
  return items.filter(i => i.severity !== 'info').slice(0, count)
}
