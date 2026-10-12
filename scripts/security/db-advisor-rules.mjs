// scripts/security/db-advisor-rules.mjs
// Pure policy logic for scripts/check-supabase-advisors.mjs — takes the
// Supabase security-advisor response ({ lints: [...] }) plus the 'database'
// section of docs/security/accepted-risks.json and decides what blocks.
// No I/O, so the policy is unit-testable (db-advisor-rules.test.ts).
//
// Policy:
//   - WARN/ERROR security finding whose (lint, entity) is not accepted → BLOCK
//     (e.g. a new migration adds a table without RLS, or an anon-callable
//     SECURITY DEFINER function)
//   - accepted (lint, entity) past its expiry date, still present → BLOCK
//   - malformed register entry, or a response without a lints array → BLOCK
//   - INFO findings → warn; accepted entities no longer reported → warn

export const BLOCKING_LEVELS = new Set(['WARN', 'ERROR'])

const entityOf = finding => finding?.metadata?.name ?? finding?.metadata?.entity ?? '?'

/**
 * Supabase returns one lint object per rule with a `findings` array (MCP shape),
 * or one object per finding (Management API shape). Normalise to one row per finding.
 * @returns {Array<{ lint: string, level: string, entity: string, detail: string }>}
 */
export function flattenLints(response) {
  const rows = []
  for (const lint of response.lints) {
    if (!(lint.categories ?? ['SECURITY']).includes('SECURITY')) continue
    const findings = Array.isArray(lint.findings) ? lint.findings : [lint]
    for (const f of findings) {
      rows.push({ lint: lint.name, level: lint.level, entity: entityOf(f), detail: f.detail ?? lint.detail ?? '' })
    }
  }
  return rows
}

/**
 * @param {{ response: object, accepted: Array<object>, today: string }} input  today = 'YYYY-MM-DD'
 */
export function evaluateAdvisors({ response, accepted, today }) {
  const blocking = []
  const warnings = []

  if (!response || !Array.isArray(response.lints)) {
    blocking.push({ rule: 'advisor-response-invalid', key: '-', message: 'advisor response has no lints array — the (experimental) endpoint may have changed; check before trusting a green run' })
    return { blocking, warnings }
  }

  const acceptedByKey = new Map()
  for (const entry of accepted) {
    if (!entry.lint || !Array.isArray(entry.entities) || !entry.reason || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? '')) {
      blocking.push({ rule: 'register-invalid', key: entry.lint ?? '?', message: "database entry needs 'lint', 'entities', 'reason' and an 'expires' date (YYYY-MM-DD)" })
      continue
    }
    for (const entity of entry.entities) acceptedByKey.set(`${entry.lint}:${entity}`, entry)
  }

  const rows = flattenLints(response)
  const presentKeys = new Set(rows.map(r => `${r.lint}:${r.entity}`))

  for (const row of rows) {
    const key = `${row.lint}:${row.entity}`
    if (!BLOCKING_LEVELS.has(row.level)) {
      warnings.push({ rule: 'below-threshold', key, message: row.detail })
      continue
    }
    const entry = acceptedByKey.get(key)
    if (!entry) {
      blocking.push({ rule: 'new-db-finding', key, message: `${row.level} ${key} — ${row.detail}` })
    } else if (entry.expires < today) {
      blocking.push({ rule: 'acceptance-expired', key, message: `${key} — acceptance expired ${entry.expires}; re-review or fix` })
    }
  }

  for (const key of acceptedByKey.keys()) {
    if (!presentKeys.has(key)) warnings.push({ rule: 'acceptance-unused', key, message: 'no longer reported — remove it from docs/security/accepted-risks.json' })
  }

  return { blocking, warnings }
}
