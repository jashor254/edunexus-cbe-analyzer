# EduNexus Platform Implementation Guide

## The Engineering Manual for Production Code

**Edition 1.0 — June 2026**
**Audience: Every engineer writing code that runs in production**

---

> *Architecture tells you what to build. This guide tells you how to build it correctly.*

---

## Prerequisites

This guide assumes you have read:
- **EduNexus Engineering Handbook** — the why behind our technical choices
- **EduNexus Canonical Architecture** — the what: platform domains, service boundaries, data flows

This guide covers the how: the implementation decisions, conventions, patterns, and disciplines that make production code at EduNexus correct, maintainable, observable, and worthy of the learners it serves.

Read it once before your first PR. Return to the relevant section every time you implement something new. Treat deviations from it as decisions that require team discussion, not personal preference.

---

---

# Part I — Repository Structure & Monorepo Organization

---

## Philosophy

A monorepo is a bet that shared context is worth the coordination overhead. At EduNexus, we make that bet because our platform is a single coherent intelligence system, not a collection of independent microservices. Code that serves learners, teachers, and parents must share curriculum logic, learner models, AI prompt modules, and event schemas. Duplicating these across repos creates drift, and drift in educational software produces incorrect results for real learners.

The monorepo is not a dumping ground. It is a disciplined structure where every directory has a clear owner, every package has a clear contract, and every import follows rules that prevent circular dependencies and maintain clean boundaries.

## Objectives

- Every engineer knows where to find any piece of code without asking
- Import paths communicate ownership and dependency direction
- Shared logic lives in one place — no duplication of curriculum, AI, or domain logic
- New packages and apps can be added without architectural discussion
- CI knows which packages changed and runs only the relevant tests

## Top-Level Directory Structure

```
edunexus/
├── apps/                    → Deployable applications
│   ├── web/                 → Main Next.js app (teachers, students, parents)
│   ├── admin/               → Internal admin panel
│   ├── developer-portal/    → developers.edunexus.co.ke
│   └── worker/              → Background job processor (long-running process)
│
├── packages/                → Shared packages (published or consumed internally)
│   ├── ui/                  → Shared React component library
│   ├── types/               → All shared TypeScript types and interfaces
│   ├── config/              → Shared configuration (TOKEN_COSTS, limits, etc.)
│   └── test-utils/          → Shared test factories and helpers
│
├── services/                → Domain service libraries (backend only)
│   ├── curriculum/          → KICD curriculum data access and logic
│   ├── learner/             → Learner profiles and progression
│   ├── assessment/          → Assessment creation and scoring
│   ├── ai/                  → All AI orchestration (prompts, calls, streaming)
│   ├── payments/            → Paystack integration and token logic
│   ├── events/              → Event publishing and subscription
│   ├── notifications/       → WhatsApp, SMS, email dispatch
│   └── reporting/           → Report generation and export
│
├── workers/                 → Background job definitions
│   ├── sync/                → Data synchronization workers
│   ├── report/              → Scheduled report generation
│   ├── nudge/               → Notification nudge workers
│   └── analytics/           → Aggregation and analytics workers
│
├── scripts/                 → One-off and operational scripts
│   ├── seed/                → Database seeding scripts
│   ├── migrate/             → Data migration scripts (beyond SQL migrations)
│   └── ops/                 → Operational scripts (re-index, backfill, etc.)
│
├── supabase/                → All database concerns
│   ├── migrations/          → SQL migration files (numbered, sequential)
│   ├── functions/           → Supabase Edge Functions (Deno)
│   ├── seed.sql             → Base seed data for local development
│   └── types.ts             → Auto-generated TypeScript types from schema
│
├── docs/                    → Living documentation
│   ├── decisions/           → Architecture Decision Records (ADRs)
│   ├── runbooks/            → Operational runbooks
│   └── *.md                 → Platform documents (this file lives here)
│
├── .github/                 → CI/CD workflows and PR templates
├── .eslintrc.js             → ESLint configuration (root, applies everywhere)
├── .prettierrc              → Prettier configuration
├── tsconfig.base.json       → Base TypeScript configuration
├── turbo.json               → Turborepo pipeline configuration
└── package.json             → Root workspace configuration
```

## Ownership Boundaries

Every directory at the second level (e.g., `services/curriculum`, `apps/web`, `packages/ui`) has a single **owning team or individual**. Ownership is declared in `CODEOWNERS`:

```
# .github/CODEOWNERS

# Services — domain owners
/services/curriculum/        @edunexus/curriculum-team
/services/ai/                @edunexus/ai-team
/services/payments/          @edunexus/payments-team
/services/learner/           @edunexus/platform-team
/services/assessment/        @edunexus/platform-team

# Apps
/apps/web/                   @edunexus/product-team
/apps/admin/                 @edunexus/platform-team
/apps/developer-portal/      @edunexus/devrel-team

# Shared packages — everyone touches, platform team owns
/packages/                   @edunexus/platform-team
/supabase/migrations/        @edunexus/platform-team
```

**Ownership rules:**
- Adding code to a service you do not own requires approval from the owner
- Changing a shared package's public API requires approval from the platform team
- Changes to `supabase/migrations/` require platform team approval, always

## Shared Modules and Their Contracts

### `packages/types`
The single source of truth for all TypeScript types shared across the codebase.

```
packages/types/
├── src/
│   ├── curriculum.ts     → Grade, Subject, Strand, SubStrand, LearningOutcome, PerformanceIndicator
│   ├── learner.ts        → Learner, LearnerProfile, CompetencyLevel, ProgressRecord
│   ├── assessment.ts     → Assessment, Question, Rubric, AssessmentResult
│   ├── ai.ts             → AIRequest, AIResponse, PromptContext, TokenUsage
│   ├── events.ts         → All event payload types
│   ├── payments.ts       → PaymentIntent, TokenBalance, Transaction
│   └── index.ts          → Re-exports everything
└── package.json
```

**Contract:** Types in this package have no runtime code. No functions, no classes, no business logic. Pure type definitions only. This makes them safe to import anywhere, including client components.

### `packages/config`
All configurable constants that need to be consistent across services.

```
packages/config/
├── src/
│   ├── tokens.ts         → TOKEN_COSTS (the only place this lives)
│   ├── limits.ts         → Rate limits, max file sizes, pagination defaults
│   ├── curriculum.ts     → Supported curriculum systems, grade mappings
│   └── index.ts
└── package.json
```

**Contract:** Only primitive values and plain objects. No async code, no database access, no imports from other packages.

### `packages/ui`
Shared React components used across all frontend apps.

```
packages/ui/
├── src/
│   ├── components/
│   │   ├── Button/
│   │   ├── Table/
│   │   ├── Form/
│   │   ├── Card/
│   │   ├── Badge/
│   │   └── ...
│   ├── hooks/            → Shared React hooks (useDebounce, usePagination, etc.)
│   └── index.ts
└── package.json
```

**Contract:** Zero business logic. Components receive all data via props. No API calls inside components. No Supabase imports. UI only.

## Dependency Rules

Dependencies between layers flow in one direction only:

```
apps/  →  services/  →  packages/
                     →  supabase/types

services/  →  packages/
           →  supabase/types

packages/  → (no internal dependencies between packages except packages/ui → packages/types)

workers/  →  services/
          →  packages/
```

**Violations that are never acceptable:**
- `services/` importing from `apps/`
- `packages/` importing from `services/`
- Circular imports between services (e.g., `services/learner` importing from `services/assessment` AND `services/assessment` importing from `services/learner`)
- Any package importing directly from `@supabase/supabase-js` — always go through `utils/supabase/`

These rules are enforced by ESLint import rules. Violations fail CI.

## Import Conventions

**Absolute imports only.** No relative imports that traverse more than one directory level:

```typescript
// ✅ Correct — absolute import via workspace alias
import { Learner } from '@edunexus/types';
import { TOKEN_COSTS } from '@edunexus/config';
import { getLearnerById } from '@edunexus/services/learner';

// ✅ Correct — relative import within the same module
import { formatGrade } from './formatters';
import type { LearnerCardProps } from './LearnerCard.types';

// ❌ Wrong — traverses multiple levels
import { Learner } from '../../../../../../packages/types/src/learner';

// ❌ Wrong — imports from another service's internals
import { buildPromptContext } from '../../services/ai/src/context/builder';
```

**Import ordering (enforced by ESLint):**
1. Node built-ins (`node:path`, `node:crypto`)
2. External packages (`react`, `next`, `zod`)
3. Internal workspace packages (`@edunexus/types`, `@edunexus/config`)
4. Internal services (`@edunexus/services/curriculum`)
5. Local imports (`./`, `../`)

**Type-only imports are explicit:**
```typescript
import type { Learner } from '@edunexus/types';
import { getLearnerById } from '@edunexus/services/learner';
```

---

---

# Part II — Coding Standards

---

## Philosophy

Coding standards are not stylistic preferences. They are shared conventions that reduce cognitive load, prevent a category of bugs, and make code reviewable by any team member. At EduNexus, we serve learners — the cost of a bug is not a bad user experience metric, it is a child receiving incorrect educational guidance. Standards matter.

We follow one rule above all others: **write code for the engineer who inherits it two years from now.** That engineer does not know why you wrote what you wrote. That engineer is in a hurry. Make their life easy.

## TypeScript Conventions

### Strict Mode Is Non-Negotiable

Every `tsconfig.json` in the monorepo extends `tsconfig.base.json` which sets:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

`strict: true` enables `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `noImplicitAny`, and `noImplicitThis`. Each of these prevents a real class of runtime bugs.

`noUncheckedIndexedAccess` means `array[0]` returns `T | undefined`, not `T`. This is uncomfortable at first and prevents a massive class of off-by-one and empty-array bugs in curriculum traversal code.

### No `any` — Ever

`any` defeats the entire purpose of TypeScript. If you cannot type something, use `unknown` and narrow it. If a third-party library returns `any`, add a type assertion at the boundary and document why.

```typescript
// ❌ Never
function processResult(result: any): void { ... }

// ✅ Use unknown at external boundaries
function processWebhookPayload(payload: unknown): WebhookEvent {
  const parsed = webhookEventSchema.parse(payload); // Zod narrows unknown → WebhookEvent
  return parsed;
}
```

### `type` vs `interface`

Use `type` for everything. Use `interface` only when you need declaration merging (which is rare, and usually a sign of a different problem).

```typescript
// ✅ Use type
type Learner = {
  id: string;
  name: string;
  grade: number;
  schoolId: string;
};

type LearnerWithProgress = Learner & {
  progress: ProgressRecord[];
};

// ❌ Avoid interface unless you specifically need merging
interface Learner {
  id: string;
  ...
}
```

**Rationale:** `type` is more consistent, supports union and intersection natively, and prevents accidental declaration merging. The `type` vs `interface` debate is decided — we use `type`.

### Discriminated Unions for State

Model state machines as discriminated unions, not as objects with optional fields:

```typescript
// ❌ Ambiguous state — what does it mean when status is 'error' but result is defined?
type AIGenerationState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  result?: LessonPlan;
  error?: string;
};

// ✅ Discriminated union — each state is clear and complete
type AIGenerationState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; result: LessonPlan }
  | { status: 'error'; error: string };
```

### Zod for Runtime Validation

TypeScript types are erased at runtime. Every external boundary (API request bodies, webhook payloads, environment variables, third-party API responses) must be validated at runtime using Zod:

```typescript
import { z } from 'zod';

const generateLessonPlanSchema = z.object({
  subject: z.string().min(1).max(100),
  grade: z.number().int().min(7).max(12),
  strandId: z.string().uuid(),
  duration: z.enum(['30', '40', '60']),
  learnerCount: z.number().int().min(1).max(100).optional(),
});

type GenerateLessonPlanInput = z.infer<typeof generateLessonPlanSchema>;
```

**Rule:** The Zod schema IS the type definition for API inputs. Derive the TypeScript type from the schema with `z.infer<>`. Do not define both separately — they will drift.

## Naming Standards

| Thing | Convention | Examples |
|-------|------------|---------|
| Files | kebab-case | `lesson-plan-generator.ts`, `learner-card.tsx` |
| Directories | kebab-case | `lesson-plan/`, `token-balance/` |
| React components | PascalCase | `LearnerCard`, `StrandSelector` |
| Functions | camelCase | `generateLessonPlan`, `getLearnerById` |
| Variables | camelCase | `lessonPlan`, `currentGrade` |
| Constants | UPPER_SNAKE_CASE | `TOKEN_COSTS`, `MAX_RETRIES` |
| Types / type aliases | PascalCase | `LessonPlan`, `AIGenerationState` |
| Zod schemas | camelCase + Schema suffix | `lessonPlanSchema`, `learnerProfileSchema` |
| Database columns | snake_case | `teacher_id`, `strand_id`, `created_at` |
| API routes | kebab-case | `/api/lesson-plans/generate` |
| Environment variables | UPPER_SNAKE_CASE | `DEEPSEEK_API_KEY`, `SUPABASE_URL` |
| Event types | dot-separated snake | `learner.progress_updated`, `assessment.submitted` |

### Naming Anti-Patterns to Avoid

```typescript
// ❌ Generic names that convey nothing
const data = await getData();
const result = processResult(result);
const temp = calculate();

// ✅ Names that tell you exactly what is happening
const learnerProgress = await getLearnerProgress(learnerId);
const lessonPlan = await generateLessonPlan(context);
const tokenCost = calculateTokenCost(promptLength, responseLength);

// ❌ Boolean names that could be either way
const active = true;
const flag = false;

// ✅ Boolean names that read like assertions
const isEnrolled = true;
const hasCompletedOnboarding = false;
const shouldDisplayReport = term !== null;
```

## Classes vs Functions

**Prefer functions.** In the service layer, functions are the default unit of behavior. Classes are appropriate for:
- Stateful objects with a well-defined lifecycle (AI streaming clients)
- Objects that need to implement an interface for polymorphism (AI model providers)
- SDK-style clients that bundle configuration with methods

```typescript
// ✅ Functions for stateless operations
export async function getLearnerById(
  supabase: SupabaseClient,
  learnerId: string
): Promise<Learner> {
  const { data, error } = await supabase
    .from('learners')
    .select('id, name, grade, school_id, created_at')
    .eq('id', learnerId)
    .single();

  if (error) throw new Error(`Failed to fetch learner: ${error.message}`);
  if (!data) throw new Error(`Learner not found: ${learnerId}`);
  return data;
}

// ✅ Class for a stateful provider with lifecycle
class AIModelProvider {
  private client: DeepSeekClient;
  private readonly model: string;

  constructor(config: AIModelConfig) {
    this.client = new DeepSeekClient({ apiKey: config.apiKey });
    this.model = config.model;
  }

  async generate(prompt: string): Promise<string> { ... }
  async stream(prompt: string): AsyncGenerator<string> { ... }
  async close(): Promise<void> { this.client.close(); }
}
```

## Error Handling

### The Rule: Be Explicit at Every Layer

Every layer handles errors differently. Knowing the layer tells you how to handle errors.

**Service layer:** Throw descriptive `Error` objects. Never swallow. Never return `null` on failure.

```typescript
// ✅ Service layer — throw with context
export async function deductTokens(
  supabase: SupabaseClient,
  teacherId: string,
  cost: number
): Promise<void> {
  const balance = await getTokenBalance(supabase, teacherId);
  if (balance < cost) {
    throw new InsufficientTokensError(
      `Teacher ${teacherId} has ${balance} tokens but operation costs ${cost}`
    );
  }
  // ...
}
```

**API route layer:** Catch service errors and return structured HTTP responses. Never let unhandled errors reach the framework's default error handler (which produces unhelpful responses).

```typescript
// ✅ API route — catch and translate
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const input = generateLessonPlanSchema.parse(body); // throws ZodError if invalid
    const result = await generateLessonPlan(supabase, input);
    return Response.json({ data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json({ error: 'Invalid input', details: error.errors }, { status: 400 });
    }
    if (error instanceof InsufficientTokensError) {
      return Response.json({ error: 'Insufficient tokens' }, { status: 402 });
    }
    if (error instanceof UnauthorizedError) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // Unexpected errors
    logger.error('Unhandled error in lesson plan generation', { error });
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

**Client component layer:** Catch errors from API calls and render user-friendly states. Never show raw error messages to users.

### Custom Error Classes

Domain errors that need special handling in API routes are typed:

```typescript
// services/errors.ts
export class InsufficientTokensError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientTokensError';
  }
}

export class LearnerNotFoundError extends Error {
  readonly learnerId: string;
  constructor(learnerId: string) {
    super(`Learner not found: ${learnerId}`);
    this.name = 'LearnerNotFoundError';
    this.learnerId = learnerId;
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
```

## Async Patterns

### Never `await` in a loop

```typescript
// ❌ Fires N sequential DB calls
const learners = await Promise.all(learnerIds.map(id => getLearnerById(id)));
// This is still wrong — fires N parallel calls, which is fine for small N
// but for large N it will exhaust the DB connection pool

// ✅ Batch fetch with .in()
const { data: learners } = await supabase
  .from('learners')
  .select('id, name, grade')
  .in('id', learnerIds);
```

### Prefer `Promise.all` for independent parallel work

```typescript
// ✅ Both fetches run in parallel
const [learner, school] = await Promise.all([
  getLearnerById(supabase, learnerId),
  getSchoolById(supabase, schoolId),
]);
```

### `Promise.allSettled` when partial failure is acceptable

```typescript
// When we want all results even if some fail
const results = await Promise.allSettled(
  learnerIds.map(id => getLearnerProgress(supabase, id))
);

const successful = results
  .filter((r): r is PromiseFulfilledResult<ProgressRecord> => r.status === 'fulfilled')
  .map(r => r.value);
```

## Logging

All logging goes through a structured logger. Never `console.log` in production code.

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
});
```

**Log levels and when to use them:**

| Level | When |
|-------|------|
| `trace` | Extremely detailed — function entry/exit, loop iterations |
| `debug` | Useful for debugging, too noisy for production |
| `info` | Normal significant events: request completed, job finished, user action |
| `warn` | Unexpected but handled: fallback used, retry occurred, rate limit approaching |
| `error` | Something failed that should not have: unhandled exception, DB error, AI failure |
| `fatal` | The process cannot continue |

**Always include context:**

```typescript
// ❌ No context — useless in a distributed system
logger.info('Lesson plan generated');

// ✅ Structured context — searchable and correlatable
logger.info({ teacherId, subject, grade, tokenCost, durationMs: Date.now() - start }, 'Lesson plan generated');

// ❌ String interpolation — not structured
logger.error(`Failed to generate lesson plan for teacher ${teacherId}: ${error.message}`);

// ✅ Structured error logging
logger.error({ teacherId, error: error.message, stack: error.stack }, 'Lesson plan generation failed');
```

**What to always include:**
- `teacherId`, `learnerId`, `schoolId` — whoever this request is for
- `requestId` — trace across the request lifecycle (injected via middleware)
- `durationMs` — how long did it take
- For AI calls: `model`, `promptTokens`, `completionTokens`, `cost`

## Comments

**Default: write no comments.** Code that needs a comment to be understood is usually code that needs to be rewritten.

**Write a comment only when the WHY is non-obvious:**

```typescript
// ✅ Comments that earn their place

// DeepSeek returns token counts in the completion object, but only after
// the stream completes. We buffer the full response so we can log accurate
// token costs after the last chunk arrives.
let fullResponse = '';
for await (const chunk of stream) {
  fullResponse += chunk.choices[0]?.delta?.content ?? '';
  yield chunk;
}
logger.info({ tokens: stream.usage }, 'AI generation complete');

// CBC Sub-strand IDs use a composite key format: {subject}_{grade}_{strand}_{index}
// This is legacy from the KICD import script and must not be changed as existing
// learner progress records reference these IDs.
const subStrandId = `${subjectCode}_g${grade}_${strandIndex}_${subStrandIndex}`;

// We intentionally do not throw here. If the nudge fails, the learner's
// progress is still recorded. Nudge failures should never block the primary flow.
try {
  await sendProgressNudge(learnerId);
} catch (nudgeError) {
  logger.warn({ learnerId, error: nudgeError }, 'Progress nudge failed, continuing');
}
```

**Comment anti-patterns:**

```typescript
// ❌ States what the code obviously does
// Get the learner by ID
const learner = await getLearnerById(id);

// ❌ References the current task (rots immediately)
// Fix for bug #234 — learner progress was not being saved
// Added for the parent dashboard feature
// Called by the lesson plan API

// ❌ Lies (old comment not updated when code changed)
// Returns the learner's grade level
function getLearnerYear(learner: Learner): string { ... } // actually returns a string now
```

---

---

# Part III — Backend Implementation Patterns

---

## Philosophy

The backend is where educational correctness lives. An incorrect UI shows the wrong color. An incorrect backend service shows the wrong competency level to a teacher, who then makes incorrect decisions about a child's education. Every backend function must be correct, not merely working.

Correct means: tested, typed, validated, idempotent where it must be, transactional where it must be, and observable always.

## Service Layer

Every domain operation is a function in a service module. Service functions have the following properties:

1. **Explicit Supabase client parameter.** The function does not instantiate its own client. It receives one. This makes testing trivial and makes the service composable.

2. **Explicit return type.** TypeScript will infer return types, but explicit annotations serve as documentation and catch accidental type widening.

3. **Single responsibility.** A service function does one thing. If it does two things, it is two functions.

4. **No HTTP concerns.** Service functions do not know about request bodies, response codes, or headers. Those are the API route's concern.

```typescript
// services/learner/get-learner-progress.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import type { LearnerProgress } from '@edunexus/types';
import { LearnerNotFoundError } from '../errors';

export async function getLearnerProgress(
  supabase: SupabaseClient,
  learnerId: string,
  termId: string
): Promise<LearnerProgress> {
  const { data, error } = await supabase
    .from('learner_progress')
    .select(`
      id,
      learner_id,
      term_id,
      strand_id,
      sub_strand_id,
      competency_level,
      evidence_count,
      last_assessed_at,
      strands ( name, subject_id ),
      sub_strands ( name )
    `)
    .eq('learner_id', learnerId)
    .eq('term_id', termId);

  if (error) throw new Error(`Failed to fetch learner progress: ${error.message}`);
  if (!data || data.length === 0) throw new LearnerNotFoundError(learnerId);

  return mapToLearnerProgress(data);
}

function mapToLearnerProgress(rows: ProgressRow[]): LearnerProgress {
  // Transform DB rows to domain type — explicit mapping, no spreading of unknown shapes
  return {
    learnerId: rows[0].learner_id,
    termId: rows[0].term_id,
    records: rows.map(row => ({
      strandId: row.strand_id,
      strandName: row.strands.name,
      subStrandId: row.sub_strand_id,
      subStrandName: row.sub_strands.name,
      competencyLevel: row.competency_level,
      evidenceCount: row.evidence_count,
      lastAssessedAt: row.last_assessed_at,
    })),
  };
}
```

## Repository Layer

For operations that combine multiple queries or require transaction management, a repository function wraps the lower-level database operations:

```typescript
// services/assessment/submit-assessment.ts

export async function submitAssessment(
  supabase: SupabaseClient,
  submission: AssessmentSubmission
): Promise<AssessmentResult> {
  // 1. Validate the assessment exists and belongs to the learner's class
  const assessment = await getAssessmentById(supabase, submission.assessmentId);
  validateAssessmentBelongsToClass(assessment, submission.classId);

  // 2. Calculate scores
  const score = calculateScore(submission.answers, assessment.rubric);

  // 3. Persist result and update learner progress in a transaction
  const result = await persistSubmissionTransaction(supabase, {
    submission,
    score,
    assessment,
  });

  // 4. Publish event (after transaction commits)
  await publishEvent('assessment.submitted', {
    learnerId: submission.learnerId,
    assessmentId: submission.assessmentId,
    score,
  });

  return result;
}
```

## Transaction Management

Use Supabase's RPC functions for operations that must be atomic:

```typescript
// supabase/functions/submit_assessment_transaction.sql
CREATE OR REPLACE FUNCTION submit_assessment_transaction(
  p_learner_id    uuid,
  p_assessment_id uuid,
  p_answers       jsonb,
  p_score         numeric,
  p_competency_level text
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_result_id uuid;
BEGIN
  -- Insert assessment result
  INSERT INTO assessment_results (learner_id, assessment_id, answers, score, created_at)
  VALUES (p_learner_id, p_assessment_id, p_answers, p_score, now())
  RETURNING id INTO v_result_id;

  -- Update learner progress
  INSERT INTO learner_progress (learner_id, sub_strand_id, competency_level, last_assessed_at)
  SELECT p_learner_id, sub_strand_id, p_competency_level, now()
  FROM assessments WHERE id = p_assessment_id
  ON CONFLICT (learner_id, sub_strand_id)
  DO UPDATE SET
    competency_level = EXCLUDED.competency_level,
    last_assessed_at = EXCLUDED.last_assessed_at,
    updated_at = now();

  RETURN v_result_id;
END;
$$;
```

```typescript
// Calling the transaction from TypeScript
const { data: resultId, error } = await supabase.rpc('submit_assessment_transaction', {
  p_learner_id: submission.learnerId,
  p_assessment_id: submission.assessmentId,
  p_answers: submission.answers,
  p_score: score,
  p_competency_level: computedLevel,
});

if (error) throw new Error(`Assessment submission failed: ${error.message}`);
```

**Rule:** Any operation that touches more than one table and must be consistent must use a DB-level transaction via RPC. TypeScript-level "transactions" (two sequential Supabase calls) are not atomic and will produce data inconsistency.

## Event Publishing

Events are published after the database operation succeeds. Never before.

```typescript
// services/events/publish.ts

import type { EventType, EventPayload } from '@edunexus/types';

export async function publishEvent<T extends EventType>(
  type: T,
  payload: EventPayload[T]
): Promise<void> {
  // Insert into the events table — the event delivery worker picks it up
  const { error } = await createServiceClient()
    .from('platform_events')
    .insert({
      type,
      payload,
      status: 'pending',
      created_at: new Date().toISOString(),
    });

  if (error) {
    // Log but do not throw — event publishing failure should not fail the primary operation
    logger.warn({ type, error: error.message }, 'Failed to publish event');
  }
}
```

The event delivery worker (in `workers/`) reads `pending` events, delivers them to registered webhooks with retry logic, and marks them `delivered` or `failed`.

**Critical rule:** Event publishing is not transactional with the primary DB operation in TypeScript. Use the outbox pattern — insert the event into a `platform_events` table in the same RPC function as the primary operation, ensuring they commit together.

## Validation

Validation happens at the API route boundary, never deep in service functions. Service functions trust their inputs (because the caller validated them at the boundary):

```typescript
// app/api/lesson-plans/generate/route.ts — validation at the boundary
import { generateLessonPlanSchema } from '@edunexus/services/ai';

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) return Response.json({ error: 'Invalid JSON' }, { status: 400 });

  const parsed = generateLessonPlanSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', details: parsed.error.errors }, { status: 400 });
  }

  // Service function receives typed, validated data
  const result = await generateLessonPlan(supabase, user.id, parsed.data);
  return Response.json({ data: result });
}
```

## Background Jobs

Background jobs run in the `apps/worker` process. Each job is a module:

```typescript
// apps/worker/src/jobs/send-progress-nudge.ts

import type { Job } from '../types';
import { getLearnerProgress } from '@edunexus/services/learner';
import { sendWhatsAppMessage } from '@edunexus/services/notifications';

export const sendProgressNudgeJob: Job = {
  name: 'send-progress-nudge',
  schedule: '0 18 * * 5', // Every Friday at 6pm

  async execute(supabase): Promise<void> {
    const start = Date.now();
    logger.info('Starting progress nudge job');

    const learners = await getLearnersWithActiveParentSubscriptions(supabase);
    logger.info({ count: learners.length }, 'Found learners with subscribed parents');

    let sent = 0;
    let failed = 0;

    for (const learner of learners) {
      try {
        const progress = await getLearnerProgress(supabase, learner.id, learner.currentTermId);
        await sendWhatsAppMessage(learner.parent.phone, formatProgressNudge(learner, progress));
        sent++;
      } catch (error) {
        failed++;
        logger.warn({ learnerId: learner.id, error }, 'Failed to send nudge for learner');
        // Continue to next learner — one failure does not abort the job
      }
    }

    logger.info({ sent, failed, durationMs: Date.now() - start }, 'Progress nudge job complete');
  },
};
```

**Job design rules:**
- Jobs are idempotent — running twice must produce the same result as running once
- Jobs log at start, at completion, and for each significant unit of work
- Individual item failures are caught and counted — they do not abort the job
- Jobs report metrics: count processed, count succeeded, count failed, duration

## AI Orchestration

AI calls always go through `services/ai/`. The orchestration layer handles:
- Context assembly (gathering curriculum, learner, and school context)
- Prompt construction (composing the system and user prompts)
- Token estimation (checking balance before calling)
- The API call itself
- Response validation (checking the AI returned what we asked for)
- Token cost deduction (after a successful response)
- Error handling and fallback

```typescript
// services/ai/generate-lesson-plan.ts

export async function generateLessonPlan(
  supabase: SupabaseClient,
  teacherId: string,
  input: GenerateLessonPlanInput
): Promise<LessonPlan> {
  // 1. Assemble context
  const context = await assembleLessonPlanContext(supabase, input);

  // 2. Estimate token cost
  const estimatedCost = estimatePromptTokens(context) + LESSON_PLAN_OUTPUT_TOKENS;

  // 3. Check and reserve tokens
  await checkTokenBalance(supabase, teacherId, estimatedCost);

  // 4. Call AI
  const start = Date.now();
  let aiResponse: string;
  try {
    aiResponse = await callDeepSeek(buildLessonPlanPrompt(context));
  } catch (aiError) {
    logger.error({ teacherId, input, error: aiError }, 'AI call failed');
    throw new AIGenerationError('Lesson plan generation failed. Please try again.');
  }

  // 5. Parse and validate AI response
  const lessonPlan = parseLessonPlanResponse(aiResponse);
  if (!isValidLessonPlan(lessonPlan)) {
    logger.error({ teacherId, aiResponse }, 'AI returned invalid lesson plan structure');
    throw new AIGenerationError('Generated plan was invalid. Please try again.');
  }

  // 6. Save to database
  const saved = await saveLessonPlan(supabase, teacherId, lessonPlan);

  // 7. Deduct tokens (after successful save)
  const actualCost = calculateActualCost(aiResponse);
  await deductTokens(supabase, teacherId, actualCost);

  logger.info({
    teacherId,
    subject: input.subject,
    grade: input.grade,
    tokens: actualCost,
    durationMs: Date.now() - start,
  }, 'Lesson plan generated');

  return saved;
}
```

---

---

# Part IV — Frontend Implementation Patterns

---

## Philosophy

The EduNexus frontend must work for a teacher in a Nairobi staffroom with 10 minutes between lessons on a 3G connection. It must work for a parent in Kisumu checking their child's progress on an old Android phone. It must work for a student in a rural school with intermittent internet.

These are not edge cases. They are the primary users. Frontend engineering at EduNexus means building for constraint first and enhancement second.

## Next.js App Router Conventions

We use the Next.js App Router (introduced in Next.js 13, stable in 14+). Understanding which components run where is foundational.

### Directory Structure in `apps/web`

```
apps/web/
├── app/
│   ├── (marketing)/             → Public pages (landing, pricing, about)
│   │   ├── layout.tsx           → Marketing layout (no auth)
│   │   └── page.tsx
│   ├── (dashboard)/             → Authenticated app
│   │   ├── layout.tsx           → Dashboard layout with nav (checks auth)
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── lesson-plans/
│   │   │   ├── page.tsx         → Lesson plan list
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx     → Lesson plan detail
│   │   │   └── new/
│   │   │       └── page.tsx     → New lesson plan form
│   │   └── learners/
│   │       └── ...
│   └── api/                     → Route handlers
│       ├── lesson-plans/
│       │   ├── route.ts         → GET list, POST create
│       │   └── [id]/
│       │       └── route.ts     → GET one, PUT update, DELETE
│       └── ...
├── components/                  → App-specific components
│   ├── lesson-plans/
│   ├── learners/
│   └── ui/                      → Local UI components (augments packages/ui)
├── lib/                         → Client-side utility functions
└── hooks/                       → Custom React hooks
```

## Server Components

Default to Server Components. Reach for Client Components only when you need:
- Browser APIs (`window`, `localStorage`, `navigator`)
- React hooks (`useState`, `useEffect`, `useContext`)
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Third-party libraries that use the above

```typescript
// app/(dashboard)/learners/page.tsx — Server Component (default)
// Runs on the server. Database access here is fine. No 'use client'.

import { createServerClient } from '@/utils/supabase/server';
import { getLearnersByTeacher } from '@edunexus/services/learner';
import { LearnerTable } from '@/components/learners/LearnerTable';

export default async function LearnersPage(): Promise<JSX.Element> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const learners = await getLearnersByTeacher(supabase, user.id);

  return (
    <div>
      <h1>My Learners</h1>
      <LearnerTable learners={learners} />
    </div>
  );
}
```

**What Server Components give us:**
- Zero client-side JavaScript for static content
- Database access without an API round-trip
- Smaller bundle sizes
- No loading states for the initial data fetch (streamed from the server)
- SEO-friendly rendering

## Client Components

Mark a component `'use client'` only at the lowest possible level in the tree. Do not mark a parent `'use client'` just because one child needs interactivity — split the child out.

```typescript
// components/learners/LearnerTable.tsx — Server Component (receives data via props)
import { LearnerRowActions } from './LearnerRowActions'; // only this child is client-side

type Props = { learners: Learner[] };

export function LearnerTable({ learners }: Props): JSX.Element {
  return (
    <table>
      <thead>...</thead>
      <tbody>
        {learners.map(learner => (
          <tr key={learner.id}>
            <td>{learner.name}</td>
            <td>{learner.grade}</td>
            <td>
              <LearnerRowActions learner={learner} /> {/* This is 'use client' */}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

```typescript
// components/learners/LearnerRowActions.tsx
'use client';

import { useState } from 'react';
import type { Learner } from '@edunexus/types';

type Props = { learner: Learner };

export function LearnerRowActions({ learner }: Props): JSX.Element {
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete(): Promise<void> {
    setIsDeleting(true);
    await fetch(`/api/learners/${learner.id}`, { method: 'DELETE' });
    // ...
  }

  return (
    <button onClick={handleDelete} disabled={isDeleting}>
      {isDeleting ? 'Deleting...' : 'Remove'}
    </button>
  );
}
```

## Forms

Forms use React Hook Form with Zod resolver for client-side validation that mirrors the server-side schema:

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { z as Z } from 'zod';

const formSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  grade: z.coerce.number().int().min(7).max(12),
  strandId: z.string().uuid('Please select a strand'),
  duration: z.enum(['30', '40', '60']),
});

type FormValues = Z.infer<typeof formSchema>;

export function LessonPlanForm(): JSX.Element {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { duration: '40' },
  });

  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  async function onSubmit(values: FormValues): Promise<void> {
    setState('loading');
    try {
      const response = await fetch('/api/lesson-plans/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error(await response.text());
      setState('success');
    } catch {
      setState('error');
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <label>
        Subject
        <select {...form.register('subject')}>
          <option value="">Select a subject</option>
          <option value="Mathematics">Mathematics</option>
          {/* ... */}
        </select>
        {form.formState.errors.subject && (
          <span role="alert">{form.formState.errors.subject.message}</span>
        )}
      </label>
      {/* ... */}
      <button type="submit" disabled={state === 'loading'}>
        {state === 'loading' ? 'Generating...' : 'Generate Lesson Plan'}
      </button>
      {state === 'error' && (
        <div role="alert">Something went wrong. Please try again.</div>
      )}
    </form>
  );
}
```

## Tables

Data tables handle large sets of learner, assessment, and curriculum data. Our table implementation requirements:

- **Server-side pagination** — never fetch all rows and paginate client-side
- **Sorting** — supported for any column that has a database index
- **Filtering** — URL-driven (filters are URL query params, enabling link sharing)
- **Loading state** — skeleton rows, not a spinner over the whole table
- **Empty state** — designed, not an afterthought

```typescript
// Server Component: learner list with URL-driven pagination and filtering
type SearchParams = {
  page?: string;
  sort?: string;
  grade?: string;
};

export default async function LearnersPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<JSX.Element> {
  const page = Number(searchParams.page ?? '1');
  const grade = searchParams.grade ? Number(searchParams.grade) : undefined;
  const sort = searchParams.sort ?? 'name_asc';

  const { learners, totalCount } = await getLearnersByTeacher(supabase, teacherId, {
    page,
    grade,
    sort,
    pageSize: 20,
  });

  return (
    <div>
      <LearnerFilters grade={grade} /> {/* client component */}
      <LearnerTable learners={learners} sort={sort} />
      <Pagination page={page} totalCount={totalCount} pageSize={20} />
    </div>
  );
}
```

## Offline-First Patterns

For critical learner-facing features (viewing lesson content, submitting work), support offline usage:

```typescript
// service worker registration (apps/web/public/sw.js)
// Cache-first for curriculum content, network-first for learner progress

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Curriculum data: cache for 24 hours (changes infrequently)
  if (url.pathname.startsWith('/api/curriculum')) {
    event.respondWith(cacheFirst(event.request, 'curriculum-v1', 24 * 60 * 60));
    return;
  }

  // Learner progress: network-first with cache fallback
  if (url.pathname.startsWith('/api/learners')) {
    event.respondWith(networkFirst(event.request, 'learner-v1'));
    return;
  }
});
```

## State Management

We do not use a global state library (Redux, Zustand) as a default. Server Components eliminate most of the cases that previously required global state.

**State by location:**

| State type | Where it lives |
|-----------|----------------|
| Server data | Server Components → props |
| URL-derived state | URL search params |
| Form state | React Hook Form |
| UI state (open/closed, hover) | `useState` in the component |
| Cross-component shared UI | React context (scoped, not global) |
| Optimistic updates | `useOptimistic` (React 19) |

**When to reach for React context:** Only for state that is genuinely shared across a subtree and changes infrequently (theme, authenticated user, school settings). Never for data that comes from the server.

## Accessibility

Accessibility is not a checklist. It is a design constraint that must be considered at the component level from the beginning.

**Required for every interactive component:**
- Keyboard operable (Tab, Enter, Escape, Arrow keys as appropriate)
- Visible focus state (never `outline: none` without a custom focus indicator)
- Correct ARIA roles and labels
- `aria-live` regions for dynamic content (AI generation results, progress updates)
- Color is never the only way to convey information

```typescript
// ✅ Accessible AI generation result
<div
  role="status"
  aria-live="polite"
  aria-label="Generated lesson plan"
>
  {state === 'loading' && <span>Generating your lesson plan...</span>}
  {state === 'success' && <LessonPlanRenderer plan={result} />}
  {state === 'error' && (
    <div role="alert">Generation failed. Please try again.</div>
  )}
</div>
```

## Performance

**Image optimization:** All images use `next/image`. No raw `<img>` tags.

**Font loading:** Load only the weights and styles actually used. Use `next/font` for zero-layout-shift font loading.

**Code splitting:** Each route is automatically code-split by Next.js. Heavy libraries (chart libraries, PDF generators) are dynamically imported.

```typescript
// Dynamic import for a heavy chart library
const CompetencyChart = dynamic(
  () => import('@/components/charts/CompetencyChart'),
  { loading: () => <ChartSkeleton />, ssr: false }
);
```

**Bundle budget:** The JavaScript bundle for any documentation page must stay under 150KB (compressed). CI enforces this with `bundlewatch`.

---

---

# Part V — AI Engineering Implementation

---

## Philosophy

AI is the most powerful and most dangerous layer of the platform. It is powerful because it can generate curriculum-aligned, context-aware educational content at scale. It is dangerous because it can generate educational content that is incorrect, biased, developmentally inappropriate, or misleading — and a teacher will trust it.

Every AI implementation decision is made with one question foremost: **what happens when this goes wrong?** Not if. When. The AI layer must be designed for failure at every point.

## Prompt Modules

Prompts are code. They are version-controlled, reviewed, and tested like code. They live in `services/ai/prompts/`.

Each prompt is a function that takes typed context and returns a typed prompt structure:

```typescript
// services/ai/prompts/lesson-plan.ts

import type { LessonPlanContext } from '../types';

type Prompt = {
  system: string;
  user: string;
};

export function buildLessonPlanPrompt(context: LessonPlanContext): Prompt {
  return {
    system: buildSystemPrompt(context),
    user: buildUserPrompt(context),
  };
}

function buildSystemPrompt(ctx: LessonPlanContext): string {
  return `You are an expert Kenyan CBC curriculum specialist and master teacher.
You help teachers create high-quality, KICD-aligned lesson plans for ${ctx.curriculum} curriculum.

CRITICAL RULES:
1. All learning objectives must directly reference the specified CBC learning outcomes.
2. Activities must be realistic for a class of ${ctx.learnerCount} learners in a ${ctx.setting} setting.
3. Assessment must use the CBC formative assessment approach (observation, oral, written, portfolio).
4. Time allocations must sum to exactly ${ctx.duration} minutes.
5. Never fabricate learning outcomes that do not exist in the official KICD curriculum.
6. If the requested strand/sub-strand is not appropriate for the grade, say so clearly.

CURRICULUM CONTEXT:
Grade: ${ctx.grade}
Subject: ${ctx.subject}
Strand: ${ctx.strand.name}
Sub-strand: ${ctx.subStrand.name}
Official learning outcomes:
${ctx.subStrand.outcomes.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
}

function buildUserPrompt(ctx: LessonPlanContext): string {
  const learnerContext = ctx.learnerContext
    ? `\n\nAdditional learner context: ${ctx.learnerContext}`
    : '';

  return `Create a ${ctx.duration}-minute lesson plan for the sub-strand "${ctx.subStrand.name}".
${learnerContext}

Format the response as JSON matching this exact structure:
${JSON.stringify(LESSON_PLAN_SCHEMA, null, 2)}`;
}
```

**Prompt design rules:**
- The system prompt defines the AI's identity, constraints, and curriculum context
- CRITICAL RULES are explicitly labeled and numbered — the AI attends to these
- The schema is injected directly into the prompt — never rely on the AI knowing our JSON format
- Factual curriculum data (learning outcomes, strand names) comes from our database, not from the AI's training data
- The AI is explicitly told what it cannot do (fabricate outcomes)

## Context Assembly

Context assembly is the process of gathering all data needed to populate the prompt. It runs before the AI call and must be fast and correct:

```typescript
// services/ai/context/lesson-plan-context.ts

export async function assembleLessonPlanContext(
  supabase: SupabaseClient,
  input: GenerateLessonPlanInput
): Promise<LessonPlanContext> {
  // Fetch all required context in parallel
  const [strand, subStrand, school, term] = await Promise.all([
    getStrandById(supabase, input.strandId),
    getSubStrandById(supabase, input.subStrandId),
    getSchoolById(supabase, input.schoolId),
    getCurrentTerm(supabase, input.schoolId),
  ]);

  // Fetch learning outcomes for the sub-strand
  const outcomes = await getLearningOutcomes(supabase, subStrand.id);

  return {
    curriculum: school.curriculum, // 'CBC' | '8-4-4' | 'IGCSE'
    grade: input.grade,
    subject: input.subject,
    strand,
    subStrand: { ...subStrand, outcomes: outcomes.map(o => o.description) },
    duration: input.duration,
    learnerCount: input.learnerCount ?? school.averageClassSize,
    setting: school.setting, // 'urban' | 'rural' | 'peri-urban'
    term,
    learnerContext: input.learnerContext,
  };
}
```

## Streaming

AI-generated content is streamed to the user. Streaming means the user sees content appearing word by word rather than waiting 10–15 seconds for a complete response. This is essential for perceived performance.

```typescript
// app/api/lesson-plans/generate/route.ts — streaming response

export async function POST(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser(request);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const input = generateLessonPlanSchema.parse(body);

  // Check tokens before starting the stream
  const context = await assembleLessonPlanContext(supabase, input);
  const estimatedCost = estimateTokenCost(context);
  await checkTokenBalance(supabase, user.id, estimatedCost);

  const prompt = buildLessonPlanPrompt(context);

  // Return a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = '';
      try {
        const aiStream = await streamFromDeepSeek(prompt);

        for await (const chunk of aiStream) {
          const content = chunk.choices[0]?.delta?.content ?? '';
          fullResponse += content;
          controller.enqueue(new TextEncoder().encode(content));
        }

        // After stream completes: save and deduct
        const lessonPlan = parseLessonPlanResponse(fullResponse);
        await saveLessonPlan(supabase, user.id, lessonPlan);
        const actualCost = calculateActualCost(aiStream.usage);
        await deductTokens(supabase, user.id, actualCost);

        controller.close();
      } catch (error) {
        logger.error({ userId: user.id, error }, 'Streaming generation failed');
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
```

**Client-side streaming consumption:**

```typescript
'use client';

export function LessonPlanGenerator(): JSX.Element {
  const [content, setContent] = useState('');
  const [state, setState] = useState<'idle' | 'streaming' | 'complete' | 'error'>('idle');

  async function generate(values: FormValues): Promise<void> {
    setState('streaming');
    setContent('');

    const response = await fetch('/api/lesson-plans/generate', {
      method: 'POST',
      body: JSON.stringify(values),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok || !response.body) {
      setState('error');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      setContent(prev => prev + decoder.decode(value));
    }

    setState('complete');
  }

  // ... render
}
```

## Response Validation

Never trust the AI's output structure. Always validate before using:

```typescript
// services/ai/validators/lesson-plan-validator.ts

import { z } from 'zod';

const lessonPlanResponseSchema = z.object({
  title: z.string().min(1).max(200),
  objectives: z.array(z.string().min(1)).min(1).max(5),
  activities: z.array(z.object({
    phase: z.enum(['introduction', 'development', 'conclusion']),
    duration: z.number().int().min(1),
    description: z.string().min(10),
    teacherActions: z.string().min(10),
    learnerActions: z.string().min(10),
  })).min(1),
  assessment: z.object({
    type: z.enum(['observation', 'oral', 'written', 'portfolio']),
    criteria: z.array(z.string().min(1)).min(1),
  }),
  resources: z.array(z.string()),
  differentiation: z.string().optional(),
});

export function parseLessonPlanResponse(rawResponse: string): LessonPlan {
  // Extract JSON from the response (the AI may wrap it in markdown code blocks)
  const jsonMatch = rawResponse.match(/```json\n?([\s\S]*?)\n?```/) ??
                    rawResponse.match(/(\{[\s\S]*\})/);

  if (!jsonMatch?.[1]) {
    throw new AIParseError('AI response did not contain valid JSON');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[1]);
  } catch {
    throw new AIParseError('AI response contained malformed JSON');
  }

  const validated = lessonPlanResponseSchema.safeParse(parsed);
  if (!validated.success) {
    logger.warn({ errors: validated.error.errors, raw: rawResponse }, 'AI response failed schema validation');
    throw new AIParseError(`AI response did not match expected structure: ${validated.error.message}`);
  }

  // Validate total duration matches requested
  const totalDuration = validated.data.activities.reduce((sum, a) => sum + a.duration, 0);
  if (Math.abs(totalDuration - requestedDuration) > 5) {
    logger.warn({ totalDuration, requestedDuration }, 'AI lesson plan duration mismatch');
    // Do not throw — warn and correct, rather than failing
    // ... adjust activities proportionally
  }

  return mapToLessonPlan(validated.data);
}
```

## Safety Checks

Before an AI response is saved or streamed to a user, it passes through safety checks:

```typescript
// services/ai/safety/content-safety.ts

const BLOCKED_PATTERNS = [
  /personal.{0,20}information/i,
  /identify.{0,20}student/i,
  // ...
];

const EDUCATIONAL_REQUIREMENTS = [
  (response: string) => response.includes('learning objective') || response.includes('objective'),
  (response: string) => response.length > 200, // Minimum content threshold
];

export function checkContentSafety(response: string, context: SafetyContext): SafetyResult {
  const issues: string[] = [];

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(response)) {
      issues.push(`Response matched blocked pattern: ${pattern.source}`);
    }
  }

  for (const check of EDUCATIONAL_REQUIREMENTS) {
    if (!check(response)) {
      issues.push('Response failed educational content check');
    }
  }

  return {
    safe: issues.length === 0,
    issues,
  };
}
```

## Model Routing

The model routing layer selects the appropriate AI model based on the operation:

```typescript
// services/ai/routing/model-router.ts

type AIOperation =
  | 'lesson_plan_generation'
  | 'assessment_generation'
  | 'learner_analysis'
  | 'progress_report'
  | 'quick_suggestion';

const MODEL_ASSIGNMENTS: Record<AIOperation, string> = {
  lesson_plan_generation: 'deepseek-chat',   // Full-featured, high quality
  assessment_generation: 'deepseek-chat',
  learner_analysis: 'deepseek-chat',
  progress_report: 'deepseek-chat',
  quick_suggestion: 'deepseek-chat',         // Could use a faster model when available
};

export function selectModel(operation: AIOperation): string {
  return MODEL_ASSIGNMENTS[operation];
}
```

This centralized routing makes it trivial to switch models, A/B test models, or add fallback models without touching each generation function.

## Fallback Strategy

```typescript
async function callDeepSeekWithFallback(prompt: Prompt): Promise<string> {
  try {
    return await callDeepSeek(prompt, { timeout: 30000 });
  } catch (primaryError) {
    logger.warn({ error: primaryError }, 'Primary AI call failed, attempting fallback');

    // Fallback: simplified prompt with same model
    try {
      const simplifiedPrompt = simplifyPrompt(prompt);
      return await callDeepSeek(simplifiedPrompt, { timeout: 15000 });
    } catch (fallbackError) {
      logger.error({ primaryError, fallbackError }, 'All AI attempts failed');
      throw new AIGenerationError('Generation failed after retry. Please try again in a few minutes.');
    }
  }
}
```

---

---

# Part VI — Database Engineering

---

## Philosophy

The database is the most expensive thing to get wrong. A misplaced index means slow queries that affect every teacher in a school. Missing RLS policy means a learner's private data is accessible to the wrong user. A bad migration means downtime during school hours.

Database changes get more review than any other type of change. They are never rushed, never deployed without testing on a migrated copy of production data, and never reversed by "just deleting the column" — reversals are their own forward migrations.

## Migration Workflow

**Migrations are sequential numbered SQL files.** Never edit a migration after it has been applied to any shared environment (staging, production).

```
supabase/migrations/
├── 20260101000000_initial_schema.sql
├── 20260115000000_add_learner_progress.sql
├── 20260201000000_add_assessment_results.sql
├── 20260215000000_add_token_balances.sql
└── 20260630000000_add_developer_api_keys.sql
```

**Creating a migration:**
```bash
# Always generate with a descriptive name
supabase migration new add_developer_api_keys

# This creates: supabase/migrations/YYYYMMDDHHMMSS_add_developer_api_keys.sql
```

**Migration file structure:**

```sql
-- Migration: 20260630000000_add_developer_api_keys.sql
-- Purpose: Add developer API key management tables for the developer platform
-- Author: Dennis Kariuki
-- Date: 2026-06-30
-- Reviewed by: Platform Team
-- Rollback: 20260630000001_rollback_developer_api_keys.sql

-- Always create a rollback migration before applying to production

BEGIN;

CREATE TABLE developer_api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  developer_id    uuid NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) <= 100),
  key_hash        text NOT NULL UNIQUE,
  key_prefix      text NOT NULL CHECK (char_length(key_prefix) = 12),
  key_type        text NOT NULL CHECK (key_type IN (
    'live_secret', 'test_secret', 'live_publishable', 'test_publishable', 'restricted'
  )),
  scopes          text[] NOT NULL DEFAULT '{}',
  is_active       boolean NOT NULL DEFAULT true,
  last_used_at    timestamptz,
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Indexes for expected query patterns
CREATE INDEX idx_developer_api_keys_developer_id ON developer_api_keys(developer_id);
CREATE INDEX idx_developer_api_keys_key_prefix ON developer_api_keys(key_prefix) WHERE is_active = true;
CREATE INDEX idx_developer_api_keys_last_used ON developer_api_keys(last_used_at) WHERE is_active = true;

-- Trigger to auto-update updated_at
CREATE TRIGGER developer_api_keys_updated_at
  BEFORE UPDATE ON developer_api_keys
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE developer_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "developers can read their own keys"
  ON developer_api_keys FOR SELECT
  USING (developer_id = auth.uid());

CREATE POLICY "developers can create their own keys"
  ON developer_api_keys FOR INSERT
  WITH CHECK (developer_id = auth.uid());

CREATE POLICY "developers can update their own keys"
  ON developer_api_keys FOR UPDATE
  USING (developer_id = auth.uid())
  WITH CHECK (developer_id = auth.uid());

COMMIT;
```

## Index Strategy

**Index everything that appears in a WHERE clause, JOIN condition, or ORDER BY that runs more than trivially.**

Required indexes:
- Every foreign key column (Postgres does not auto-index FKs, unlike MySQL)
- Every column used in RLS policies (critical — without this, RLS scans the whole table)
- Composite indexes for multi-column filters (column order matters: most selective first)
- Partial indexes for commonly filtered subsets

```sql
-- RLS policy relies on teacher_id — must be indexed
CREATE INDEX idx_lesson_plans_teacher_id ON lesson_plans(teacher_id);

-- This query runs on every dashboard page load — composite index
CREATE INDEX idx_learner_progress_learner_term
  ON learner_progress(learner_id, term_id);

-- Only active keys are looked up — partial index
CREATE INDEX idx_api_keys_active_prefix
  ON developer_api_keys(key_prefix)
  WHERE is_active = true;

-- Sorting by created_at is common — include in index
CREATE INDEX idx_lesson_plans_teacher_created
  ON lesson_plans(teacher_id, created_at DESC);
```

**Index anti-patterns:**
- Indexing columns that are rarely filtered (status columns with 2 values in a small table)
- Over-indexing write-heavy tables (indexes slow down INSERT/UPDATE)
- Not indexing JSON fields that are queried with `->>` operators (use `CREATE INDEX ON table ((data->>'field'))`)

## RLS Implementation

Every table has RLS enabled. Every table has explicit policies. "Enabled but no policies = no access for anyone" is the correct secure default.

**RLS policy naming convention:** `"{role} can {action} {scope}"`

```sql
-- Standard patterns for educational data

-- Teachers see only their own resources
CREATE POLICY "teachers can read their own lesson plans"
  ON lesson_plans FOR SELECT
  USING (teacher_id = auth.uid());

-- Teachers see learners in their classes
CREATE POLICY "teachers can read learners in their classes"
  ON learners FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM class_enrollments ce
      JOIN classes c ON ce.class_id = c.id
      WHERE ce.learner_id = learners.id
        AND c.teacher_id = auth.uid()
    )
  );

-- Parents see only their own children
CREATE POLICY "parents can read their children's progress"
  ON learner_progress FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM parent_learner_links pll
      WHERE pll.learner_id = learner_progress.learner_id
        AND pll.parent_id = auth.uid()
    )
  );

-- Service role bypasses RLS (for cron jobs and webhook handlers)
-- Never grant the service role to client-side operations
```

**Testing RLS:**
Every RLS policy has a corresponding test in `supabase/tests/rls/`:

```sql
-- supabase/tests/rls/lesson_plans_test.sql
BEGIN;
SELECT plan(4);

-- Set up test users
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-000000000001', 'teacher1@test.com'),
  ('00000000-0000-0000-0000-000000000002', 'teacher2@test.com');

-- Insert a lesson plan for teacher1
INSERT INTO lesson_plans (id, teacher_id, title) VALUES
  ('plan-1', '00000000-0000-0000-0000-000000000001', 'Test Plan');

-- Teacher1 can read their own plan
SET LOCAL role TO authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-0000-0000-0000-000000000001"}';
SELECT results_eq(
  'SELECT count(*)::int FROM lesson_plans',
  ARRAY[1],
  'Teacher1 sees their own plan'
);

-- Teacher2 cannot read teacher1''s plan
SET LOCAL "request.jwt.claims" TO '{"sub": "00000000-0000-0000-0000-000000000002"}';
SELECT results_eq(
  'SELECT count(*)::int FROM lesson_plans',
  ARRAY[0],
  'Teacher2 cannot see teacher1''s plan'
);

SELECT finish();
ROLLBACK;
```

## Views and Materialized Views

**Views** for commonly joined queries that are needed in multiple places:

```sql
-- Learner progress summary view (joins multiple tables for dashboard use)
CREATE VIEW learner_progress_summary AS
SELECT
  lp.learner_id,
  l.name AS learner_name,
  l.grade,
  s.name AS strand_name,
  ss.name AS sub_strand_name,
  lp.competency_level,
  lp.last_assessed_at,
  t.name AS term_name
FROM learner_progress lp
JOIN learners l ON lp.learner_id = l.id
JOIN strands s ON lp.strand_id = s.id
JOIN sub_strands ss ON lp.sub_strand_id = ss.id
JOIN terms t ON lp.term_id = t.id;

-- RLS on views: the underlying table's RLS applies to view queries
```

**Materialized views** for expensive aggregations that power analytics dashboards:

```sql
-- School competency distribution — refreshed nightly by a cron job
CREATE MATERIALIZED VIEW school_competency_stats AS
SELECT
  l.school_id,
  lp.strand_id,
  s.name AS strand_name,
  lp.competency_level,
  COUNT(*) AS learner_count,
  date_trunc('day', now()) AS computed_at
FROM learner_progress lp
JOIN learners l ON lp.learner_id = l.id
JOIN strands s ON lp.strand_id = s.id
GROUP BY l.school_id, lp.strand_id, s.name, lp.competency_level;

CREATE UNIQUE INDEX ON school_competency_stats(school_id, strand_id, competency_level);

-- Refresh command (run by cron worker nightly at 2am)
REFRESH MATERIALIZED VIEW CONCURRENTLY school_competency_stats;
```

---

---

# Part VII — Testing Implementation

---

## Philosophy

Tests are the only proof that the code is correct. In educational software, "probably correct" is not acceptable — teachers make decisions based on our data, parents trust our reports, and students' academic records live in our database. Every production path that can be tested must be tested.

We distinguish between tests that verify the code does what it says (unit and integration tests) and tests that verify the system does what the user needs (end-to-end tests). Both matter. Neither replaces the other.

## Unit Tests

Unit tests live next to the code they test: `lesson-plan-generator.ts` is tested by `lesson-plan-generator.test.ts` in the same directory.

Unit tests are for pure functions — functions with no external dependencies (no database, no API calls, no filesystem):

```typescript
// services/ai/validators/lesson-plan-validator.test.ts

import { parseLessonPlanResponse } from './lesson-plan-validator';

describe('parseLessonPlanResponse', () => {
  it('parses a valid lesson plan response', () => {
    const validResponse = JSON.stringify({
      title: 'Introduction to Whole Numbers',
      objectives: ['Identify place values up to millions'],
      activities: [
        {
          phase: 'introduction',
          duration: 10,
          description: 'Teacher introduces the concept...',
          teacherActions: 'Display place value chart...',
          learnerActions: 'Observe and note...',
        },
      ],
      assessment: {
        type: 'observation',
        criteria: ['Learner correctly identifies place values'],
      },
      resources: ['Place value chart'],
    });

    const result = parseLessonPlanResponse(validResponse);
    expect(result.title).toBe('Introduction to Whole Numbers');
    expect(result.objectives).toHaveLength(1);
  });

  it('extracts JSON from markdown code blocks', () => {
    const wrappedResponse = `Here is your lesson plan:\n\`\`\`json\n${JSON.stringify(validPlan)}\n\`\`\``;
    const result = parseLessonPlanResponse(wrappedResponse);
    expect(result.title).toBeDefined();
  });

  it('throws AIParseError for responses with no JSON', () => {
    expect(() => parseLessonPlanResponse('This is just text, no JSON here.')).toThrow('AIParseError');
  });

  it('throws AIParseError for malformed JSON', () => {
    expect(() => parseLessonPlanResponse('{ "title": broken json }')).toThrow('AIParseError');
  });
});
```

## Integration Tests

Integration tests test service functions against a real database (a local Supabase instance seeded with test data).

```typescript
// services/learner/get-learner-progress.integration.test.ts

import { createClient } from '@supabase/supabase-js';
import { getLearnerProgress } from './get-learner-progress';
import { seedTestLearner, cleanupTestLearner } from '@edunexus/test-utils';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

describe('getLearnerProgress', () => {
  let learnerId: string;
  let termId: string;

  beforeEach(async () => {
    ({ learnerId, termId } = await seedTestLearner(supabase));
  });

  afterEach(async () => {
    await cleanupTestLearner(supabase, learnerId);
  });

  it('returns progress records for a learner in a term', async () => {
    const progress = await getLearnerProgress(supabase, learnerId, termId);

    expect(progress.learnerId).toBe(learnerId);
    expect(progress.records.length).toBeGreaterThan(0);
    expect(progress.records[0].competencyLevel).toBeDefined();
  });

  it('throws LearnerNotFoundError for unknown learner ID', async () => {
    await expect(
      getLearnerProgress(supabase, '00000000-0000-0000-0000-000000000000', termId)
    ).rejects.toThrow('LearnerNotFoundError');
  });
});
```

## Test Data Factories

Factories produce consistent, realistic test data:

```typescript
// packages/test-utils/src/factories/learner.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Learner } from '@edunexus/types';

let counter = 0;

export function buildLearner(overrides: Partial<Learner> = {}): Omit<Learner, 'id' | 'created_at'> {
  counter++;
  return {
    name: `Test Learner ${counter}`,
    grade: 7,
    school_id: TEST_SCHOOL_ID,
    ...overrides,
  };
}

export async function seedTestLearner(
  supabase: SupabaseClient,
  overrides: Partial<Learner> = {}
): Promise<{ learnerId: string; termId: string }> {
  const { data: learner, error } = await supabase
    .from('learners')
    .insert(buildLearner(overrides))
    .select('id')
    .single();

  if (error || !learner) throw new Error(`Failed to seed test learner: ${error?.message}`);

  // Seed some progress records
  await supabase.from('learner_progress').insert(
    TEST_SUB_STRAND_IDS.map(subStrandId => ({
      learner_id: learner.id,
      term_id: TEST_TERM_ID,
      strand_id: TEST_STRAND_ID,
      sub_strand_id: subStrandId,
      competency_level: 'approaching',
    }))
  );

  return { learnerId: learner.id, termId: TEST_TERM_ID };
}

export async function cleanupTestLearner(
  supabase: SupabaseClient,
  learnerId: string
): Promise<void> {
  await supabase.from('learner_progress').delete().eq('learner_id', learnerId);
  await supabase.from('learners').delete().eq('id', learnerId);
}
```

## AI Evaluation Tests

AI calls are non-deterministic and expensive — they cannot be unit tested in the traditional sense. Instead, we use evaluation tests that run against a curated set of test cases and score the outputs:

```typescript
// services/ai/__tests__/evaluations/lesson-plan-eval.test.ts

const TEST_CASES: LessonPlanEvalCase[] = [
  {
    input: {
      subject: 'Mathematics',
      grade: 7,
      strandId: 'str_math_g7_numbers',
      subStrandId: 'ss_math_g7_numbers_whole',
      duration: 40,
    },
    expectations: {
      mustContainObjectives: true,
      mustHaveActivitiesWithCorrectTotalDuration: true,
      mustReferenceKICDOutcomes: true,
      mustHaveAssessmentCriteria: true,
    },
  },
  // ... more test cases
];

describe('Lesson plan AI evaluation', () => {
  // These tests run only in CI with the AI_EVAL=true env var, not on every developer machine
  const runEvals = process.env.AI_EVAL === 'true';

  (runEvals ? it : it.skip)('generates structurally valid lesson plans', async () => {
    const results = await Promise.all(
      TEST_CASES.map(async (tc) => {
        const output = await generateLessonPlan(supabase, 'eval-teacher', tc.input);
        return evaluateLessonPlan(output, tc.expectations);
      })
    );

    const passRate = results.filter(r => r.passed).length / results.length;
    expect(passRate).toBeGreaterThanOrEqual(0.95); // 95% of eval cases must pass
  });
});
```

## CI Execution

Tests run in stages in CI, fast first:

```yaml
# .github/workflows/ci.yml

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - run: pnpm lint
      - run: pnpm typecheck

  unit-tests:
    runs-on: ubuntu-latest
    needs: lint
    steps:
      - run: pnpm test:unit --coverage

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      supabase:
        image: supabase/postgres:15
    steps:
      - run: pnpm supabase db reset --local
      - run: pnpm test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - run: pnpm build
      - run: pnpm test:e2e

  ai-evaluations:
    runs-on: ubuntu-latest
    needs: integration-tests
    if: github.ref == 'refs/heads/main'
    env:
      AI_EVAL: true
      DEEPSEEK_API_KEY: ${{ secrets.DEEPSEEK_API_KEY_TEST }}
    steps:
      - run: pnpm test:eval
```

---

---

# Part VIII — Developer Workflow

---

## Philosophy

Developer workflow is not bureaucracy. It is the set of conventions that make a team of engineers function as a coherent unit rather than a collection of individuals who occasionally merge code. Every convention here exists because a previous alternative produced a problem — a bad deploy, a miscommunicated change, a lost review, a confusing git history.

## Git Workflow

We use **trunk-based development** with short-lived feature branches. The main branch is always deployable. There are no long-running feature branches, no release branches, no develop branches.

**Branch naming:**
```
{type}/{ticket-or-description}

feat/lesson-plan-streaming
fix/token-deduction-race-condition
refactor/ai-context-assembly
docs/api-rate-limits
chore/upgrade-supabase-sdk
security/fix-rls-policy-gap
```

**Branch lifetime:** No branch lives longer than 3 days. If a feature takes longer, it is split into smaller pieces delivered behind a feature flag.

## Commit Conventions

We follow the Conventional Commits specification with the emoji suffixes defined in CLAUDE.md:

```
feat: add streaming support to lesson plan API 🎯
fix: correct token cost calculation for long prompts 🔧
refactor: extract AI context assembly to dedicated module ♻️
docs: add webhook signature verification examples 📋
perf: replace sequential learner fetches with batch query ⚡
security: fix RLS policy on learner_progress table 🔒
chore: upgrade DeepSeek SDK to v2.1.0
test: add integration tests for assessment submission
```

**Commit body (for non-trivial changes):**

```
feat: add streaming support to lesson plan API 🎯

Lesson plan generation now streams the response token by token rather than
waiting for the complete response. This reduces perceived latency from ~12s
to first byte to ~300ms.

Token deduction still occurs after the full response, so the cost calculation
remains accurate. The stream is proxied through an Edge Function to avoid
client-side AI SDK imports.

Closes #234
```

## Pull Request Process

**PR size rule:** A PR should be reviewable in under 30 minutes. If it takes longer, it should be split. This is not about convenience — large PRs get superficial reviews. Small PRs get thorough ones.

**PR template:**
```markdown
## What this does
[One paragraph describing the change and why it is needed]

## How to test
[Specific steps to verify the change works]

## Screenshots (if UI change)

## Checklist
- [ ] TypeScript compiles with no errors
- [ ] All new code has tests
- [ ] Database migrations include rollback
- [ ] RLS policies are tested
- [ ] AI prompts are validated against at least 3 test cases
- [ ] No `any` types introduced
- [ ] No `select('*')` queries
- [ ] Logging added for significant operations
- [ ] CLAUDE.md conventions followed
```

## Code Review Checklist

Reviewers verify:

**Correctness:**
- Does this do what the description says?
- Are edge cases handled? (empty arrays, null values, concurrent operations)
- Are error cases handled explicitly?
- Is the DB query correct? (columns selected, join conditions, filters)
- Are RLS policies correct for the new data?

**Security:**
- Does every API route authenticate the user?
- Is the authenticated user's ID used (not the request body's `userId`)?
- Are inputs validated with Zod before reaching service functions?
- Are new DB tables protected with RLS?
- Are API keys or secrets present in the code? (auto-checked by git-secrets)

**Performance:**
- Are there queries inside loops?
- Are necessary indexes added for new tables or new query patterns?
- Is data fetched that is not used?

**Maintainability:**
- Are function names clear and accurate?
- Is there any duplication of existing logic?
- Does the code organization follow the established patterns?
- Would a new team member understand this in 6 months?

## Release Workflow

We use continuous deployment. Every merge to `main` deploys to production automatically after CI passes.

**Deploy pipeline:**
```
merge to main
  → CI: lint + typecheck (2 min)
  → CI: unit tests (3 min)
  → CI: integration tests (8 min)
  → Deploy to staging (2 min)
  → Smoke tests against staging (5 min)
  → Deploy to production (2 min)
  → Verify deployment (health check + 1 synthetic transaction)
```

**Feature flags** (via PostHog) allow merging incomplete features to main without exposing them to users:

```typescript
const featureFlags = await posthog.getAllFlags(userId);
if (featureFlags['new-ai-streaming']) {
  return generateLessonPlanStreamed(ctx);
} else {
  return generateLessonPlanBlocking(ctx);
}
```

## Rollback Procedures

**Application rollback** (code regression):
1. Identify the bad deploy via monitoring alerts or user reports
2. Run `vercel rollback` to the previous deployment (instant)
3. Investigate the root cause in the rolled-back state
4. Fix forward — never patch the production deployment directly

**Database rollback:**
Database migrations are irreversible in general. We maintain forward rollback migrations:
```bash
# Apply the rollback migration
supabase db push supabase/migrations/20260630000001_rollback_developer_api_keys.sql
```

This is a forward migration that undoes the previous one. We never edit applied migrations.

---

---

# Part IX — Observability & Debugging

---

## Philosophy

You cannot fix what you cannot see. Observability is not a feature added after the fact — it is built into every function, every API route, every background job from the start. A production incident that takes more than 15 minutes to diagnose is a system that was not designed for observability.

## Logging Conventions

**Request ID propagation:**
Every request gets a unique ID injected by middleware. This ID is included in every log line for the lifecycle of that request:

```typescript
// middleware.ts
export function middleware(request: NextRequest): NextResponse {
  const requestId = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set('x-request-id', requestId);
  // The requestId is passed to the logger via AsyncLocalStorage
  requestIdStorage.run(requestId, () => { /* ... */ });
  return response;
}
```

```typescript
// Every log line in the request lifecycle includes requestId
logger.info({ requestId, teacherId, operation: 'lesson_plan_generate' }, 'Starting generation');
```

**Structured logging format (JSON):**
```json
{
  "level": "info",
  "time": "2026-06-30T14:23:45.123Z",
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "teacherId": "teacher-123",
  "operation": "lesson_plan_generate",
  "subject": "Mathematics",
  "grade": 7,
  "durationMs": 847,
  "tokens": 1234,
  "cost": 2,
  "msg": "Lesson plan generated"
}
```

## Metrics

Key metrics collected and sent to the monitoring dashboard (Grafana):

**API metrics:**
- Request rate (per endpoint, per minute)
- Error rate (per endpoint, by status code)
- Latency (p50, p95, p99 per endpoint)
- Active connections

**AI metrics:**
- Generation requests per minute
- Success rate (completions / attempts)
- Token usage per day (for cost monitoring)
- Latency per model

**Business metrics:**
- Daily active teachers
- Lesson plans generated today
- Assessments submitted today
- Token balance distribution across schools

**Database metrics:**
- Query latency (slow query log for queries > 1 second)
- Connection pool usage
- Row counts for large tables

## Error Reporting

All unhandled errors in production are reported to Sentry with full context:

```typescript
import * as Sentry from '@sentry/nextjs';

// In error handlers
try {
  await generateLessonPlan(supabase, teacherId, input);
} catch (error) {
  Sentry.withScope((scope) => {
    scope.setUser({ id: teacherId });
    scope.setExtra('input', input);
    scope.setTag('operation', 'lesson_plan_generate');
    Sentry.captureException(error);
  });
  throw error;
}
```

Sentry alerts go to the on-call engineer via PagerDuty when:
- Error rate for any endpoint exceeds 1% sustained for 5 minutes
- A new unique error pattern appears more than 5 times in 10 minutes
- Any unhandled promise rejection in a background job

## Production Debugging

When debugging a production issue:

1. **Find the request ID** from the user report or error report
2. **Search logs** for that request ID to see the full request lifecycle
3. **Check AI responses** in the `ai_generation_logs` table (we log all AI inputs/outputs)
4. **Check the DB state** for the affected user using the Supabase dashboard
5. **Reproduce locally** with the same inputs (test data, same API call)

**Never access production user data directly.** Use the admin panel to look up a user's state. Log access to the admin panel is audited.

---

---

# Part X — Performance Engineering

---

## Philosophy

Performance is a feature. For a teacher opening a dashboard between lessons, a 5-second load means they do not use it. For a student on a slow connection, a 10-second page means they give up. Performance at EduNexus is measured for the 90th percentile user under realistic conditions, not the median user on a fast connection.

## Latency Targets

| Operation | Target (p95) | Measurement |
|-----------|-------------|-------------|
| Page load (dashboard) | < 2s (4G) / < 5s (3G) | Real User Monitoring |
| API read (learner data, curriculum) | < 300ms | Server-side |
| API write (save lesson plan) | < 500ms | Server-side |
| AI generation (first token) | < 2s | Server-side |
| AI generation (complete) | < 30s | Server-side |
| Search results | < 150ms | Typesense metrics |
| Database query (indexed) | < 50ms | pg_stat_statements |

## Frontend Optimization

**Core Web Vitals targets:**
- LCP (Largest Contentful Paint): < 2.5s
- FID / INP (Interaction to Next Paint): < 200ms
- CLS (Cumulative Layout Shift): < 0.1

**Practical optimizations:**

```typescript
// 1. Skeleton loading for progressive rendering
export default async function DashboardPage(): Promise<JSX.Element> {
  return (
    <div>
      <Suspense fallback={<LearnerTableSkeleton />}>
        <LearnerTable />  {/* This fetches data on the server */}
      </Suspense>
    </div>
  );
}

// 2. Parallel data fetching at the route level
export default async function LearnerDetailPage({ params }: Props): Promise<JSX.Element> {
  // Run all fetches in parallel — never sequential awaits for independent data
  const [learner, progress, assessments] = await Promise.all([
    getLearnerById(supabase, params.id),
    getLearnerProgress(supabase, params.id, currentTermId),
    getRecentAssessments(supabase, params.id, { limit: 5 }),
  ]);

  return <LearnerDetail learner={learner} progress={progress} assessments={assessments} />;
}

// 3. Aggressive caching for stable data
export const revalidate = 3600; // Re-fetch curriculum data once per hour
// Curriculum data almost never changes — cache aggressively

// 4. Prefetch on hover
<Link href={`/learners/${learner.id}`} prefetch={true}>
  {learner.name}
</Link>
```

## Backend Optimization

**Database query optimization:**

```typescript
// ❌ N+1 query — fetches learner then makes one DB call per class
const learners = await getLearnersByClass(supabase, classId);
const enrichedLearners = await Promise.all(
  learners.map(l => getLatestAssessment(supabase, l.id))
);

// ✅ Single query with join
const { data: learnersWithAssessments } = await supabase
  .from('learners')
  .select(`
    id, name, grade,
    assessment_results (
      score, competency_level, created_at
    )
  `)
  .eq('class_id', classId)
  .order('created_at', { foreignTable: 'assessment_results', ascending: false })
  .limit(1, { foreignTable: 'assessment_results' });
```

## AI Optimization

Token cost optimization:

```typescript
// 1. Cache curriculum context — the strand/outcome data changes rarely
const context = await curriculumContextCache.getOrSet(
  `context:${strandId}:${grade}`,
  () => assembleCurriculumContext(supabase, strandId, grade),
  { ttl: 3600 } // Cache for 1 hour
);

// 2. Truncate learner context to essential information only
function truncateLearnerContext(context: string, maxChars = 500): string {
  if (context.length <= maxChars) return context;
  return context.slice(0, maxChars) + '... [truncated for token efficiency]';
}

// 3. Use the smallest model that produces acceptable quality
// Evaluate regularly: does the cheaper model meet our quality bar for this operation?
```

## Caching Strategy

| Layer | Technology | TTL | What |
|-------|------------|-----|------|
| CDN | Vercel Edge Cache | 1 hour | Static documentation pages |
| Application | In-memory LRU cache | 5 minutes | Curriculum structure (grades, strands) |
| Application | Redis (Upstash) | 1 hour | Assembled AI context for repeated prompts |
| Database | Materialized views | Refreshed nightly | Analytics aggregations |

---

---

# Part XI — Scaling & Maintenance

---

## Philosophy

A codebase that is not maintained is a codebase that is dying. Technical debt is not abstract — it is the sum of all shortcuts taken under time pressure that now slow down every future change. At EduNexus, we budget time for maintenance explicitly. Every sprint includes maintenance work. We do not accumulate debt indefinitely and then take a "tech debt sprint" — we pay it continuously.

## Refactoring Strategy

**The rule:** Only refactor when you have tests to prove the behavior has not changed, or when the refactoring is so small that a test is overkill.

**When to refactor:**
- When adding a feature would require duplicating existing logic
- When a module has more than one reason to change (violation of single responsibility)
- When understanding a function requires scrolling (> ~50 lines of active logic)
- When the same bug has been fixed in the same area more than once (the code is structurally wrong)

**Refactoring workflow:**
1. Write tests for the current behavior (if they do not exist)
2. Refactor
3. Verify tests still pass
4. Review the refactoring in isolation from any feature work — refactors and features are separate PRs

## Dependency Upgrades

Dependency upgrades are not optional maintenance. Outdated dependencies are security vulnerabilities, performance deficits, and compatibility problems waiting to materialize.

```bash
# Weekly automated checks (GitHub Dependabot configured in .github/dependabot.yml)
# Manual review monthly:

# Check for outdated packages
pnpm outdated

# Check for known vulnerabilities
pnpm audit

# Upgrade non-breaking minor/patch versions
pnpm update --recursive

# For major version upgrades: read the migration guide first
# Test in a branch, run full CI, deploy to staging, monitor for 24h before production
```

**Dependency upgrade policy:**
- Security patches: merged within 24 hours of disclosure
- Minor versions: upgraded monthly
- Major versions: assessed quarterly, upgraded when stable and migration cost is manageable

## AI Model Replacement

When a new, better, or cheaper AI model becomes available, the migration path is:

1. **Implement the new model** behind the model router (add a new model class implementing `AIModelProvider`)
2. **A/B test** on a small percentage of traffic using feature flags (10% of generations use the new model)
3. **Evaluate** on the eval test suite and on captured real request/response pairs
4. **Gradually roll out** (10% → 50% → 100% over 2 weeks)
5. **Retire the old model** — remove the code, not just the routing

This process ensures teachers never experience a sudden quality change in AI output.

## Technical Debt Retirement

Technical debt items are tracked in GitHub Issues with the label `technical-debt`. Each item includes:
- What the debt is
- Why it was taken on (time pressure, API limitation, etc.)
- What the cost is (makes feature X harder, slows down Y by Zms)
- The retirement plan

The platform team reviews the debt backlog monthly and schedules retirement work in the next sprint.

---

---

# Part XII — Engineering Culture

---

## Philosophy

The technical decisions in this guide are easier to follow in a culture that values them. A culture where engineers feel safe raising concerns, where complexity is rewarded with curiosity rather than impatience, where the definition of done includes "maintainable by a future engineer who was not in the room."

## Code Ownership

Code ownership at EduNexus is collective, not individual. The CODEOWNERS file defines team ownership, not individual ownership. Individual engineers are responsible for the PRs they merge. No one hoards code. No one is the only person who understands a system.

**The bus factor test:** For every significant system, two engineers must be able to maintain it independently. If only one person understands a system, that is a risk that must be addressed — through pair programming, documentation, code review, or rotation.

## Mentorship

Senior engineers at EduNexus have an explicit mentorship responsibility. This is not optional — it is part of the role.

**Concrete expectations:**
- Every junior engineer has a named senior mentor
- Mentors review at least one PR per week from their mentee with detailed, educational feedback
- Mentors pair with their mentees for at least 2 hours per week on non-trivial problems
- Mentors document the patterns they teach so the knowledge is not lost when they move on

## Pair Programming

We pair on:
- New system design decisions (two engineers architect together before writing)
- Tricky bugs (when you have been stuck for more than 2 hours, pair)
- Security-sensitive code (RLS policies, auth flows, payment webhooks — always pair)
- Onboarding new team members (pair for the first 2 weeks)

Pairing is not a sign of weakness. Pairing is how knowledge spreads and how bugs are caught before they exist.

## Knowledge Sharing

**Architecture Decision Records (ADRs):** Every significant technical decision is documented in `docs/decisions/`:

```markdown
# ADR-0042: Use Typesense for Developer Platform Search

**Status:** Accepted
**Date:** 2026-06-30
**Deciders:** Platform Team

## Context
We need a fast, accurate search for the developer platform documentation. Options evaluated: Algolia, Typesense (self-hosted), Postgres full-text search.

## Decision
Typesense, self-hosted in Kenya.

## Reasoning
- Data sovereignty: all developer data stays in Kenya
- No per-search cost at scale
- Typo tolerance built in (better than Postgres FTS)
- Algolia rejected: external data dependency for a core UX feature

## Consequences
- We operate the Typesense instance (maintenance overhead)
- No cost ceiling risk from search volume
- All search index data remains under our control
```

**Engineering blog:** Monthly internal posts sharing:
- Interesting problems solved
- New patterns adopted
- Performance improvements and what produced them
- Lessons from incidents

**Weekly engineering sync:** 30 minutes, rotating presenter, topic is "something I learned this week" — technical or process.

## Engineering Excellence

Excellence at EduNexus means:

- **Writing tests first** when you are unclear about what a function should do (the test clarifies)
- **Questioning the requirement** before writing code when the requirement is ambiguous (clarify once, implement once)
- **Raising the concern** when you see a security issue, a performance problem, or a correctness risk — even if the code is someone else's and the deadline is tomorrow
- **Fixing it now** when you see a small bug or violation while working nearby (the Scout Rule: leave the codebase better than you found it)
- **Saying "I don't know"** and then finding out, rather than guessing

Excellence is not perfectionism. It is not rewriting working code because you would have done it differently. It is not gold-plating features that do not need it. Excellence is consistently doing the right amount of the right thing.

---

---

# The EduNexus Engineering Oath

---

Every engineer who contributes to EduNexus is contributing to infrastructure that serves children, teachers, and families across Kenya. The code you write influences which learner gets identified as needing support. The prompt you design determines how a parent understands their child's education. The database query you write either respects the privacy of a twelve-year-old's academic record or violates it.

This is not abstract.

As an EduNexus engineer, you commit to:

---

**Educational Correctness Above All.**
I will not ship code that produces educationally incorrect output. I will validate AI responses. I will question curriculum data that does not match official KICD documentation. I will treat an incorrect competency level displayed to a teacher as a bug of the highest severity, not an acceptable approximation.

**Long-Term Maintainability Over Short-Term Convenience.**
I will write code for the engineer who inherits it two years from now. I will not take shortcuts that I know will become problems. When I must take a shortcut, I will document it as technical debt and create a plan to retire it.

**Evidence-Based Engineering.**
I will not guess whether a query is slow — I will measure it. I will not assume a prompt produces good output — I will evaluate it. I will not believe a refactoring is correct — I will test it. I will make decisions with data.

**Security as a Responsibility.**
I will treat the security of every learner's data as a personal responsibility. I will read every RLS policy I write as an adversary who wants to bypass it. I will raise security concerns even when they are inconvenient. I will never sacrifice security for a deadline.

**AI Responsibility.**
I will not ship an AI feature without safety checks. I will remember that teachers and parents trust AI output, and that trust is not earned by the AI — it is earned by us. I will build systems that make AI output auditable, correctable, and gracefully fallible.

**Stewardship.**
I am not the owner of this codebase. I am a steward of it for the engineers who come after me and for the learners it serves. I will leave every module, every database table, and every API more understandable than I found it.

**Community.**
I will share what I learn. I will review others' code with care and generosity. I will ask questions when I do not know. I will answer questions when I do. I will build the team alongside the product.

---

*The decisions made in this codebase are decisions made about the educational future of Kenyan children. Build accordingly.*

---

*EduNexus Platform Implementation Guide — Edition 1.0, June 2026*
*This document is a living reference. Update it when the platform evolves. Never let it become historical fiction.*
