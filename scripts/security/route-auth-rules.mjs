// scripts/security/route-auth-rules.mjs
// Pure rule logic for scripts/check-route-auth.mjs — no filesystem access, so
// every rule is unit-testable (route-auth-rules.test.ts).
//
// Enforces the CLAUDE.md security rules at the route level, which generic
// scanners can't: they don't know that requireSchoolMembership() or
// checkFeatureAccess() authenticate the caller.
//
// Limitation (deliberate, start-simple): guards are detected per FILE, not per
// exported handler. A file whose POST is guarded but whose GET is not will
// pass. Per-handler analysis is a follow-up once this gate has proven itself.

// Calls that authenticate the caller directly. Each was verified to call
// supabase.auth.getUser() (or a function that does) before being listed.
// A new guard helper must be added here deliberately — that review is the point.
export const DIRECT_GUARD_CALLS = [
  'auth.getUser',
  'requireAuthentication',
  'requireAuth',
  'requireClassTeacher',
  'requireGrowthUser',
  'requireSchoolAdmin',
  'requireSchoolMembership',
  'requireSchoolStaff',
  'requireStudent',
  'requireClassMembership',
  'requireCanManageAssessment',
  'requireParent',
  'requireParentOfLegacyStudent',
  'requireOwnedAssignment',
  // lib/paperIntelligence/auth.ts — both call requireAuthentication (→ auth.getUser)
  // first, then requireClassTeacher on the assignment's / submission's class.
  'requireScriptAccess',
  'requireAssignmentClassTeacher',
  'requireLearnerAccess',
  'verifyTeacherTeachesStudent',
  'verifyStudent',
  'assertLearnerOwnership',
  'assertPermission',
  'checkFeatureAccess', // lib/payments/access.ts — supabase.auth.getUser() first, 'unauthenticated' on failure
]

const REGISTRY_KINDS = new Set(['public', 'delegated', 'reexport', 'shared-secret'])

// Route keys are paths under app/api without the trailing /route.ts,
// e.g. 'cron/cleanup-users'.
const isCronRoute = key => key.startsWith('cron/')
const isWebhookRoute = key => key.startsWith('webhooks/') || key === 'payments/callback'
const isDebugRoute = key => key.split('/').some(seg => /^(test|debug)(-|$)/.test(seg))

/** Blank out comments without moving line numbers, so commented-out guards don't count. */
export function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (m, p1) => p1 + ''.padEnd(m.length - p1.length, ' '))
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export function callsAny(code, names) {
  return names.some(n => new RegExp(`(^|[^A-Za-z0-9_$])${escapeRe(n)}\\s*\\(`).test(code))
}

export function hasDirectGuard(code) {
  return callsAny(code, DIRECT_GUARD_CALLS)
}

/** `export { GET, POST } from '@/app/api/x/route'` → 'x', else null. */
export function reexportTarget(code) {
  const m = code.match(/export\s*\{[^}]*\}\s*from\s*['"]@\/app\/api\/([^'"]+)\/route['"]/)
  return m ? m[1] : null
}

/**
 * @param {{ routes: Array<{ key: string, source: string }>, registry: Record<string, object> }} input
 * @returns {{ violations: Array<{ rule: string, route: string, message: string }>, warnings: Array<{ rule: string, route: string, message: string }> }}
 */
export function checkRouteAuth({ routes, registry }) {
  const violations = []
  const warnings = []
  const fail = (rule, route, message) => violations.push({ rule, route, message })
  const warn = (rule, route, message) => warnings.push({ rule, route, message })

  const codeByKey = new Map(routes.map(r => [r.key, stripComments(r.source)]))

  for (const [key, code] of codeByKey) {
    const entry = registry[key]
    const direct = hasDirectGuard(code)

    // ── Rule: no test/debug routes in production ──────────────────────────────
    if (isDebugRoute(key)) fail('debug-route', key, 'test/debug route under app/api — not allowed in production (CLAUDE.md)')

    // ── Rule: cron routes authenticate with CRON_SECRET only ──────────────────
    if (isCronRoute(key)) {
      if (!/CRON_SECRET/.test(code) || !/timingSafeEqual/.test(code)) {
        fail('cron-auth', key, 'cron route must compare CRON_SECRET with timingSafeEqual/timingSafeEqualString')
      }
      if (/x-vercel-cron/i.test(code)) {
        fail('cron-auth', key, "cron route reads the client-settable 'x-vercel-cron' header — authenticate with CRON_SECRET only")
      }
      continue
    }

    // ── Rule: webhooks verify a provider signature ────────────────────────────
    if (isWebhookRoute(key)) {
      if (!/createHmac/.test(code) || !/timingSafeEqual/.test(code)) {
        fail('webhook-signature', key, 'webhook must verify the provider signature (createHmac + timingSafeEqual) before processing')
      }
      continue
    }

    // ── Rule: every other route is guarded or explicitly registered ───────────
    if (!entry) {
      if (!direct) {
        fail('unguarded-route', key,
          'no recognised auth guard. Call one (scripts/security/route-auth-rules.mjs DIRECT_GUARD_CALLS) or, ' +
          'if it is genuinely public or delegates auth into lib/, register it in scripts/security/route-auth-registry.json with a reason')
      }
      continue
    }

    if (!REGISTRY_KINDS.has(entry.kind)) {
      fail('registry-invalid', key, `unknown kind '${entry.kind}' (expected public | delegated | reexport | shared-secret)`)
      continue
    }
    if (!entry.reason || !entry.reviewed) {
      fail('registry-invalid', key, "registry entry needs a 'reason' and a 'reviewed' date")
    }

    if (entry.kind === 'delegated') {
      if (!entry.guard) {
        fail('registry-invalid', key, "delegated entry must name the lib/ function that authenticates ('guard')")
      } else if (!callsAny(code, [entry.guard])) {
        fail('delegate-missing', key, `registered as delegating auth to ${entry.guard}(), but no longer calls it`)
      }
    }

    if (entry.kind === 'shared-secret') {
      if (!entry.secret) {
        fail('registry-invalid', key, "shared-secret entry must name the secret it compares ('secret')")
      } else if (!code.includes(entry.secret) || !/timingSafeEqual/.test(code)) {
        fail('shared-secret-missing', key, `registered as checking ${entry.secret} with timingSafeEqual, but no longer does`)
      }
    }

    if (entry.kind === 'reexport') {
      const target = reexportTarget(code)
      if (!target || target !== entry.target) {
        fail('reexport-broken', key, `registered as re-exporting '${entry.target}', but the file does not`)
      } else if (!codeByKey.has(target)) {
        fail('reexport-broken', key, `re-export target '${target}' does not exist`)
      }
      // The target is checked on its own iteration.
    }

    if (direct && entry.kind !== 'reexport') {
      warn('redundant-registry', key, 'now calls a recognised guard directly — the registry entry can be removed')
    }
  }

  // ── Rule: registry entries must point at real routes ────────────────────────
  for (const key of Object.keys(registry)) {
    if (!codeByKey.has(key)) fail('stale-registry', key, 'registry entry for a route that no longer exists — remove it')
  }

  return { violations, warnings }
}
