// scripts/security/audit-rules.mjs
// Pure policy logic for scripts/check-dependency-audit.mjs — takes parsed
// `npm audit --json` output plus the accepted-risk register and decides what
// blocks. No I/O, so the policy is unit-testable (audit-rules.test.ts).
//
// Policy:
//   - high/critical advisory in a production dependency → BLOCK, unless it is
//     in docs/security/accepted-risks.json and not past its expiry date
//   - an accepted advisory past its expiry date that is still present → BLOCK
//     (acceptances are dated decisions, never permanent mutes)
//   - malformed register entry → BLOCK
//   - moderate/low production advisories → warn
//   - accepted entry whose advisory is gone → warn (remove the entry)

export const BLOCKING_SEVERITIES = new Set(['high', 'critical'])

const advisoryId = url => (typeof url === 'string' ? url.split('/').pop() : null)

/**
 * Flatten npm audit's per-package `via` lists into unique advisories.
 * @returns {Array<{ id: string, package: string, severity: string, title: string, url: string }>}
 */
export function extractAdvisories(audit) {
  const byId = new Map()
  for (const [pkg, vuln] of Object.entries(audit?.vulnerabilities ?? {})) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || via === null) continue // string = transitive pointer to another entry
      const id = advisoryId(via.url)
      if (!id || byId.has(id)) continue
      byId.set(id, { id, package: via.name ?? pkg, severity: via.severity, title: via.title ?? '', url: via.url })
    }
  }
  return [...byId.values()]
}

/**
 * @param {{ audit: object, accepted: Array<object>, today: string }} input  today = 'YYYY-MM-DD'
 */
export function evaluateAudit({ audit, accepted, today }) {
  const blocking = []
  const warnings = []

  if (audit?.error) {
    blocking.push({ rule: 'audit-error', id: '-', message: `npm audit failed: ${audit.error.summary ?? JSON.stringify(audit.error)}` })
    return { blocking, warnings }
  }

  const acceptedById = new Map()
  for (const entry of accepted) {
    if (!entry.id || !entry.reason || !/^\d{4}-\d{2}-\d{2}$/.test(entry.expires ?? '')) {
      blocking.push({ rule: 'register-invalid', id: entry.id ?? '?', message: "accepted-risks entry needs 'id', 'reason' and an 'expires' date (YYYY-MM-DD)" })
      continue
    }
    acceptedById.set(entry.id, entry)
  }

  const advisories = extractAdvisories(audit)
  const presentIds = new Set(advisories.map(a => a.id))

  for (const adv of advisories) {
    const label = `${adv.package} ${adv.severity} ${adv.id} — ${adv.title}`
    const entry = acceptedById.get(adv.id)

    if (!BLOCKING_SEVERITIES.has(adv.severity)) {
      warnings.push({ rule: 'below-threshold', id: adv.id, message: label })
      continue
    }
    if (!entry) {
      blocking.push({ rule: 'new-advisory', id: adv.id, message: `${label} (${adv.url})` })
      continue
    }
    if (entry.expires < today) {
      blocking.push({ rule: 'acceptance-expired', id: adv.id, message: `${label} — acceptance expired ${entry.expires}; re-check reachability and renew or fix` })
    }
  }

  for (const id of acceptedById.keys()) {
    if (!presentIds.has(id)) warnings.push({ rule: 'acceptance-unused', id, message: 'advisory no longer present — remove it from docs/security/accepted-risks.json' })
  }

  return { blocking, warnings }
}
