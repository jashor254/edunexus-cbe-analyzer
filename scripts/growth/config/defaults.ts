/** Shared across every county config so the search-phrase set lives in exactly one place (CLAUDE.md: no duplicate constant definitions). A county file can still pass its own array if a region needs something different. */
export const DEFAULT_SEARCH_TERMS = [
  'secondary school',
  'junior secondary school',
  'high school',
  'academy',
  'private school',
  'mixed secondary school',
  'girls high school',
  'boys high school',
  'CBC school',
]
