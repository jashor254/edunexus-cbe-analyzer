# Node.js 22.23.5 upgrade procedure (PROPOSED — nothing here has been executed)

Gate G1 (Mission 002) authorised **22.23.5 as the proposed target** and forbids changing any Node version yet.
This is a plan for founder approval. Every step that changes state is marked **[CHANGE]** and needs its own go-ahead.

## 1. Verified release facts (read from nodejs.org on 2026-11-13)

Sources: <https://nodejs.org/en/blog/release/v22.23.5>, <https://nodejs.org/en/blog/vulnerability/november-2026-security-releases>, <https://nodejs.org/download/release/v22.23.5/SHASUMS256.txt>

| Fact | Value |
|---|---|
| Version / line | 22.23.5 "Jod", LTS |
| Date | 2026-11-11 |
| Type | Security release (highest severity fixed in 22.x: HIGH) |
| Breaking changes / deprecations | None stated on either page |
| Dependency bumps in 22.x | llhttp 9.4.4, sqlite 3.54.1. **undici is NOT updated on 22.x** (24.x/26.x only). OpenSSL not mentioned. |
| linux-x64 tarball sha256 (.tar.xz) | `cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8` |
| linux-x64 tarball sha256 (.tar.gz) | `c54118104acc524633b5abe106bbf44a53126ec8b4e5fa105cb92b5d7de8a1a1` |
| Checksum signing | The raw SHASUMS256.txt is unsigned plaintext; the PGP-signed copy is embedded in the release blog page. |
| 22.x end-of-life date | **Not stated on the official pages read.** Do not assume one; check https://github.com/nodejs/Release before planning beyond this patch. |

CVEs the advisory says affect 22.x (11): HIGH 123864 (HTTPS zero-length TLS write, heap read), 123865 (HTTP/2 shutdown leak), 123866 (HTTP/2 teardown frees memory to peer), 123872 (TLS 1.2 renegotiation SNI change bypasses client-cert auth); MEDIUM 123867 (CA-only SNI context, mTLS bypass), 123871 (proxy credentials in error text), 123877 (https.Agent session reuse across CA policies), 123875 (HTTP/2 NULL deref on cancelled respondWithFile); LOW 123829, 123862, 106071 (permission model / zlib).
Not affecting 22.x per the advisory: 123863, 123874, 123828, 123868, 126051 (HTTP/2 and deferred-TLS, 24.x/26.x only).
Source inconsistency: the 22.23.5 notes list CVE-2026-123873 (low, permission heap snapshot) which is absent from the advisory table, and the advisory's 126051 is absent from the 22.23.5 notes. Neither changes the decision.

## 2. EduNexus compatibility assessment (static, evidence-based)

| Risk | Assessment | Evidence |
|---|---|---|
| Direct use of `http2`/`tls`/`https.createServer` | None found in app code | Repo grep; hits were `createServerClient` name matches |
| Custom proxy (`HTTPS_PROXY`, ProxyAgent) | None in app code | Repo grep |
| `https.Agent` custom `ca` options (CVE-2026-123877 changes cache keying) | None found in app code; third-party SDKs use the default agent | Repo grep. Confirm in preview smoke test. |
| Error-text assertions on proxy errors | None expected | Low |
| Native deps | `sharp` 0.35.5 (needs Node >=20.9), `esbuild` 0.27.4 (>=18): compatible | package-lock engines |
| Next.js | 16.4.3 requires Node >=20.9: compatible | node_modules/next/package.json |
| Already exercised line | `.nvmrc` and CI already run 22.x; this is a patch bump inside a tested line | .nvmrc, ci.yml |
| Hosting runtime | **UNVERIFIED** — Vercel setting unreadable (see Blocker) | G0 |

Overall: low compatibility risk. The change is a patch within the line CI already uses.

## 3. Blocker recorded under G0

Vercel project settings could not be read. `mcp__claude_ai_Vercel__list_projects` and `get_project` (project `edunexus-cbe-analyzer`) returned **403 forbidden: "Trying to access resource under scope dennis-projects-22a9213c. You must re-authenticate to this scope"**. The remedy offered by the connector is its `authorize_team_access` action, which changes connector permissions and was therefore not taken, per the G0 instruction. A local Vercel CLI exists on this machine with its own login; it was not used because G0 said to stop on a connector block. Founder options: (a) approve use of the local CLI read-only (`vercel project inspect`), (b) authorise the connector scope yourself, or (c) paste Settings → Node.js Version.

## 4. Procedure

### Phase 0 — Pre-flight (read-only)
1. Record the Vercel Node setting and the Node version printed in the latest production build log (build logs state it). Save as the "before" value.
2. Record the current green baseline: `npm ci && npx tsc --noEmit && npm run lint && npm test && npx next build` on the **current** runtime, so a later failure can be attributed.
3. Confirm no deployment hold is being lifted by this change (WhatsApp WIP, privacy holds, preview-isolation plan stay as they are).

### Phase 1 — Local dev **[CHANGE]**
```
nvm install 22.23.5            # nvm verifies the download against SHASUMS256.txt
node --version                 # expect v22.23.5
sha256sum ~/.nvm/.cache/bin/node-v22.23.5-linux-x64/*.tar.xz   # compare with table above, if cached
nvm alias default 22.23.5
```
Optional: verify the PGP-signed SHASUMS block from the release page against Node release keys.

### Phase 2 — Branch changes **[CHANGE]**, on a throwaway branch, never main
| File | Change | Why |
|---|---|---|
| `.nvmrc` | `22` → `22.23.5` | Exact local pin |
| `.github/workflows/ci.yml` (`NODE_VERSION`) | `'22'` → `'22.23.5'` | One shared value; auditable floor |
| `.github/workflows/security.yml` (2 places) | `'22'` → `'22.23.5'` | Same; currently a separate literal that can drift |
| `package.json` `engines.node` | `>=20.9.0` → decide | `>=22.23.5` states the floor but **verify on a preview how Vercel interprets a `>=` range** before merging; `22.x` is the conservative alternative |
| `package.json` `@types/node` | `^20.19.37` → `^22` | Types match runtime. This touches the lockfile, so run the full test gate. Can be a separate commit. |

Note: `setup-node` with an exact patch fails if the version is not yet in the runner toolcache and cannot be downloaded; CI will show this immediately.

### Phase 3 — Test gate (on the branch, new runtime)
1. `rm -rf node_modules .next && npm ci`
2. `npx tsc --noEmit`
3. `npm run lint`
4. `npm test` (never bare `tsx --test`; the script carries the module-mocks flag)
5. `npx next build` (tsc alone misses static-render errors)
6. CI Architecture checks, including the route-auth gate
7. `npm run test:deep` if 1–6 pass
8. Preview deployment smoke test (test-mode keys only, synthetic accounts): login, `/api/learn`, one AI-calling route, Paystack webhook signature path, WhatsApp webhook, `/shared/[token]`, one outbound call each to Supabase and DeepSeek
9. `jashor-breaker` passive scan: `node-runtime` findings for pinning must clear

### Phase 4 — Hosting **[CHANGE]**
1. Set the Vercel project Node.js version to **22.x** on a **preview/branch**, redeploy, read the build log's reported version, and confirm it is >= 22.23.5. Vercel selects the patch itself; if the log shows < 22.23.5, wait for the platform rollout and record the date.
2. Only after Phase 3 passes and you approve: promote through your normal main-branch discipline. Not part of this mission.

### Phase 5 — Rollback
- CI/dev: revert the commit; `nvm use <previous>`.
- Vercel: set the setting back to the recorded "before" value and redeploy, or use the dashboard's instant rollback to the previous deployment.
- Triggers: any Phase 3 failure not present in the Phase 0 baseline, a preview 5xx rate above baseline, or a failed webhook signature check.

### Phase 6 — Close-out
Re-run the passive scan; record the result in `docs/engineering/implementation-log.md` (project convention) after approval; remove the end-of-life Node 20 installs from the dev machine **[CHANGE]**.

## 5. Not recommended / out of scope
- Jumping to 24.22.3 or 26.x in the same change (separate decision).
- Auto-upgrade tooling (Renovate/Dependabot for Node) until separately approved.
