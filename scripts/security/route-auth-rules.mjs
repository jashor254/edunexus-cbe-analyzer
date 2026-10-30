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

// Calls that establish the caller's RELATIONSHIP to a specific learner
// (security audit 2026-10-30, F-11). Authentication alone is not enough for a
// route that takes a learner id and reads/writes with the service-role client
// — the F-05 defect (any teacher could message any learner's parent) passed
// the authentication gate cleanly. Each entry was read and verified to deny
// unless the caller teaches / parents / is / administers that learner.
// LIMIT, stated plainly: the school-tenant guards (requireSchool*) prove the
// caller belongs to a school, not that the learner does — those routes still
// rely on their own school_id-scoped queries, which this gate cannot see.
export const OWNERSHIP_GUARD_CALLS = [
  'requireStudent',
  'requireParent',
  'requireParentOfLegacyStudent',
  'requireLearnerAccess',
  'requireClassTeacher',
  'requireClassMembership',
  'requireScriptAccess',
  'requireCanManageAssessment',
  'requireOwnedAssignment',
  'assertLearnerOwnership',
  'verifyTeacherTeachesStudent',
  'requireSchoolStaff',
  'requireSchoolAdmin',
  'requireSchoolMembership',
  'resolveTeacherOwnership',      // lib/compass/ownership.ts — direct link or class roster
  'resolveParentOwnership',
  'resolveLearnerOwnership',
  'resolveCompassStudentAccess',  // teacher ∪ parent ∪ learner, each verified
  'resolveCompassMutationAccess', // teacher ∪ learner
  'canAccessLegacyStudent',       // lib/core/permissions.ts — caller's owned legacy ids
  'isTeacherOfLearner',           // lib/api/middleware.ts — class membership
  'resolveFamilyStudentIds',      // lib/core/identity.ts — the caller's own family only
  'resolveInstitutionalAssignmentReadAccess',
  'createTeacherAlert',           // lib/alerts/teacherAlerts.ts — resolveTeacherOwnership first
]

// A route "takes a learner id" if any of these names appear in it.
const LEARNER_ID = /\b(studentId|learnerId|student_id|learner_id|childId)\b/
/** The RLS-bypassing client factory (utils/supabase/service.ts). Exported so tests build fixtures from the rule's own config. */
export const SERVICE_CLIENT_FACTORY = 'createServiceClient'
const SERVICE_CLIENT = new RegExp(`\\b${SERVICE_CLIENT_FACTORY}\\s*\\(`)

// Any of these in a route means a shared-secret gate — which must be
// registered and reviewed as one, never silently reintroduced (F-08).
const SHARED_SECRET_SIGNALS = [/process\.env\.ADMIN_SECRET\b/, /\badminSecret\b/, /x-admin-secret/i]

const REGISTRY_KINDS = new Set(['public', 'delegated', 'reexport', 'shared-secret'])

// ── Per-handler analysis ──────────────────────────────────────────────────────
// A file-level "some guard appears somewhere" check let a guarded POST hide an
// unguarded GET in the same file (GET /api/feedback was an ADMIN_SECRET gate
// the gate never registered for exactly this reason).

// Start of every top-level declaration — a handler or helper body ends at the next one.
const TOP_LEVEL_DECL = /^(?:export\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*[(<]|^(?:export\s+)?(?:const|let)\s+[A-Za-z_$][\w$]*\s*[=:]/gm

function topLevelDeclarationStarts(code) {
  return [...code.matchAll(TOP_LEVEL_DECL)].map(m => m.index)
}

function bodyFrom(code, start, starts) {
  const end = starts.find(s => s > start) ?? code.length
  return code.slice(start, end)
}

/** Exported HTTP handlers, each with only its own top-level body. */
export function splitHandlers(code) {
  const starts = topLevelDeclarationStarts(code)
  const handlers = []
  for (const m of code.matchAll(/^export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gm)) {
    handlers.push({ method: m[1], body: bodyFrom(code, m.index, starts) })
  }
  return handlers
}

/**
 * Same-file functions: name → body. Includes the other handlers, so a GET
 * that delegates to the file's guarded POST (payments/verify's Paystack
 * redirect) is recognised; a handler "calling" its own declaration cannot
 * pass this way, since its own body has no guard.
 */
function localHelpers(code) {
  const starts = topLevelDeclarationStarts(code)
  const helpers = new Map()
  const decl = /^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*[(<]|^(?:export\s+)?(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function)/gm
  for (const m of code.matchAll(decl)) helpers.set(m[1] ?? m[2], bodyFrom(code, m.index, starts))
  return helpers
}

/** True if the handler calls one of `names` itself, or through a same-file helper that does (one level). */
export function handlerCallsAny(body, code, names) {
  if (callsAny(body, names)) return true
  for (const [name, helperBody] of localHelpers(code)) {
    if (callsAny(body, [name]) && callsAny(helperBody, names)) return true
  }
  return false
}

/** Every guard name a delegated registry entry vouches for. */
function entryGuards(entry) {
  return [entry?.guard, ...(Array.isArray(entry?.guards) ? entry.guards : [])].filter(Boolean)
}

/** Does this route take a learner id and use the service-role client without a recognised ownership check? */
export function needsOwnershipReview(code) {
  return LEARNER_ID.test(code) && SERVICE_CLIENT.test(code) && !callsAny(code, OWNERSHIP_GUARD_CALLS)
}

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
 * @param {{ routes: Array<{ key: string, source: string }>, registry: Record<string, object>, ownershipRegistry?: Record<string, object> }} input
 * @returns {{ violations: Array<{ rule: string, route: string, message: string }>, warnings: Array<{ rule: string, route: string, message: string }> }}
 */
export function checkRouteAuth({ routes, registry, ownershipRegistry = {} }) {
  const violations = []
  const warnings = []
  const fail = (rule, route, message) => violations.push({ rule, route, message })
  const warn = (rule, route, message) => warnings.push({ rule, route, message })

  const codeByKey = new Map(routes.map(r => [r.key, stripComments(r.source)]))

  for (const [key, code] of codeByKey) {
    const entry = registry[key]
    const direct = hasDirectGuard(code)

    // ── Rule: shared-secret gates are registered, never reintroduced silently ──
    if (!isCronRoute(key) && SHARED_SECRET_SIGNALS.some(p => p.test(code)) && entry?.kind !== 'shared-secret') {
      fail('unregistered-shared-secret', key,
        'reads an admin shared secret but is not registered as kind "shared-secret" — prefer the founder session (requireGrowthUser); if a secret is truly required, register and review it')
    }

    // ── Rule: learner-id routes using the service client prove the relationship ──
    if (!isCronRoute(key) && !isWebhookRoute(key)) {
      const own = ownershipRegistry[key]
      if (needsOwnershipReview(code)) {
        if (!own) {
          fail('learner-ownership-unreviewed', key,
            'takes a learner/student id and uses the service-role client, but calls no recognised ownership check ' +
            '(OWNERSHIP_GUARD_CALLS). Authentication is not authorization: call one, or record how this route ' +
            'authorizes in scripts/security/route-ownership-registry.json after review')
        } else if (!own.reason || !own.reviewed || !own.via) {
          fail('ownership-registry-invalid', key, "ownership entry needs 'via', 'reason' and 'reviewed'")
        } else if (own.via !== 'inline' && !callsAny(code, [own.via])) {
          fail('ownership-registry-stale', key, `registered as authorizing via ${own.via}(), but no longer calls it`)
        }
      } else if (own) {
        warn('redundant-ownership-registry', key, 'no longer needs an ownership entry (it calls a recognised ownership check, or takes no learner id) — remove it')
      }
    }

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
      } else {
        checkHandlers(key, code, DIRECT_GUARD_CALLS)
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
      const guards = entryGuards(entry)
      if (guards.length === 0) {
        fail('registry-invalid', key, "delegated entry must name the lib/ function(s) that authenticate ('guard' or 'guards')")
      } else {
        const missing = guards.filter(guard => !callsAny(code, [guard]))
        for (const guard of missing) fail('delegate-missing', key, `registered as delegating auth to ${guard}(), but no longer calls it`)
        // One defect, one finding: a missing delegate already explains why a handler is unguarded.
        if (missing.length === 0) checkHandlers(key, code, [...DIRECT_GUARD_CALLS, ...guards])
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

    // Redundant only if EVERY handler is guarded directly — a delegated entry
    // still covers any handler that authenticates through lib/.
    const allHandlersDirect = splitHandlers(code).every(h => handlerCallsAny(h.body, code, DIRECT_GUARD_CALLS))
    if (direct && entry.kind !== 'reexport' && (entry.kind !== 'delegated' || allHandlersDirect)) {
      warn('redundant-registry', key, 'now calls a recognised guard directly — the registry entry can be removed')
    }
  }

  // ── Rule: registry entries must point at real routes ────────────────────────
  for (const key of Object.keys(registry)) {
    if (!codeByKey.has(key)) fail('stale-registry', key, 'registry entry for a route that no longer exists — remove it')
  }
  for (const key of Object.keys(ownershipRegistry)) {
    if (!codeByKey.has(key)) fail('stale-registry', key, 'ownership registry entry for a route that no longer exists — remove it')
  }

  return { violations, warnings }

  // Every exported handler must authenticate on its own (directly, through a
  // same-file helper, or through a guard its delegated entry vouches for).
  function checkHandlers(key, code, names) {
    for (const { method, body } of splitHandlers(code)) {
      if (!handlerCallsAny(body, code, names)) {
        fail('unguarded-handler', key,
          `${method} handler has no recognised auth guard of its own — a guard elsewhere in the file does not protect it. ` +
          'Call one, or register the lib/ function it delegates to (delegated entry "guards")')
      }
    }
  }
}
