# EduNexus — Claude Code Standards

## Project Overview

EduNexus is a Kenya CBC/CBE AI education platform for teachers, parents, and students.

- **Stack:** Next.js 16, TypeScript, Supabase, Tailwind CSS, DeepSeek AI, Paystack
- **Target users:** CBC/8-4-4/IGCSE teachers (Grade 7–12), parents, and students in Kenya
- **Current phase:** 50 pioneer beta teachers
- **Curriculum:** CBC Junior (Grade 7–9), CBC Senior (Grade 10–12), 8-4-4 (Form 3–4)

---

## Architecture Rules

- ALL database calls go through `lib/` functions only
- Components are UI only — zero business logic
- API routes are thin — call `lib/` functions only, no inline business logic
- Server-side DB: always use `createServiceClient()` from `utils/supabase/service.ts`
- Client-side DB: always use `createClient()` from `utils/supabase/client.ts`
- NEVER import `createClient` from `@supabase/supabase-js` directly in route files

---

## Folder Structure

```
lib/sow/          → scheme of work logic
lib/lessonPlan/   → lesson plan logic
lib/row/          → record of work logic
lib/payments/     → Paystack + token logic
lib/ai/           → all DeepSeek AI calls
lib/curriculum/   → KICD curriculum data
app/api/          → thin route handlers only
components/       → UI components only
utils/supabase/   → Supabase client factories (server, service, client)
```

---

## Naming Conventions

| Thing | Convention | Example |
|-------|-----------|---------|
| Files | kebab-case | `my-component.tsx` |
| React components | PascalCase | `StudentCard` |
| Functions | camelCase | `generateClassCode` |
| DB columns | snake_case | `teacher_id` |
| Types / Interfaces | PascalCase | `SOWContext` |
| Constants | UPPER_SNAKE_CASE | `TOKEN_COSTS` |
| API routes | `/api/[resource]/[action]/route.ts` | `/api/sow/generate/route.ts` |

---

## TypeScript Rules

- No `any` types — ever
- All `lib/` functions must have explicit return types
- All API routes must type the request body and response
- Use Zod for validation on all API route inputs
- Prefer `type` over `interface` unless extending

---

## Database Rules

- Every table must have: `id` (uuid), `created_at` (timestamptz), `updated_at` (timestamptz DEFAULT now())
- NEVER use `select('*')` — always name the columns you need
- NEVER query inside a loop — batch with `.in()` or join with a related select
- All tables must have RLS enabled with explicit policies
- Required indexes on any table they appear: `teacher_id`, `student_id`, `sow_id`, `week_number`
- Every FK column must have an index

---

## Security Rules

- Every API route must call `auth.getUser()` first and return 401 if no user
- NEVER trust `userId` from a request body — always verify against `auth.getUser()`
- If `user.id !== requestedUserId` → return 403
- The service role client bypasses RLS — use it only for cron jobs and webhooks
- NEVER expose the service role key to client components
- Webhook endpoints must verify the provider signature before processing

---

## AI / DeepSeek Rules

- All AI calls go through `lib/ai/` only — no direct SDK calls in routes or components
- Always set `max_tokens` explicitly
- Always handle AI errors gracefully with a user-facing fallback
- Log token usage for cost monitoring
- Never send more context than needed — cost awareness is critical

---

## Token / Payments Rules

- `TOKEN_COSTS` lives in ONE place: `lib/payments/config.ts`
- Always read balances from `token_balances` table (not the legacy `user_tokens` table)
- Deduct tokens only after a successful AI response, never before
- Always verify auth before any token operation
- Payment webhook handlers must be idempotent (check for existing transaction before processing)

---

## Error Handling

- `lib/` functions: `throw new Error('descriptive message')`
- API routes: return `{ error: string }` with the correct HTTP status code
- Client components: always show user-friendly error UI — never a blank screen
- NEVER swallow errors silently
- NEVER use `console.log` in production — use structured logging

---

## Before Building Any New Feature

Follow this order and get approval at each step before writing any code:

1. What DB tables/columns does this need?
2. What existing `lib/` functions can be reused?
3. What new `lib/` functions are needed?
4. What API routes are needed?
5. What components are needed?

---

## Commit Message Format

```
feat: short description 🎯
fix: short description 🔧
refactor: short description ♻️
docs: short description 📋
perf: short description ⚡
security: short description 🔒
```

---

## What NOT To Do

- No direct Supabase calls in components
- No business logic in API routes
- No hardcoded costs, limits, or config values — use `lib/payments/config.ts` or `lib/config/`
- No `select('*')` queries
- No queries inside `.map()` or loops
- No `userId` trusted from request body — always verify with `auth.getUser()`
- No test or debug routes in production (`/api/test-*`)
- No `any` TypeScript types
- No silent error swallowing
- No duplicate constant definitions across files
