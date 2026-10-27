# Differentiated Assignment Deep Audit

**Scope:** differentiated / adaptive assignments: learner evidence, tier selection, AI variant generation, validation, teacher review, delivery, grading, evidence write-back and adaptation over time.
**Mode:** strict read-only investigation. No application code, prompts, schema, tests or data were changed by this audit.
**Date:** 2026-10-13 · **Revision:** `main` @ `51aea263a3723e5bdf7967dd8fac4213000b573c`

---

## 1. Executive summary

EduNexus **does** generate differentiated assignments, and the engineering underneath is stronger than the content it produces. Delivery, grading against the served answer key, immutable evidence, sticky per-learner binding and the variant lifecycle are carefully built and well tested. The weaknesses sit on either side of that core: what the AI writes, what the teacher can see before approving it, and what the system concludes from the result.

What the code actually does:

- **Tier selection is deterministic.** It comes from the learner's projection (latest confirmed CBC level for the subject or sub-strand), mapped 1:1 to a tier (BE→Foundation, AE→Guided, ME→Supported, EE→Extension). No AI and no teacher input is involved, and digital delivery has no teacher override.
- **Generation is per tier, not per learner.** One AI variant is written per (question, tier) that a real learner in the class occupies. The model sees only the band label and its grain. It never sees the learner's errors, item responses, misconceptions or trend.
- **Validation is structural plus one AI check.** The verifier asks three things: is the key uniquely correct, is it the same concept, is it a single question. **Nothing checks for answer leakage**, and nothing checks mathematics deterministically.

The five most consequential findings:

| ID | Severity | Finding |
|---|---|---|
| F-01 | HIGH | The Foundation prompt structurally invites **answer leakage**, and nothing detects it. In the audited sample, **9 of 15** Foundation items in one class state or paraphrase the answer in the stem. |
| F-02 | HIGH | The teacher review screen shows **only the variant's question text**. It shows no choices, no marked answer and no rationale, and bulk approve is available. 13 of 55 sampled variants changed the choices and 3 changed the answer position, all invisible at approval time. |
| F-03 | HIGH | **Supported and independent performance are indistinguishable** in learner evidence. A 100% on a Foundation-scaffolded quiz becomes the learner's latest confirmed level. Executed check: a learner at Level 1 with one prior observation moves straight to **EE**, not marked provisional, after a single scaffolded success. |
| F-04 | HIGH | **Printable route packs contain no questions.** The print pipeline only wraps the assignment's free-text instructions in fixed template sentences. For a quiz-style adaptive assignment, the paper "Guided" pack has no differentiated content at all. |
| F-05 | MEDIUM | The class-tier lookup silently drops tiers on transient database errors (observed twice in live use on 2026-10-13). A failed learner is treated as "no evidence". |

**Recommendation: READY FOR TARGETED FIXES**, with one carve-out. F-01, F-02, F-04 and F-05 can be fixed inside the current architecture. F-03 is a deliberate, tested design boundary ("provenance only, never read by any projector"), so changing it needs a short architectural decision record before any code.

---

## 2. Audit scope and safety statement

**Inspected:** source under `lib/assignments/`, `lib/adaptiveLearning/`, `lib/quiz/`, `lib/projection/`, `lib/intelligence/`, `lib/ai/educationalContext.ts`, `lib/ai-orchestration/router.ts`, `lib/learnerBlueprint/actionPlan/`, teacher and student API routes under `app/api/teacher/assignments/` and `app/api/student/`, teacher UI pages under `app/teacher/assignments/`, the relevant Supabase migrations, test files, test manifests, and Git history for the relevant files.

**Executed:**

| Command / action | Mutating? | Outcome |
|---|---|---|
| `git branch`, `git rev-parse`, `git status`, `git log`, `git diff --stat`, `git show HEAD:<file>` | No | Recorded in §3 |
| Read-only `SELECT` queries via the Supabase MCP against the existing sample drafts (variant counts, choice/key differences, metadata presence) | No | Used in F-01 / F-02 |
| `tsx --experimental-test-module-mocks --test` on 7 pure test files, with `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9` and dummy keys so any accidental network call would fail rather than reach a database | No | 79 tests, 78 pass, 1 fail (§14) |
| An in-memory scenario script in the session scratchpad (outside the repo) calling the pure function `decideAdaptive()` on synthetic projections, same dummy environment | No | §12 results |

**Not executed:** all `*.integration.test.ts` and `*.http.integration.test.ts` files (they write to a database); `npm test` (it ignores path arguments and runs the whole standard manifest, see F-13); any AI generation; any projection recompute; any route call.

**Modifications by this audit:** only this report file was created. No commits, pushes, package installs or database writes.

**Disclosure about the sample data.** The sample assignments analysed here were created *earlier in the same working session, before this audit began*, by founder-requested scripts in the gitignored `scripts/_tmp/`. They are four draft adaptive assignments (one Social Studies per class for two Grade 7 classes, plus Mathematics and Integrated Science for one class), with 55 AI variants, all still `draft` and never published to learners. Those earlier runs also recomputed projections. None of that activity is part of this audit, but it is the provenance of the evidence in F-01 and F-02. No learner names or identifiers appear in this report.

---

## 3. Repository revision and working-tree status

- Branch: `main`
- HEAD: `51aea26`, 2026-10-13 06:07 +0300, "docs: record schemes-bundle pricing + teacher-tool pricing/RoW decisions"
- Working tree at audit start: **49 modified, 4 deleted, 11 untracked** (64 entries). It was unchanged at audit end apart from this report, and those pre-existing changes were preserved.
- Of the files cited in this report, only `app/teacher/assignments/[assignmentId]/page.tsx` has an uncommitted change: one line, unrelated to the cited logic. The cited publish-warning code is present at HEAD.

---

## 4. Architecture map

```
                         EVIDENCE (immutable, superseding)
 marks / quizzes ──► learner_evidence ──► Projection (academicProjector: "latest confirmed level wins")
                                                │
                                                ▼
                     decideAdaptive()  ── band BE/AE/ME/EE (+ damping, evidence state)
                     lib/adaptiveLearning/recommend.ts
                     ┌──────────────────────────┼──────────────────────────────┐
                     ▼                          ▼                              ▼
     DIGITAL VARIANT PATH             DELIVERY (per learner)          PRINT ROUTE PATH
 resolveTiersForClass (class)   resolveServedVariantsForStudent   suggestRouteForLearner
 generateAdaptiveVariants       (first open, sticky)              BE|AE→guided, ME→core, EE→ext
   AI generate → structure      findApprovedVariant(tier) or null  buildRouteBody = template
   check → AI verify            grade on served key                around `instructions` only
 draft → teacher approve/reject       │                            teacher approve/override
                                      ▼
                     submit-quiz → recordQuizAutoGradeEvidence (one row, total score,
                     payload.adaptive_delivery = served tier; NOT read by any projector)
                                      │
                                      └──► back to Projection (loop closes on *level* only)

 NEXT WORK: no automatic sequencing. Teacher-triggered Blueprint action candidate
 (generateActionCandidate) → teacher approval → createAssignment(isAdaptive if system+sub-strand)
 → teacher still authors questions and triggers generation.
```

There are two separate differentiation implementations: the **digital variant path** and the **print route path**. They share the classifier but **no content** (F-04).

---

## 5. End-to-end execution-flow trace

| # | Stage | Entry point / symbol | Reads | Writes | Validation | Failure behaviour |
|---|---|---|---|---|---|---|
| 1 | Learner identification | `repos.learnerIntelligence.getClassEnrollment` via `variantOrchestration.generateVariantsForAssignmentQuestion` (`lib/assignments/variantOrchestration.ts`) | class roster | none | none | empty class → reported failure |
| 2 | Evidence retrieval | `recomputeLearnerProjection` inside `recommendForClass` (`lib/adaptiveLearning/recommend.ts:599`) | confirmed `learner_evidence` | **projection upsert** (derived) | none | per-learner try/catch → `computeLearnerProjection(id, [])` = "no evidence" (`:626`) — **F-05** |
| 3 | Support level | `decideAdaptive` (`recommend.ts:377`), `rawBand`, `isUncorroboratedReversal` (`:298`) | projection `bySubStrand` → fallback `bySubject` (`:316`) | none | damping on ≥3 obs | `insufficient_data` → no tier |
| 4 | Learning objective | `CurriculumService.resolveSubstrandContext` (`variantGeneration.ts:274`) | `assignments.substrand_id` | none | none — `learningOutcomes[0]` may be absent; falls back to canonical question | |
| 5 | Prompt | `buildGenerationPrompt` (`variantGeneration.ts:97`) | canonical question, curriculum node, tier rule, **band label + grain only** (`:142`) | none | n/a | |
| 6 | Model call | `generateOneTier` → `routedCompletion` (`:232`), `mode:'quality'` → DeepSeek, Gemini fallback (`lib/ai-orchestration/router.ts:11`) | | | | error → tier reported in `failed` |
| 7 | Parsing | `parseJsonResponse` (`:205`) | | | JSON parse | → structural error |
| 8 | Validation | `validateStructure` (`:196`), then AI `buildVerificationPrompt` (`:158`, three checks at `:175`) | | | ≥2 unique choices, key in range; AI: unique key, same concept, single question | rejected tier is not persisted |
| 9 | Storage | `createDraftVariants` (`lib/assignments/variants.ts:79`) | | `assignment_question_variants` status `draft` | lifecycle trigger | |
| 10 | Teacher review | `app/teacher/assignments/[assignmentId]/quiz/page.tsx`; approve/reject/bulk/regenerate routes | variants (full rows) | status transitions | UI shows **question text only** (`:471`) — **F-02** | |
| 11 | Learner presentation | `findServedQuestionsForStudent` (`lib/quiz/quizDelivery.ts:95`) ← `app/api/student/assignments/[id]/questions/route.ts` | live projection at **first open** (`:66`) | `served_variant_map` (sticky, atomic RPC) | correct key stripped | projection error → throws (no isolation) |
| 12 | Response capture | `gradeAndSubmitQuiz` (`lib/quiz/quiz.ts:101`) via `app/api/student/submit-quiz/route.ts:96` | | `assignment_submissions.answers` (per-question choices kept here only) | | |
| 13 | Evaluation | `resolveGradingQuestions` (`quizDelivery.ts:187`) | served variant key, else canonical | `score` | | missing variant → canonical key (`:207`) |
| 14 | Evidence | `recordQuizAutoGradeEvidence` (`lib/quiz/quizEvidence.ts`), inside `after()` (`submit-quiz/route.ts:135`) | | **one** evidence row: total %, `cbcLevel` via `marksToLevelForSchool(percentage)` with **no school config** (`:65`), `payload` = served tier (`:130`) | auto-confirmed (tier 2 → ceiling 95 ≥ 85) | errors logged, not surfaced |
| 15 | Projection | `academicProjector` — `latestLevel = last chronological level` (`lib/projection/academicProjector.ts:69,105`) | all confirmed evidence | projection | **payload never read** | |
| 16 | Next assignment | **No automatic stage.** Teacher-initiated `generateActionCandidate` (`lib/learnerBlueprint/actionPlan/candidateGeneration.ts:86`) → delivered via `createAssignment` with `isAdaptive` (`delivery/assignment.ts:231`) | projection | assignment row | teacher approval | |

Missing connections: there is no stage between 13 and 16 that uses *item-level* responses, the served tier, or misconceptions, and nothing proposes or sequences the next assignment automatically.

---

## 6. Learner-evidence dependency analysis

| Candidate input | Reaches generation? | Influences what? | Evidence |
|---|---|---|---|
| Teacher-marked results (gradebook, exams) | Indirectly | Band → which tiers exist | `resolveTiersForClass` → `recommendForClass` |
| Auto-graded quiz totals | Indirectly | Band (as "latest level") | `quizEvidence.ts`, `academicProjector.ts:69` |
| Raw item responses | **No** | Stored in `assignment_submissions.answers` only | `quiz.ts` update payload; quizEvidence writes the total only |
| Specific errors / misconceptions | **No** | `expected_misconceptions` is *generated* and stored, never consumed | grep: no consumer in `lib/` or `app/` outside the generator and repository |
| Historical performance / trend | Partly | Trend appears in `AdaptiveTask`; **not in the prompt** | `variantGeneration.ts:142` (band + grain only) |
| Previous support received | **No** | `payload.adaptive_delivery.servedTier` is never read | `lib/intelligence/evidence.ts:131-160` doc; `quizDelivery.integration.test.ts:224` asserts it |
| Curriculum competency | Yes | Sub-strand title/outcome in the prompt; sub-strand grain preferred for band | `recommend.ts:316`, `variantGeneration.ts:125-129` |
| Teacher decisions | **No (digital)** / Yes (print) | Print: `overrideLearnerRoute`. Digital: no override | grep: no override in `quizDelivery.ts` |
| AI learner summaries | No | — | redaction in `redactForPrompt` |
| Static defaults | Yes | Tier rules text; default thresholds in quiz evidence | `variantGeneration.ts:121-126`; `quizEvidence.ts:65` |

**Support level mechanism: B + D.** Deterministic rules (`decideAdaptive`) over an existing derived learner profile (Projection). It is not inferred by AI, not chosen by a teacher, and not a fixed default.

**Distinctions the recorded evidence can support:**

| Distinction | Supported? |
|---|---|
| Conceptual misconception vs procedural / arithmetic error | NOT IMPLEMENTED: no item-level evidence, no distractor-to-misconception mapping |
| Reading / vocabulary difficulty | NOT IMPLEMENTED |
| Careless response | NOT IMPLEMENTED |
| Ambiguous question | PARTIAL: only at generation (the verifier rejected one ambiguous item, §10), never at response time |
| Insufficient evidence | IMPLEMENTED: `insufficient_data`, `evidenceState` initial/developing/established, `provisional` |
| Correct after substantial assistance vs independently | NOT IMPLEMENTED in interpretation (served tier recorded but unread). See F-03 |

---

## 7. Differentiation-level analysis

The tier rules live in `buildGenerationPrompt` (`variantGeneration.ts:121-126`):

| Dimension | Specified in code / prompt? | Left to model? |
|---|---|---|
| Reading complexity / vocabulary | Foundation "simpler wording"; Guided "closer to grade-level phrasing" | degree |
| Number of steps | Foundation "smaller reasoning steps" | yes |
| Worked examples | Foundation "worked-example framing **inside the stem**" | content |
| Hints | Guided "small amount of context or hinting"; Supported "reduced (not absent) hints" | yes |
| Cognitive demand / transfer | Extension only: "higher-order reasoning, transfer… real-world application" | yes |
| Independence expected | implicit only | yes |
| Opportunities to explain reasoning | **not possible**: single-answer MCQ only, enforced (`:107`) | — |
| Feedback | `learnerExplanation` generated, **never displayed** | — |
| Support *type* (concept vs procedure vs vocabulary vs transfer) | **NOT IMPLEMENTED**: one rule per tier; the band is the only signal | — |

The generator differentiates by **amount** of support, not **kind**. In the sample, Foundation and Guided mostly differ in how much reasoning text precedes the same question, and Supported is usually the canonical question with a one-line reminder. There is no principled way to pick between a vocabulary scaffold, a procedural worked example and a conceptual analogy, because the evidence that would justify that choice (item-level errors) is not captured.

**Print path:** the tiers are three fixed sentences (`printRouteContent.ts:26-33`). The Guided "worked example" is a generic instruction ("talk through one example with a teacher, parent, or classmate"), not an example.

---

## 8. Assessment-integrity analysis

The prompt asks the generator to preserve the learning outcome ("you transform instruction, never curriculum"). The verifier checks "same underlying concept". **Nothing checks whether the learner still has to perform the assessed reasoning.**

Two prompt rules combine to cause leakage:

1. `variantGeneration.ts:107` requires "Scaffolding (worked steps, guided reasoning) must live **entirely inside the single question's own text**".
2. `:122` requires Foundation to use "worked-example framing inside the stem, **explicit guided reasoning**".

For a multi-step item (computing an angle), explicit guided reasoning still leaves the final step to the learner, and the sample shows it works. For a **recall** item ("angles on a straight line add up to?", "what is a constitution?"), the reasoning *is* the answer, so "explicit guided reasoning" means stating it. Rule 1 forbids moving scaffolding into a separate, ungraded part, so the stem is the only place it can go.

Classification of the 15 Foundation items for one class (taxonomy from the audit brief):

| Subject | Q | Category | Note |
|---|---|---|---|
| Social Studies | 1 | **6** answer option repeats the explanation | stem paraphrases "governed… rights" |
| Social Studies | 2 | **5/6** | worked example says the constitution "protect[s] the people… rights" |
| Social Studies | 3 | **5** trivial | example ends "This leads to abuse of power… This limit protects citizens" |
| Social Studies | 4 | **5** trivial | "If a law… goes against the Constitution, that law cannot be used" |
| Social Studies | 5 | **5** trivial | Step 4: "Because the rule goes against the Constitution, it cannot stand" |
| Mathematics | 1 | **5** trivial | "So the two angles together add up to 180°. Therefore… add up to:" |
| Mathematics | 2 | 4 legitimate scaffold | steps given; learner still computes 180 − 130 |
| Mathematics | 3 | 2 worked example + transfer | example uses 30°/50°; task uses 40°/75° |
| Mathematics | 4 | 2 worked example + transfer | example y/3y; task x/2x |
| Mathematics | 5 | 4 (borderline) | "Step 2: angle COB = 180° − 65°", leaving only arithmetic |
| Science | 1 | 2/3 legitimate | example uses copper; task asks about an iron nail |
| Science | 2 | **5** trivial | "The bulb does not light up for rubber." → "which is a non-conductor?" |
| Science | 3 | **5/6** | "plastic does not let electricity pass" → "because plastic does not conduct" |
| Science | 4 | 3 hint narrows appropriately | still requires knowing a coin is metal |
| Science | 5 | **5** | "needs a material that lets electricity move… easily" → "good conductor" |

**Result: 9 of 15 leak** (Social Studies 5/5, Science 3/5, Mathematics 1/5). Mathematics holds up best because its canonical items mostly require computation; the worked-example-then-transfer pattern (category 2) is exactly what the prompt intends. Leakage concentrates where the **canonical question is recall**. The canonical items in this sample were written ad hoc for a demonstration, which is itself a finding: nothing guides teachers toward canonical items that survive scaffolding.

**Skill substitution (category 7):** one Guided Mathematics variant turned a recall item into a computation ("65° and 70°… what must the third angle be"). That is arguably a better item, but it is a different skill, and the "same concept" check passed it.

---

## 9. Answer-leakage findings

- **Semantic leakage validation: NOT IMPLEMENTED.** `validateStructure` (`:196`) checks JSON shape, choice count, duplicate choices and key range. `buildVerificationPrompt` (`:158-190`) checks key uniqueness, concept match and single-question. Neither mentions whether the stem states or entails the answer.
- **Lexical leakage heuristic: NOT IMPLEMENTED.** For example, there is no check for overlap between the correct choice's content words and the stem.
- **Cause:** an interaction of prompt design (F-01 rules 1+2), canonical item type (recall), and a verifier that is blind to the property. It is not caused by reused examples or templates.
- **Who could catch it today:** only the teacher, from the question text, which the UI does show. But they cannot see the choices or the key (F-02), so the "correct option repeats the stem" pattern (category 6) cannot be seen at review.

---

## 10. Subject-specific correctness findings

| Check | Mathematics | Science | Social Studies |
|---|---|---|---|
| Answer keys | All 10 sampled variants hand-verified correct; x + 2x = 180° ⇒ x = 60° ✓; worked example y + 3y = 180° ⇒ y = 45° ✓; 180 − 30 − 50 = 100 ✓ | All 15 correct | All 30 (two classes) correct |
| How checked | **AI only** (same-family model); **no deterministic arithmetic check** | AI only | AI only |
| Missing figures | 3 Foundation items say "Look at the straight line below" with no figure. Nothing models or checks figures (F-14) | — | — |
| Ambiguity | The verifier **rejected** an ambiguous canonical-derived word problem ("other side" of a ladder's foot vs of the wall). Its reasoning about the *correct* answer was wrong, but its ambiguity signal was useful. Evidence that the AI check gives both false negatives and useful flags | metal coin conducts ✓ (Kenyan coins are plated steel / bimetal) | — |
| Claims needing authoritative review | — | "plastic does not conduct electricity" is a fine Grade 7 generalisation | (a) "any law that goes against the Constitution is invalid": Art. 2(4) says "void **to the extent of the inconsistency**", a simplification to keep but note; (b) "leaders cannot stay in office beyond the term allowed by law": term limits apply to specific offices (e.g. President, Governors), not all leaders, so it is overgeneralised; (c) "every child's right to education without discrimination": maps to Arts. 53 and 27. Needs a Social Studies specialist sign-off, not a legal review |

Every subject-correctness check today is **model-based or teacher-based**. Only key range and choice uniqueness are deterministic.

---

## 11. Evidence-quality and uncertainty analysis

| Dimension | Status | Where |
|---|---|---|
| Answer correctness | IMPLEMENTED (total score only) | `quizEvidence.ts` |
| Assistance provided | PARTIALLY IMPLEMENTED: recorded (`payload.servedTier`), never interpreted | `evidence.ts:164`; `quizDelivery.integration.test.ts:224` |
| Independent performance | NOT IMPLEMENTED as a distinct signal | — |
| Reasoning quality | NOT IMPLEMENTED: MCQ only | `variantGeneration.ts:107` |
| Repeated performance | IMPLEMENTED: history, trend, evidence state, damping | `recommend.ts:298-400` |
| Performance across contexts | NOT IMPLEMENTED: no context or transfer tag on evidence | — |
| Teacher verification | IMPLEMENTED for evidence (review status, trust tiers); quiz results auto-confirm | `confidence.ts:16-44`, `evidence.ts:242` |
| AI-inferred interpretation | IMPLEMENTED as separation: tier-1 sources can never auto-confirm | `confidence.ts:18-21` |
| Unknown / insufficient | IMPLEMENTED: `insufficient_data`, `provisional`, rationale text | `decideAdaptive` |

**Strengths:** one observation is enough to start adapting ("evidence quantity changes confidence and caution, never permission"), and the decision carries `evidenceState` and `provisional`.

**Where claims outrun evidence:**

1. **Latest-observation-wins.** `academicProjector.ts:69,105` sets `latestLevel` to the most recent level regardless of source, size or support. A five-question quiz on one sub-strand overrides a full end-of-term exam as the subject-level "current level". Because recommendation falls back from sub-strand to subject (`recommend.ts:316`), a sub-strand quiz can set the band for *every other* sub-strand in that subject.
2. **Developing state is not provisional.** With two observations, `provisional` is `false` (§12, case A), even when the second observation was scaffolded.
3. **Inconsistent thresholds.** Quiz evidence uses `DEFAULT_MARKS_THRESHOLDS` 75/50/30 (`quizEvidence.ts:65`). Gradebook evidence uses school boundaries (`lib/assessments/evidence.ts:130`; e.g. a pilot school's AE = 25). The same percentage can therefore map to different CBC levels depending on which pipeline recorded it (F-11).

---

## 12. Adaptation-over-time analysis

Executed in memory against `decideAdaptive()` (synthetic projections; the classifier code path is real):

| Case | Subject history (levels) | Band returned | State | Provisional |
|---|---|---|---|---|
| A: one prior exam L1, then 100% on a Foundation quiz | [1, 4] | **EE** | developing | **false** |
| A2: two prior exams L1, then Foundation 100% | [1, 1, 4] | ME (damped) | established | true |
| A3: as A2 plus a second Foundation 100% | [1, 1, 4, 4] | **EE** | established | false |
| C: two L1, then an *independent* L3 | [1, 1, 3] | ME (damped) | established | true |
| D: L3, L3, then one L1 on a poorly worded quiz | [3, 3, 1] | ME (damped) | established | true |
| D2: one prior L3, then one L1 on a poorly worded quiz | [3, 1] | **BE** | developing | false |
| E: L2, L3, L4, L4 | [2, 3, 4, 4] | EE | established | false |

Scenario answers:

- **A (struggles independently, succeeds with a worked example):** the system records one evidence row with a high score, a high CBC level and an unread `servedTier: foundation`. It infers that the learner's current level *is* that high level. It cannot establish that the success depended on support. Next, the learner can jump to Extension (case A) or be damped to ME (A2) depending only on how many observations exist. **A2 and C produce identical decisions**: supported and independent success are indistinguishable.
- **B (recall vs transfer):** NOT IMPLEMENTED. Evidence carries no recall/transfer dimension, and items carry no cognitive-demand tag that is used (`cognitive_intent` is generated free text, never read).
- **C (initial struggle, later independent success):** IMPLEMENTED. The band follows new evidence; damping holds one step for confirmation, and the next corroborating observation releases it (also tested in `recommend.test.ts`). Delivery recomputes the band at each new assignment's first open, so nothing is permanently retained *across* assignments. *Within* one assignment the binding is sticky by design.
- **D (one wrong answer on a poorly worded item):** PARTIAL. Damping protects learners with an established pattern (case D). A learner with fewer than three observations is moved fully on one item (D2). No misconception is ever assigned, which is good: the system never claims one.
- **E (sustained independent success):** IMPLEMENTED. EE leads to an Extension tier, but only when the variant exists; Extension is generated only if an EE learner was present at generation time. A learner reaching EE after generation is served the canonical question (an honest, recorded `null`).

---

## 13. Teacher-control analysis

| Capability | Status | Evidence |
|---|---|---|
| Drafts reviewed before use | IMPLEMENTED: AI variants are `draft`, never auto-approved | `variants.ts:79` |
| Teacher sees a variant's **choices / answer key / rationale** | **NOT IMPLEMENTED** in UI. The API already returns full rows | `quiz/page.tsx:20-26, 471`; `variants/route.ts:20-22` — **F-02** |
| Teacher edits variant text / key | **NOT EXPOSED**. `editVariant` exists and is tested, but no route calls it | `variants.ts:188`; grep |
| Edits preserved / provenance | IMPLEMENTED in lib (`generated_by: teacher_edited`) | `variants.ts:206` |
| Regeneration overwrites drafts | No: archive plus new draft, atomically; old row stays gradable | `regenerate_assignment_question_variant` RPC |
| AI vs teacher-verified content | PARTIAL: `generated_by` and `status` exist, but approval happens without seeing the key | — |
| Teacher override of a learner's tier | Print: IMPLEMENTED (`overrideLearnerRoute`). Digital: **NOT IMPLEMENTED** | `printRoutes.ts:247` |
| Publish gate | UI warning only; the API accepts `active` unconditionally; the warning counts a question as covered if **any** tier is approved | `[id]/route.ts:10,115`; `[assignmentId]/page.tsx:250-255` — **F-06** |
| Early opener bound to canonical forever | By design and tested: a `null` bound before approval stays `null` | `quizDelivery.integration.test.ts:299` |
| Evidence protected from silent modification | IMPLEMENTED: immutable evidence, supersession, DB trigger | CLAUDE.md rule; `persistEvidenceBatch` |
| Canonical question edited after variants exist | **No invalidation**: in-place UPDATE, variants (even approved) keep pointing at the changed canonical | `replace_assignment_questions` (migration `:62-108`) — F-12 |
| Question lock | Locks only after a submission is `submitted`/`marked`, not when a learner has opened and been bound | migration `:40` — F-12 |
| Failures surfaced | Generation failures: shown per question. Evidence emission failures: logged only (`after()`). Tier-lookup failures: **silent** (F-05) | |

---

## 14. Existing test coverage

**Executed (pure, dummy environment):** 79 tests across `recommend.test.ts`, `educationalContext.test.ts`, `quiz.pure.test.ts`, `academicProjector.test.ts`, `engine.test.ts`, `printRoutes.pure.test.ts` and `riskTaskStyleBoundary.architecture.test.ts`. **78 pass, 1 fails:** `recommend.test.ts:138` "buildAdaptiveTask: every task carries observation, evidence…". The test is stale: commit `8ade6e8` changed `task.evidence` to the grain's own history, and the fixture still supplies only top-level `supportingEvidenceIds` with an empty history. It is a test defect, not a product defect.

**Why it went unnoticed:** four of these files (`recommend.test.ts`, `educationalContext.test.ts`, `academicProjector.test.ts`, `printRoutes.pure.test.ts`) are listed in `scripts/excluded-tests.json`. The shared repository module constructs a Supabase client at import time, so they crash without credentials. **Band selection (42 tests) therefore has no automatic coverage in standard CI.**

**Present but not executed (database-backed):** `variantGeneration.integration.test.ts` (7: tier generation, verifier rejection, structural rejection, regeneration, approval uniqueness, teacher edit provenance, router failure); `variants.integration.test.ts`; `quizDelivery.integration.test.ts` (9: sticky binding, concurrency, served text, served-key grading, archived gradability, evidence unchanged, canonical fallback, Stage-6 stickiness); `printRoutes.http.integration.test.ts` (22).

| Area | Coverage |
|---|---|
| Tier selection / damping | Good (unit) — excluded from CI |
| Prompt construction | **None** (no assertion on prompt content) |
| Output parsing / structure | Integration |
| Answer-key validation | Integration (verifier rejection with a fake AI) |
| Mathematical correctness | **None** |
| Semantic answer leakage | **None** |
| Learner-specific differentiation | Integration (tiers from roster) |
| Teacher edits | Integration (lib only; no route exists) |
| Persistence / lifecycle | Integration |
| Evidence creation | Integration |
| Supported vs independent interpretation | Asserted *absent by design* (`:224`) |
| Next-assignment adaptation | Unit (band follows evidence) |
| Review-UI shows key | **None** |

---

## 15. Confirmed defects

| ID | Sev | Evidence (file:line, symbol) | Current → Expected | Impact | Cause | Conf. | Next action |
|---|---|---|---|---|---|---|---|
| **F-01** | HIGH | `variantGeneration.ts:107,122` (`buildGenerationPrompt`); `:158-190` (`buildVerificationPrompt`); sample 9/15 | Foundation stems state the answer, and no check notices → scaffolding should teach a method or narrow a step while leaving the assessed reasoning to the learner, and leakage should be flagged | Foundation scores are inflated and say little about understanding; they then feed F-03 | Prompt rules × recall canonical items × verifier blind spot | High (code + sample); generality = H-1 | P0-2, P1-1 |
| **F-02** | HIGH | `quiz/page.tsx:20-26` (type omits `correct_index`), `:471` (renders only `question_text`); bulk approve `:460`; DB: 13/55 changed choices, 3/55 changed key index | Teacher approves answer keys they cannot see → show choices, marked answer and rationale | An AI-wrong key can be approved and auto-graded into evidence | UI omission; data already present | High | **P0-1 (smallest safe task)** |
| **F-03** | HIGH | `evidence.ts:131-160` (payload "not read by any projector"); `academicProjector.ts:69,105`; `confidence.ts:16-21` + `evidence.ts:242` (quiz auto-confirms); §12 cases A/A2/C | Supported success counts as independent attainment → interpretation should reflect the support condition | Learners can be escalated on scaffolded success, and Blueprint and Career Intelligence read the same projection | Deliberate Stage-1 boundary (tested at `quizDelivery.integration.test.ts:224`) | High | ADR first, then P2-1 |
| **F-04** | HIGH | `printRouteContent.ts:52` (`buildRouteBody` uses `instructions` only); `AssignmentSnapshot` (`assignmentPrintRun.repository.ts:25`) has no questions | A paper pack for an adaptive quiz has no questions → route packs should carry the route's question set (canonical / approved variants) | Paper-first schools (the current pilot) get no real differentiation on paper | The two paths share the classifier, not the content | High | P1-2 |
| **F-05** | MED | `recommend.ts:604` (concurrency 20), `:610-627` (fallback to empty projection); `variantGeneration.ts:363` misleading error; observed 2026-10-13 (two tiers dropped, needed reruns) | A transient DB error looks like "no evidence" → retry or surface; never silently drop a tier | Missing tiers, so learners are served the canonical question; a confusing regenerate error | Fan-out plus error-as-absence | High (observed) | P0-4 |
| **F-06** | MED | `[id]/route.ts:10,115`; `[assignmentId]/page.tsx:250-255`; sticky null `quizDelivery.ts:78` | Publish is not enforced server-side; coverage is counted per question, not per needed tier → warn per missing tier, optionally enforce | Early openers are locked to canonical for that assignment | UI-only guard | High | P0-3 |
| **F-07** | MED | `variants.ts:188` has no route caller; no digital tier override | A teacher's only fixes are approve, reject, or regenerate with the same prompt → expose edit; allow per-learner tier override | Teachers can't fix leakage or key errors quickly | Lib built, UI/route not wired | High | P1-3 |
| **F-08** | MED | `variantGeneration.ts:142` (band + grain only); `quizEvidence.ts` (total only); `expected_misconceptions` unused | Differentiation is by amount only → capture item-level responses and use them to choose support *type* | Same scaffold for very different needs | Evidence granularity | High | P2-2 (research) |
| **F-09** | MED | `academicProjector.ts:69`; `recommend.ts:316` fallback | Latest single observation of any size and grain sets the subject band → weigh by evidence size/type; don't let a sub-strand quiz set other sub-strands' bands | Volatile bands; topic-specific results leak across topics | "Latest wins" projection rule | High (code) | P2-1 (with F-03 ADR) |
| **F-10** | MED | `router.ts:11`; `variantGeneration.ts:232,239` | "Independent" verification is the same model family; mathematics is checked only by AI → add deterministic checks where possible | Correlated errors pass both calls | Design | Medium | P0-2, P3-1 |
| **F-11** | LOW | `quizEvidence.ts:65` vs `lib/assessments/evidence.ts:130` | Quiz evidence ignores school grade boundaries | The same % can map to different levels by pipeline (e.g. 25–29%: AE vs BE) | Same bug class already fixed for gradebook | High | P1-4 |
| **F-12** | LOW | migration `:40` (lock on submitted/marked), `:62-108` (in-place update), `:121` (cascade) | Canonical edits don't invalidate variants; deleting a question between a learner's open and submit cascades their bound variant | Drift; rare mis-grade (see H-3) | Lock signal narrower than binding | Medium | P1-5 |
| **F-13** | LOW | `scripts/excluded-tests.json`; `recommend.test.ts:138`; `scripts/run-standard-tests.mjs` ignores CLI paths (CLAUDE.md says `npm test -- <path>`) | Core classifier tests are not in CI; one is stale; the documented test command doesn't do what it says | Silent regressions | Eager client construction at import | High | P3-2 |
| **F-14** | LOW | 3 sampled Foundation items reference "the straight line below" | References to figures that don't exist → forbid figure references, or support figures | Confusing for learners | No figure model or check | High (sample) | P0-2 (prompt rule) |

---

## 16. Unverified hypotheses

- **H-1:** The 9/15 leakage rate generalises. The sample is small, from one class, and its canonical items were written ad hoc and are recall-heavy. *Test:* a labelled corpus across item types (P3-1).
- **H-2:** Same-family verification misses errors the generator makes. Plausible but not measured.
- **H-3:** Deleting a question while a learner has the quiz open mis-grades their answer. The code path shows grading falls back to the canonical key, while the learner saw the variant's choices (`quizDelivery.ts:203-207`). Not reproduced.
- **H-4:** Foundation scaffolds help BE learners learn. There is no outcome data yet; nothing has been delivered to learners.
- **H-5:** Delivery fails outright for a learner when `recomputeLearnerProjection` throws at first open (no try/catch at `quizDelivery.ts:66`). This follows from the code; route-level behaviour was not exercised.

---

## 17. Strengths worth preserving

- **Immutable evidence with supersession**, and a DB-enforced variant lifecycle (`enforce_variant_lifecycle_transition`).
- **Sticky, atomic served-variant binding** and **grading against the served key**, including archived variants (well tested).
- **Honest fallbacks:** `null` means "canonical was served", recorded, never guessed. `insufficient_data` is never fabricated.
- **Provenance captured at delivery** (`AdaptiveDeliveryPayload`), with a clear fact-vs-claim separation. The data F-03 needs already exists.
- **The damping rule plus evidence states**, with a correct "never more extreme" property (verified: `severityRank` groups L1–L2).
- **Cost discipline:** only the tiers real learners occupy; generation adds only missing tiers.
- **Privacy:** only band and grain reach the model (`redactForPrompt`).
- **No auto-approval**; regeneration preserves history; the question lock exists.
- **The worked-example-then-transfer pattern works** where the canonical item requires computation (Mathematics Q3, Q4).

---

## 18. Prioritised remediation recommendations

Smallest coherent sequence, no rewrite:

**P0: correctness and integrity**
1. **P0-1 Show what is being approved.** Render each variant's choices, marked correct answer, `difficulty_rationale` and `cognitive_intent` in the review card. Presentation only; the API already returns them. Consider disabling bulk approve until each card has been expanded at least once.
2. **P0-2 Leakage and figure check.** Add a fourth verifier check ("does the stem state or directly entail the correct choice?") and a deterministic **warning** heuristic: content-word overlap between the correct choice and the stem above a threshold, plus references to absent figures. Flag for the teacher; don't silently reject. Evaluate on a labelled set first (P3-1).
3. **P0-3 Per-tier publish coverage.** Warn per (question, needed tier). Have the API reject `draft→active` for adaptive assignments without at least one approved variant per needed tier, unless an explicit override flag is sent.
4. **P0-4 Don't confuse an outage with absence.** In `resolveTiersForClass`, retry failed projection lookups, or return a "tiers may be incomplete" signal the UI shows. Lower the default concurrency.

**P1: differentiation quality**
1. **P1-1 Rewrite the Foundation rule.** Demonstrate the method on a *different* example; keep the final assessed step for the learner. For recall-type canonicals, allow vocabulary and context support but forbid stating the target fact. Add authoring guidance that steers teachers away from pure-recall canonical items for adaptive quizzes.
2. **P1-2 Print packs carry questions.** Include the route's question set (canonical for Core, approved variants for Guided/Extension) in `AssignmentSnapshot` / `buildRouteBody`.
3. **P1-3 Wire `editVariant`** to a route and the UI, and add a per-learner digital tier override (mirroring `overrideLearnerRoute`).
4. **P1-4** Make quiz evidence use school boundaries, as the gradebook pipeline does.
5. **P1-5** Lock questions (or invalidate variants) once any learner is bound, not only on submit.

**P2: evidence-informed adaptation** (needs an ADR first)
1. **P2-1 Read the support condition.** Decide how a scaffolded result contributes. Options: cap its level contribution; allow at most one band step upward from scaffolded evidence; or project it as a separate "supported attainment" signal. Address "latest wins" weighting (F-09) at the same time.
2. **P2-2 Item-level evidence.** Persist per-question correctness and the chosen distractor; map distractors to `expected_misconceptions`; later use them to choose support *type*.

**P3: measurement and refinement**
1. **P3-1 Evaluation corpus.** Canonical items × tiers × subjects, human-labelled with the 7-category taxonomy. Track leakage rate, key accuracy and skill-preservation rate per prompt version.
2. **P3-2 Test hygiene.** Make repository client construction lazy so the four excluded pure tests rejoin CI; fix `recommend.test.ts:138`; make the test runner honour path arguments or correct CLAUDE.md.

---

## 19. Recommended acceptance criteria

- **P0-1:** A teacher can see, for every variant card, all choices with the correct one marked, plus the rationale. A UI test asserts `correct_index` is rendered.
- **P0-2:** On the labelled corpus, ≥90% of category-5/6 items are flagged, and ≤10% of category-2/3/4 items are falsely flagged. Every flag is visible to the teacher.
- **P0-3:** The API returns 4xx for publishing an adaptive assignment with an uncovered needed tier (without override). The warning lists the tiers.
- **P0-4:** In a fault-injection test where one learner's projection lookup fails, the generated tier set is unchanged after retry, or the result carries `incomplete: true`.
- **P1-1:** On the corpus, the Foundation leakage rate (categories 5+6) is below 10%, and the skill-preservation rate is at least 95%.
- **P1-2:** A print run for a quiz assignment contains each route's questions; tested.
- **P2-1:** A unit test shows [1, 4-scaffolded] does **not** yield EE unprovisionally, and [1, 4-independent] behaves as today.
- **P3-2:** `recommend.test.ts` runs in standard CI and passes.

---

## 20. Questions that require further research

1. What counts as *legitimate* Foundation support in Kenyan CBC practice? Which of the seven categories do experienced teachers accept for BE learners? (Small teacher panel: 20–30 items.)
2. How much should a scaffolded success move a learner's estimate? (Educational measurement question; drives P2-1.)
3. Are MCQ-only variants enough for differentiation, or does Foundation need short constructed responses (rubrics already exist: `20260905120000_open_response_rubrics.sql`)?
4. Does generating against the *subject-level* band (common at pilot schools, where sub-strand evidence is rare) produce appropriate topic-specific support?
5. Is a second model family worth its cost as the verifier, compared with deterministic checks plus teacher review?

---

## 21. Explicit limitations of the audit

- Database-backed tests were not run, so their pass/fail status is unknown.
- No AI generation was triggered. Leakage and correctness findings rest on 55 existing draft variants from one pilot school's Grade 7 (n = 15 for Foundation in one class), with canonical items written ad hoc.
- Scenario results come from calling the real `decideAdaptive()` on synthetic projections. The full live pipeline (evidence write → projection → delivery) was traced in code, not exercised.
- No learners have received these assignments, so there is no learning-outcome evidence.
- UI behaviour was established from source, not by running the app.
- Social Studies factual claims were checked against general knowledge of the Constitution of Kenya, not an authoritative text.

---

## 22. Final engineering recommendation

### READY FOR TARGETED FIXES

The core (evidence integrity, delivery, grading, provenance) is sound and should be kept. The highest-impact problems are fixable in place. F-03 / F-09 need an ADR before code, because they reverse a deliberate, tested design boundary.

| # | Question | Answer | Confidence / basis |
|---|---|---|---|
| 1 | Does EduNexus generate differentiated assignments? | Yes, digitally: per-tier AI variants, delivered per learner. On paper: route packs, but without question content | High: code + 55 sample variants |
| 2 | Which differences are implemented? | Amount of scaffolding, wording simplicity, worked-example framing, hint level; Extension adds transfer. Not support *type*, reasoning or feedback | High: prompt code + sample |
| 3 | Does learner evidence influence generation? | Only through the band, which decides **which tiers exist and which one a learner is served**. Variant content sees only the band label | High: `variantGeneration.ts:142`, `quizDelivery.ts:66-78` |
| 4 | Is Foundation systematically over-explanatory? | For recall-type canonical items, yes (9/15 leak). For computational items, mostly not | Medium: small sample; mechanism is High |
| 5 | Are answer leakage and validity checked? | Validity partly (AI: same concept, unique key). Leakage: no | High: `:158-196` |
| 6 | Can it distinguish supported from independent performance? | Recorded, not interpreted | High: executed §12 + `evidence.ts:131-160` |
| 7 | Does new evidence influence later assignments? | Yes, at each new assignment's first open, through the band; damping holds single reversals once a pattern is established. No automatic sequencing | High |
| 8 | Strengths to preserve | §17 | High |
| 9 | Three highest-priority fixes | P0-1 show the key at review; P0-2 leakage flagging; P1-2 questions in print packs (pilot is paper-first) | Medium-high: judgement over the findings |
| 10 | Is focused research needed first? | Not for P0. Yes for P1-1 (what counts as legitimate scaffolding) and P2-1 (how supported success should count) | Medium |
| 11 | Smallest safe next task | **P0-1:** render variant choices, marked answer and rationale in the review card. Presentation-only, data already returned, no schema/prompt/evidence change | High |
| 12 | Evidence the fix worked | P0-1: a UI test plus a teacher can spot a wrong key in a seeded variant. P0-2/P1-1: leakage rate on the labelled corpus before vs after (§19 thresholds) | High |
