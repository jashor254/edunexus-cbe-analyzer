const TOKEN_PATTERN = /\{\{(\w+)\}\}/g

/**
 * Sprint PE-8 Part 3/4 — substitutes {{token}} placeholders with real
 * values. A cosmetic connector token (name ends in `_greeting`) collapses
 * to '' when unknown, so a missing contact name degrades to "Good day,"
 * instead of a broken sentence. Any other token with no known value is left
 * in the text verbatim and reported in `unresolved`, so the founder always
 * sees exactly what still needs a manual edit before sending — never a
 * silently blanked fact.
 */
export function renderTemplate(text: string, variables: Record<string, string | null>): { text: string; unresolved: string[] } {
  const unresolved: string[] = []
  const rendered = text.replace(TOKEN_PATTERN, (match, key: string) => {
    const value = variables[key]
    if (value !== null && value !== undefined) return value
    if (key.endsWith('_greeting')) return ''
    if (!unresolved.includes(key)) unresolved.push(key)
    return match
  })
  return { text: rendered, unresolved }
}
