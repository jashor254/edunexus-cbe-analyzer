# Dependency Security Audit — 2026-09-30

Periodic dependency vulnerability pass. Starting state: **14 vulnerabilities** (1 critical, 6 high, 1 moderate, 6 low). Ending state: **3** (2 high, 1 low) — all either unreachable in our code paths or dev-only, with no viable upstream fix. No production code changed; only `package.json` (one pin) and `package-lock.json`.

## Fixed (11 of 14)

Applied via `npm audit fix` (all within existing semver ranges, so no `package.json` churn except the `next` pin below):

| Package | Severity | Advisory |
|---------|----------|----------|
| **next** | **critical** | GHSA-p293-qw3h-jr36 (Windows RCE) + GHSA-2xp9-vwfh-vxw4 (AVIF Image Optimization RCE). Fixed at 16.3.3. |
| sharp | high | GHSA-rgj7-g3m4-5g8c (libheif) |
| fast-uri | high | SSRF / host-confusion (5 CVEs) |
| js-yaml | high | GHSA-5p4m-2wfm-xmqj, GHSA-2883-xcg3-v3hh (CPU DoS) |
| nanoid | high | GHSA-2v37-7h3g-55p8 (infinite loop) |
| @ai-sdk/provider-utils (+ ai, deepseek, gateway, react) | — | GHSA-866g-f22w-33x8 (resource consumption) |
| @humanfs/node | moderate | GHSA-p498-v437-472g |

### Next.js: pinned to 16.3.3, not latest (16.3.7)
`npm audit fix` bumps `next` to 16.3.7, but **16.3.7 breaks the production build** — `next/font/google` fails to resolve `@vercel/turbopack-next/internal/font/google/font` (30 Turbopack errors). Verified: 16.3.0 (baseline) builds, 16.3.7 fails, **16.3.3 builds and is the first version outside the vuln range (`16.0.0–16.3.2`)**. So `next` is pinned **exactly** to `16.3.3` to satisfy the advisory without inheriting the 16.3.7 regression.
**Revisit:** when a >16.3.3 release fixes the Turbopack Google-font resolution, relax the pin back to a caret range.

## Not fixed — accepted (3 of 14)

| Package | Severity | Why not fixed |
|---------|----------|---------------|
| **image-size** (via `pptxgenjs`) | high (x2) | GHSA-5p2g-fcmc-qvqq, GHSA-w3rx-r6r6-pgpr — DoS via infinite loops in JXL/HEIF/ICNS **image parsers**. **Not reachable:** `lib/slides/pptxBuilder.ts` builds slides from shapes/text/solid colors only — no `addImage`, no image files — so `image-size` is never invoked. No upstream fix: `pptxgenjs@4.0.1` is the latest release and pins `image-size@^1.2.1`; `npm audit fix --force` would *downgrade* pptxgenjs to 4.0.0 (no benefit) and an override to `image-size@2.x` is a major-version jump across pptxgenjs's declared range (risk, zero reachable gain). |
| **esbuild** (via `tsx`) | low | GHSA-g7r4-m6w7-qqqr — arbitrary file read **only when running the esbuild dev server on Windows**. Dev/test-only dependency (`tsx`), not shipped, Linux/Vercel deploy. |

## Verification
- `npm run build` → ✓ compiled, 275/275 static pages generated.
- `npm run lint` → 2 pre-existing errors in untouched React source (Suspense/`useSearchParams`), unrelated to this pass; do not block the build. Tracked separately.
