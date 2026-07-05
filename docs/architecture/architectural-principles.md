# Architectural Principles

These are the permanent engineering principles of EduNexus. They do not change with features. They define how we build everything.

A new engineer who internalises these principles can make correct architectural decisions without reviewing every convention individually.

---

## P1 — One Source of Truth Per Domain

Every concept in the system has exactly one authoritative location.

- Token prices live in `lib/payments/config.ts`. Nowhere else.
- Environment policy lives in `lib/environment/config.ts`. Nowhere else.
- Permission definitions live in `lib/iam/`. Nowhere else.
- Curriculum data lives in `lib/curriculum/`. Nowhere else.

If you find yourself defining the same concept in two places, that is a bug. Consolidate and reference the canonical location.

**Why:** Duplicate definitions diverge. When one is updated and the other is not, the system behaves inconsistently in ways that are hard to detect and debug.

---

## P2 — Business Logic Belongs in Shared Services

All business logic lives in `lib/`. Route handlers, components, and cron jobs are consumers of `lib/` — they do not contain logic themselves.

A route handler that does more than parse input, call a `lib/` function, and shape a response has too much logic. Extract the excess into `lib/`.

**Why:** Every feature must be callable from the web app, developer APIs, background jobs, SDKs, and future clients. If the logic is in a route handler, it can only be reached via HTTP.

---

## P3 — Infrastructure Handles Environments

Business service functions do not inspect `ctx.environment` or branch on `NODE_ENV`. They receive `ctx` and pass it to infrastructure helpers.

Infrastructure layers (quota guard, billing guard, analytics guard, logger) read `ctx.environmentConfig` and apply the appropriate policy.

**Why:** Business logic and operational policy are different concerns. Mixing them means every time you add a new environment or change a policy, you must audit all business code for conditionals. Keeping them separate means you change configuration, not code.

---

## P4 — APIs Are Contracts

Route handlers define a contract: a request shape and a response shape. Once shipped, that contract cannot be silently broken.

- Add new optional fields instead of changing existing ones.
- Increment the version when breaking changes are unavoidable.
- Document the contract in code (Zod schemas serve as executable documentation).

**Why:** External developers and internal clients build against the API. Silent changes break integrations. Treating APIs as contracts forces deliberate versioning decisions instead of accidental breakage.

---

## P5 — Configuration Over Conditionals

Behaviour is driven by the `EnvironmentConfig` object, not by `if (env === 'production')` checks.

When a new behaviour needs to be toggleable (feature flag, billing toggle, log verbosity), it is added to the `EnvironmentConfig` type and set per environment. Code reads the config; it does not guess the environment.

**Why:** Named conditionals are fragile. They accumulate across a codebase and make it impossible to add a new environment (staging, local, enterprise) without auditing every conditional. Configuration objects are explicit and exhaustive.

---

## P6 — Strong Typing Everywhere

TypeScript `strict` mode is enabled. `any` is never used. All `lib/` functions have explicit return types.

- Request bodies are typed with Zod schemas.
- Database results are typed with explicit column selections.
- `RequestContext` is the typed carrier for runtime policy.
- AI responses are validated with Zod after parsing.

**Why:** The compiler is the cheapest form of testing. A typed function signature makes the contract visible. An `any` type is a hole in the type system that allows runtime errors that could have been caught at compile time.

---

## P7 — Idempotency Is Mandatory

Every state-mutating background operation carries an idempotency key.

- Event publishes: `idempotency_key` column with a unique constraint.
- Job enqueues: `idempotency_key` column with a unique constraint.
- Payment webhooks: check for existing transaction before processing.
- Token deductions: verify the triggering operation completed before deducting.

**Why:** Serverless functions can be invoked multiple times for the same logical event (retries, timeouts, Vercel cron overlap). Without idempotency, retries cause duplicate emails, double billing, and data corruption.

---

## P8 — No Duplicated Business Logic

If two features share a business rule, that rule is extracted into a shared `lib/` function that both features call. Copy-pasting business logic between features is not acceptable.

**Why:** Copied logic diverges. When the rule changes (and it will), only one copy is updated. The other becomes a latent bug.

---

## P9 — Every Feature Is Multi-Client From Day One

When implementing a new feature, the `lib/` function is the feature. The route handler is just one way to reach it.

Design every feature assuming it will be called from:
- The web app (Server Components and route handlers)
- The developer API (external API keys)
- A background job (cron-triggered)
- A future SDK (TypeScript/Python/Go)
- A future CLI

A function with HTTP dependencies (`req`, `res`, `cookies`) cannot serve all these clients. Pure functions that receive typed inputs and return typed outputs can.

**Why:** EduNexus is a platform, not just a web app. The developer platform, SDKs, and third-party integrations are strategic surfaces. Features that are web-only from the start require expensive refactoring to expose through other surfaces later.

---

## P10 — Backward Compatibility Where Possible

API contracts, database schemas, and event formats should not be broken without a migration path.

- New columns are additive (nullable or with defaults).
- New API fields are optional.
- Old event versions are dispatched alongside new ones during transition periods.
- Breaking changes get a version increment and a deprecation period.

**Why:** External developers build automations, integrations, and businesses on top of EduNexus APIs. Silent breaking changes destroy trust. Deliberate versioning allows consumers to migrate on their schedule.

---

## P11 — Fail Fast, Fail Loudly

The application validates critical dependencies at startup, not at first use.

- Environment variables are validated by `lib/config/env.ts` — missing required variables crash the application at startup.
- Database connectivity is verified by the health endpoint.
- AI provider availability is tracked by the circuit breaker registry.

Errors in `lib/` throw descriptive exceptions. Route handlers catch them and return structured error responses. Errors are never swallowed silently.

**Why:** Silent failures are the hardest bugs to find. A crashed startup is visible immediately. A silent error at 3 AM produces corrupted data that is discovered days later.

---

## P12 — Audit Everything Sensitive

Any operation that changes who can access what, or how money moves, writes to `audit_logs`.

- Member invitation, acceptance, removal
- Role assignment changes
- API key issuance and revocation
- Billing plan changes
- Organization settings changes

Audit logs are immutable and permanent. They are the forensic record of the platform.

**Why:** When something goes wrong (a school reports unexpected charges, a teacher loses access they should have), the audit log is the tool that answers "what happened?" Without it, the answer is guesswork.

---

## P13 — Dead Letters, Not Silent Drops

Failed background work escalates to the dead-letter queue. Failed event deliveries escalate to `dead` status. Nothing is silently discarded.

The dead-letter queue is monitored. Dead-letter jobs are reviewed, root-caused, and either fixed or manually resolved. The `/api/cron/dlq-requeue` cron provides a path for reprocessing after the root cause is fixed.

**Why:** Data loss in an education platform has real consequences — a teacher's lesson plan generation that silently failed means they are unprepared for class. Silent drops optimise for system cleanliness at the cost of correctness.

---

## P14 — Prefer Composition Over Inheritance

Platform capabilities are composed from small, single-purpose functions. Inheritance hierarchies are rarely the right tool.

- A complex operation is a sequence of simple function calls.
- Shared behaviour is extracted into a function, not a base class.
- The `RequestContext` object is composed from validated inputs, not derived from a class hierarchy.

**Why:** Composition is transparent — you can read a function and understand exactly what it does by reading its call sites. Deep inheritance hierarchies obscure behaviour and make refactoring expensive.

---

## P15 — Performance Is a Feature, Not an Afterthought

- No queries inside loops — always batch with `.in()` or joins.
- Always `select()` only the columns you need.
- Slow operations are instrumented with metrics and warn-logged above threshold.
- Database indexes exist on every foreign key and frequently-queried column.

Performance regressions are bugs. If a new feature introduces N+1 queries, it is not complete until the queries are batched.

**Why:** EduNexus serves teachers in Kenyan classrooms, many on mobile data connections. A slow response is not an inconvenience — it is a failed lesson.

---

## Applying the Principles

When reviewing a pull request or designing a feature, ask:

1. Is there a single source of truth for every new concept? (P1)
2. Is business logic in `lib/`, not in routes or components? (P2)
3. Does it work the same way in all environments without branching on `env`? (P3)
4. Is the API contract explicit and versioned? (P4)
5. Is behaviour driven by config, not by conditional names? (P5)
6. Is every type explicit? No `any`? (P6)
7. Is every background operation idempotent? (P7)
8. Is any logic duplicated from elsewhere? (P8)
9. Could a future SDK call the same function? (P9)
10. Will existing clients break? (P10)
11. Do failures surface immediately? (P11)
12. Are sensitive operations audited? (P12)
13. Can failed work be recovered? (P13)
14. Is composition preferred over inheritance? (P14)
15. Are database queries efficient? (P15)

A feature that satisfies all 15 is ready to ship.
