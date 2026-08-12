# Production #001 War Room — "Why ¾ Is Bigger Than ⅗"

**Status:** Operational execution plan. Not a new Standard, not a redesign of the architecture, not a review of whether the architecture is sound — that question was already answered (READY WITH MINOR PREPARATION, [Readiness Audit](edunexus-production-001-readiness-audit.md)). This document exists to convert that verdict into work: who does what, in what order, and what proves it's actually done.

**Ground rule for this document:** every task below traces back to a specific finding in the Readiness Audit. Nothing here is invented. Where this document adds detail the Audit didn't have, it's decomposition — the Audit said "no compliant narration exists," this document says what the three tasks to fix that actually are.

---

## 1. Executive Summary

The Readiness Audit found five blockers, all bounded, all owned, none architectural. This document breaks those five into eighteen concrete tasks across four roles, sequences them by real dependency (not by convenience), and identifies that only **six of the eighteen tasks are on the critical path** — the rest have slack and can run in parallel or slightly behind schedule without delaying the production. The single longest pole is the narration decision (Blocker 1), which gates everything downstream of Voice Gate; everything else can be substantially resolved before that decision is even made.

The most important operational finding in this document is Part 7: a short, explicit list of real, currently-live temptations — a new Manim engine feature, a second candidate topic, a multilingual pilot, a new marketing experiment — that must be deliberately not worked on until Production #001 ships, because each one is individually reasonable and collectively fatal to ever shipping a first reference production at all. The Production Playbook already warned about exactly this failure mode in the abstract (Playbook §12, "quality gate fatigue" and scope creep on a "simple" piece); this document names the specific, real versions of that risk for this project.

---

## 2. Confirmed Blockers

Each of the Readiness Audit's five blockers reviewed against current evidence — none have changed since the Audit, confirming the Audit's findings hold rather than assuming they still do.

| # | Blocker (from Readiness Audit) | Status now | Size change |
|---|---|---|---|
| 1 | No House Voice Standard-compliant narration exists | **Confirmed, unchanged.** The 12 incompatible `.mp3` files and their non-compliant script still sit in `edunexus-tiktok/`; nothing has replaced them. | Same size — still the longest pole, no new information shrinks or grows it |
| 2 | No version control on `manim-projects` | **Confirmed, unchanged.** Still not a git repo at any level. | **Smaller than it looked.** This is a five-minute task with zero dependencies — it was correctly flagged as a real risk, but it's the cheapest item on this entire board and should simply be done first, not tracked as a meaningful risk once closed. |
| 3 | No fixed colour-role hex palette | **Confirmed, unchanged.** | Same size — small, bounded, unblocks Visual Gate specifically |
| 4 | Curriculum specificity for the misconception not yet verified against KICD source or a real teacher | **Confirmed, unchanged.** `mathematics.pdf` / `mathematics-parsed.json` still sit unread for this specific purpose. | Same size, but now correctly split into two independent tasks (see Part 3): pulling the KICD text is a solo desk task; a real-teacher sanity check depends on someone else's availability, which was implicit in the Audit but not made operationally explicit until now |
| 5 | Two open story-design questions (Expectation-stage framing; transfer fraction pair) | **Confirmed, unchanged.** | Same size — genuinely can't be answered until Story Design begins, so this isn't a task to schedule now, it's a task to schedule at the right point in sequence (Part 3) |

**No new blockers found.** Per instruction, this section does not invent risk beyond what evidence supports — everything below in Part 5 that reads as "new" is explicitly an *operational* risk that only appears once execution starts, not a blocker that was missed.

---

## 3. Production Task Board

Eighteen tasks, decomposed from the five blockers plus the two mandatory pre-Story-Gate questions. Each has one owner, one output, and is independently checkable.

### Blocker 1 — Narration

| ID | Task | Owner | Output |
|---|---|---|---|
| T1 | Retire the incompatible assets: move `script.txt` and all twelve `voice_v*.mp3` files out of the active `edunexus-tiktok/` working directory into a clearly-labelled `archive/` subfolder, so they cannot be grabbed by accident under time pressure | Pipeline Engineer | Archived, out of the active path |
| T2 | Decide the technology path for this production's narration: record a real human voice actor's read, or synthesize via a chosen TTS engine, for this one production specifically (not the final permanent-voice decision — see Readiness Audit §5's framing) | Voice Director + Executive Producer | One written decision, with reasoning, on record |
| T3 | Produce ~30–45 seconds of narration for the Production #001 script once it exists, read/synthesized against the House Voice Standard's casting brief (§12) | Voice Director | One audio file |
| T4 | Run the Voice Checklist (House Voice Standard §9's registers, Playbook §6's eight items) against T3's output | Voice Director + one independent reviewer | Pass/fail record, item by item |

### Blocker 2 — Version control

| ID | Task | Owner | Output |
|---|---|---|---|
| T5 | `git init` on `manim-projects`, first commit of current state, `.gitignore` for `.venv`/`__pycache__`/rendered `media/` output | Pipeline Engineer | A real git log with one initial commit |
| T6 | Establish one real backup target (even a simple periodic copy to existing cloud storage) — does not need to be sophisticated, needs to exist | Pipeline Engineer | A working, tested backup, confirmed by actually restoring one file from it |

### Blocker 3 — Colour palette

| ID | Task | Owner | Output |
|---|---|---|---|
| T7 | Fix five concrete hex values against the Visual Language Standard's five roles (confirmed/neutral/uncertain/flagged/hypothetical, §9) | Visual Director | Five hex values, written down, with the role each maps to |
| T8 | Confirm the five values render legibly against the existing Manim scene background and pass Visual Language Standard §9's "colour disappears entirely" test for the hypothetical/greyscale role | Visual Director | A rendered test frame showing all five roles side by side |

### Blocker 4 — Curriculum verification

| ID | Task | Owner | Output |
|---|---|---|---|
| T9 | Pull the Grade 7 fractions/equivalent-fractions strand text directly from `data/kicd-pdfs/mathematics-parsed.json` | Curriculum Specialist | The exact strand language, quoted, on record |
| T10 | Confirm the "larger denominator = larger fraction" misconception framing matches KICD's own strand sequencing (i.e., equivalence is taught at the point this production assumes it is) | Curriculum Specialist | Confirmed match, or a named discrepancy with a proposed fix |
| T11 | Real-teacher sanity check: does this misconception match what a CBC Grade 7 teacher actually sees in their own classroom, or is a different framing more common? | Educational Research Lead (owns getting a real teacher's input, even informally) | A short, written note — confirm, or redirect the misconception framing |

### Blocker 5 / Story Design — the two open questions

| ID | Task | Owner | Output |
|---|---|---|---|
| T12 | Decide the Expectation-stage framing: how the wrong intuition is surfaced as the viewer's own plausible guess (direct address, shown example learner, etc.) | Story Architect / Creative Director | One decided approach, written down |
| T13 | Choose the specific transfer-stage fraction pair, confirmed structurally different from the primary example (per Reference Production §6's requirement) | Story Architect | One specific fraction pair, with a one-line justification for why it's structurally different, not just numerically different |

### Cross-cutting / not previously itemized but implied by the Audit's own Dependency Map

| ID | Task | Owner | Output |
|---|---|---|---|
| T14 | Confirm the excluded-symbol list from Visual Readiness (`funnel`, `sticky_note`, `graduation_cap`, `pencil_scribble`, `paper_fold_corner`, etc.) is written down and shared with whoever storyboards, not just implied | Visual Director | A short written exclusion list |
| T15 | Idea Gate: confirm the one-sentence learning objective and audience question are on record (Story Preparation, Playbook §4) | Executive Producer | Recorded pass |
| T16 | Pattern Gate: confirm primary pattern (P72 Correction) + supporting patterns (P01 Comparison, P44 Evidence) are named with written justification (Playbook §5) | Story Architect | Recorded pass |
| T17 | Story Gate: full ten-stage Lifecycle mapped and confirmed, incorporating T12/T13's decisions | Story Architect + Editorial Standards Council function | Recorded pass |
| T18 | Manual-publish checklist drafted (platform, caption, crop, timing) given no TikTok/YouTube publishing automation exists (Readiness Audit §6) | Executive Producer | A one-page checklist |

No task above is vague — each has a single owner and a single, checkable output, per the mandate.

---

## 4. Dependency Graph

```
T5 (git init) ──────────────────────────┐ [no dependencies — do first]
T6 (backup) ← depends on T5             │
                                          │
T9 (pull KICD text) ─────┐              │
T10 (confirm sequencing) ← T9           │
T11 (real-teacher check) ← T10          │  ── all four feed into ──→ T15 (Idea Gate)
                                          │
T7 (fix hex values) ─────┐              │
T8 (render test frame) ← T7             │
T14 (exclusion list) ────┘              │  ── feed into ──→ Visual Gate (later)
                                          │
T15 (Idea Gate) ──→ T16 (Pattern Gate) ──→ T12 (Expectation framing)
                                              T13 (transfer pair)
                                                    │
                                                    ↓
                                          T17 (Story Gate)
                                                    │
                          ┌─────────────────────────┴─────────────────────┐
                          ↓                                               ↓
              T1 (archive old voice) ──→ T2 (narration decision)          Visual Planning
                                              ──→ T3 (produce narration)   (uses T7/T8/T14
                                                  ──→ T4 (Voice Gate)       outputs)
                          └─────────────────────────┬─────────────────────┘
                                                     ↓
                                            [Learning Gate — uses T11's finding]
                                                     ↓
                                            [Accessibility Gate]
                                                     ↓
                                            [Rendering / Muxing — existing tools]
                                                     ↓
                                            [Editorial Council sign-off]
                                                     ↓
                                    T18 (manual-publish checklist) ready by now
                                                     ↓
                                              [Publication]
```

**Which tasks unlock others:** T5 unlocks T6 (nothing else — this is a true isolated pair, do it immediately and stop thinking about it). T9 unlocks T10 unlocks T11 — a strict chain, cannot be reordered. T15/T16 must both be recorded before T17 can start, but T15 and T16 themselves can be prepared in parallel with T9–T11 and T7–T8, since none of those depend on each other. T17 (Story Gate) is the single point where nearly everything converges — it cannot start until T12 and T13 are decided, and T12/T13 in turn benefit from T9–T11's findings (a confirmed real misconception framing directly informs how the Expectation stage should be written), so in practice T17 should not begin until the curriculum-verification chain is done, even though nothing formally forces that order.

**Which run simultaneously:** the git/backup pair (T5–T6), the curriculum-verification chain (T9–T11), and the colour/exclusion-list pair (T7–T8, T14) have zero dependencies on each other and should all run in parallel, starting on day one, by three different people if three are available.

**Critical-path items:** see Part 5.

**Tasks with slack:** T6 (backup) can lag T5 by a day or two without consequence. T8 (rendered test frame) can lag T7 slightly. T18 (manual-publish checklist) has the most slack of anything on the board — it isn't needed until the very last step and takes minutes to write.

---

## 5. Critical Path

The tasks that, if delayed, directly delay the ship date — everything else has slack.

1. **T9 → T10 → T11** (curriculum verification chain) — feeds directly into both T15/Idea Gate confidence and the eventual Learning Gate; if T11 (real-teacher check) is slow because a teacher isn't available, this becomes the actual bottleneck, not the narration decision people will instinctively worry about first.
2. **T15 → T16 → T12/T13 → T17** (Idea Gate through Story Gate) — cannot be compressed; each gate genuinely requires the previous one's output.
3. **T1 → T2 → T3 → T4** (narration chain) — the longest *individual* chain on the board, and the one the Readiness Audit already flagged as the hardest real blocker; T2 specifically (the technology-path decision) is the single highest-leverage decision on this entire board, because it determines whether T3 takes hours (synthesis) or days (a scheduled human recording session).
4. **Voice Gate + Visual Gate → Learning Gate → Accessibility Gate → rendering → Council sign-off → publication** — the back half of the pipeline is mechanically fast once everything feeding into it is ready (existing `mux.py`/`qa_check.py` tooling is already working per the Readiness Audit's Technical Readiness findings), so the critical path is almost entirely front-loaded into gate-readiness, not rendering time.

**The single highest-leverage task on the entire board is T2** — deciding the narration technology path. Everything else can be substantially advanced in parallel while T2 is being decided, but nothing in the narration chain can start until it is, and the narration chain is the longest one.

---

## 6. Definition of Done

No task is complete because someone says it is — each requires evidence, a review method, and a named approver.

| Task cluster | Evidence of completion | Review method | Approval owner |
|---|---|---|---|
| T1 (archive old assets) | Files physically moved, confirmed by directory listing | Visual/spot check | Pipeline Engineer (self-verifiable, low risk) |
| T2 (narration tech decision) | Written decision with reasoning | Read by Executive Producer | Executive Producer |
| T3 (produce narration) | One audio file exists | Playback by Voice Director | Voice Director |
| T4 (Voice Gate) | Checklist filled out item by item, pass/fail per item | Independent second listen (not the person who produced T3) | Editorial Standards Council function |
| T5/T6 (git + backup) | `git log` shows commits; a file was actually restored from backup as a test | Direct verification, not assumption | Pipeline Engineer |
| T7/T8 (colour palette) | Five hex values recorded; rendered test frame exists showing all five | Visual inspection against Visual Language Standard §9's role definitions | Visual Director |
| T9–T11 (curriculum chain) | Quoted strand text on record; match/discrepancy noted; teacher note on record | Read-through by Educational Research Lead | Curriculum Specialist |
| T12/T13 (story questions) | Written decisions | Read by Story Architect + one other reviewer | Editorial Standards Council function |
| T14 (exclusion list) | Written list, shared | Confirmed received by whoever storyboards | Visual Director |
| T15–T17 (gates) | Recorded pass, per Playbook's own gate discipline (Playbook §10) | Per Playbook's own review method for each gate | Editorial Standards Council function |
| T18 (publish checklist) | One-page document exists | Read-through | Executive Producer |

**The one rule that applies across every row:** the person who produced a task's output is never also its sole approver, except where explicitly noted as self-verifiable and low-risk (T1, T5/T6) — everything touching Voice, Visual, Story, or Curriculum content gets a second, independent look before being marked done, directly enforcing the Playbook's own standing rule that gates are not self-certified.

---

## 7. Risk Review

**What has changed since the Readiness Audit:** nothing about the five original blockers — all confirmed unchanged in Part 2. What's new is *operational* risk, visible only once execution actually starts.

**What remains:** all five original risks from the Readiness Audit's Section 8 stand, unchanged, and are addressed by the tasks in Part 3 above.

**New operational risks that appear once execution begins:**

| Risk | Why it only appears now | Mitigation |
|---|---|---|
| T2's narration-technology decision gets made informally, without being written down, and then re-litigated later by someone who wasn't in the room | Real teams under momentum skip "just write it down" steps precisely when they feel unnecessary | T2's Definition of Done explicitly requires a *written* decision, not just a verbal one — enforce this literally |
| The curriculum-verification chain (T9–T11) stalls waiting on real-teacher availability, and the team proceeds to Story Gate anyway "to keep momentum" | This is the most realistic way Blocker 4 quietly becomes unaddressed rather than formally resolved | T17 (Story Gate)'s Definition of Done should explicitly require T11's note on record, not just T9/T10 — make the dependency structurally enforced, not just documented |
| Whoever ends up producing T3 (the narration) is also, informally, the person reviewing it at T4, because no second reviewer is readily available on a small team | A real, near-certain risk on a small-team production, distinct from the general principle stated in Part 6 | Name a specific second reviewer for T4 now, before it's needed, even if it's someone wearing an unrelated hat elsewhere on this board — better a slightly odd reviewer than no independent review at all |
| Momentum bias: once T5–T8 and T9–T11 are done in parallel and feel like "real progress," there's a pull to start Visual Planning before Story Gate (T17) has actually passed, because the visual work feels ready to begin | This is a sequencing risk specific to having so much genuinely parallelizable prep work — it creates an illusion that the whole board is further along than the critical path (Part 5) actually is | Keep the critical path (Part 5) visibly separate from the parallel-track tasks in whatever the team actually uses to track this — the temptation to start Visual Planning early is real and should be named, not just assumed away |

---

## 8. The First Production Sprint

Sequence only, not dates or hours — the highest-leverage order of work.

1. **Immediately, in parallel, no dependencies:** T5 (git init), T9 (pull KICD text), T7 (fix hex values), T2 (decide narration tech path). These four require no prior step and should all start on day one.
2. **Immediately following:** T6 (backup, follows T5), T10 (follows T9), T8 (follows T7), T1 (archive old voice assets — trivial, do alongside T2's decision so the workspace is clean the moment T2 resolves).
3. **As soon as T2 resolves:** begin T3 (produce narration) — this is now the longest remaining chain, so it should start the moment the technology decision lands, even if T9–T11 and T7/T8 aren't finished yet.
4. **In parallel with T3:** T11 (real-teacher check, follows T10), T14 (exclusion list — trivial, can happen any time before Visual Planning), T15 and T16 (Idea Gate, Pattern Gate — these can genuinely be prepared and passed now, since they don't depend on the narration chain at all).
5. **Once T15/T16 pass and T9–T11 are complete:** T12 and T13 (the two open story questions) — informed directly by the confirmed curriculum framing, not decided in a vacuum.
6. **Once T12/T13 are decided:** T17 (Story Gate) — the true midpoint of the whole board; everything before this is preparation, everything after is execution against a settled story.
7. **Once T17 passes and T3 (narration) is ready:** T4 (Voice Gate) and Visual Planning (using T7/T8/T14's outputs) run in parallel.
8. **Once Voice Gate and Visual Gate both pass:** Learning Gate (folding in T11's finding), then Accessibility Gate.
9. **Once all four content gates pass:** rendering and muxing using the already-working `mux.py`/`qa_check.py` tooling — this step is fast, per the Readiness Audit's Technical Readiness findings, and is not where time should be budgeted.
10. **Editorial Standards Council sign-off**, then **T18 (manual-publish checklist)** — prepared in the background any time before this point, executed here.
11. **Publication** — manual, per the Readiness Audit's finding that no TikTok/YouTube automation exists yet.

**The highest-leverage single move in this sprint:** resolving T2 as early as possible, since it's the pivot point that determines whether the narration chain (the sprint's longest pole) takes hours or days.

---

## 9. Deferred Work — No Distractions

Specific, real, currently-live temptations that must wait until Production #001 ships — named concretely, not as a generic warning, per the mandate.

- **A new or improved Manim animation feature.** The Pipeline Engineer or Animation Director noticing a way to make `edunexus_engine.py` more capable while working inside it for T7/T8/T14 is a real, likely temptation — and improving the engine mid-production is exactly how a bounded first reference piece quietly becomes an open-ended engineering project. *Why it waits:* Production #001's entire purpose (per the Reference Production design review) is to prove the existing architecture and existing tooling work, not to prove a better version of the tooling would work — improving the engine now would invalidate the very test this production exists to run.
- **A second candidate topic** (the Risk-flag parent explainer, or the Blueprint growth narrative, both explicitly named and explicitly deferred in the Reference Production review itself). *Why it waits:* those were deliberately rejected as *first* productions precisely because they're higher-stakes; starting one now, even "just to keep options open," reintroduces the exact risk profile the whole selection process was designed to avoid for a first, unproven production.
- **Kiswahili or multilingual narration exploration.** The Studio Inauguration review flagged this as a real, open architectural question — genuinely worth pursuing, but not now, and not by folding it into Production #001's already-critical narration chain (T1–T4), which is this sprint's longest pole already. *Why it waits:* adding a second language to the single hardest, highest-leverage task on the board is how a five-day narration task becomes a three-week one.
- **A new marketing or growth experiment riding on Production #001's release** (a coordinated campaign, a paid boost, cross-posting to a new platform). *Why it waits:* per the Readiness Audit, publication is manual and unautomated for this production specifically — layering a marketing push onto a manual, first-time publish process multiplies the surface area for the exact kind of human error already named as a risk in Part 5, for a piece whose actual purpose is internal proof, not audience growth.
- **Any new foundational Standard document** (a sixth architecture document, an amendment to an existing one, a new checklist). *Why it waits:* the entire point of this War Room, and the Studio Inauguration review before it, is that the studio now proves itself through real production, not more documents — any new document proposed before Production #001 ships should be treated with active suspicion, not enthusiasm, regardless of how reasonable it sounds in the moment.

---

## 10. Ship Criteria

The minimum conditions required — deliberately not a perfection bar, per the mandate.

Production #001 may ship when, and only when:

1. All eight Playbook gates (T15–T17 explicitly, plus T4/Visual/Learning/Accessibility, plus Council sign-off) have a recorded pass, each with a named reviewer distinct from the task's producer (per Part 6's rule).
2. T11's real-teacher finding is on record — either confirming the misconception framing or redirecting it — and, if redirected, the redirected framing has itself passed Story Gate.
3. The narration passes Voice Gate's forbidden-register check specifically (House Voice Standard §10) — this is non-negotiable given it's the exact failure mode the incompatible prior assets already demonstrated.
4. The rendered output passes the existing mechanical `qa_check.py` checks (stream validity, resolution, duration range, no silent gaps).
5. `manim-projects` has real version control with the finished production committed.

**What does NOT need to be true to ship — explicitly, to guard against perfectionism:**

- The colour palette (T7) does not need to be the studio's final, forever palette — it needs to be internally consistent for this production and recorded, per Part 6's evidence standard; refining it further is legitimate future work, not a shipping blocker.
- The excluded visual symbols (T14) do not need to be formally admitted or formally rejected from the permanent Visual Dictionary — exclusion from *this* production is sufficient; that broader decision is explicitly deferred, per the Readiness Audit's own recommendation.
- The narration does not need to be declared the studio's permanent House Voice — per the Readiness Audit's framing (§5), it needs to pass Voice Gate for this production; whether it becomes "the" voice is a decision for after Post-Production Review, informed by real evidence, not a precondition to shipping.
- Publishing automation (TikTok/YouTube API integration) does not need to exist — the manual-publish checklist (T18) is sufficient for a first production.

---

## 11. Post-Production Retrospective Plan

Directly following the Production Playbook's own Post-Publication Review structure (Playbook §10), applied concretely to this specific production.

**Evidence to collect immediately:**
- The comprehension check described in the Reference Production review (§5, §7) — a real, small sample of Grade 7 learners tested on a new fraction pair, both immediately and after a delay.
- Teacher and (light-touch) parent feedback, per Playbook §10's standard categories.
- A literal timestamped record of how long the narration chain (T1–T4) actually took versus this document's sequencing assumption — the single most useful process metric for calibrating Production #002's planning.

**What should be reviewed in the first retrospective:**
- Whether the eight-gate structure caught real problems or mostly produced redundant sign-offs (the open question the Studio Inauguration review specifically flagged as needing real evidence, now available for the first time).
- Whether T2's technology decision, in hindsight, was the right one — informing whether a second production should default to the same choice or explicitly re-evaluate.
- Whether the Editorial Standards Council function, exercised for the first time across T4, T17, and final sign-off, needs a more defined process before Production #002, or whether informal practice held up fine at this scale.
- Every risk named in Part 5 and Part 7 — which materialized, which didn't, and what that says about which risks deserve this level of attention next time versus which were overcautious.

**What belongs in the first retrospective specifically, as opposed to ongoing tracking:**
- A go/no-go recommendation on whether the T3 narration becomes a candidate for the permanent House Voice, or whether a dedicated casting process (House Voice Standard §12–13) is still needed before that decision.
- A recommendation on which of the two previously-deferred higher-stakes topics (Risk-flag explainer, Blueprint growth narrative) should become Production #002, informed by what actually went well or poorly here.

**What should inform Production #002 directly, per the Playbook's own routing discipline (Playbook §13):** any misconception discovered in real learner responses updates the Pattern Library's Correction pattern (P72) entry; any narration-pacing finding updates House Voice Standard training notes, not the Standard's core numbers unless the finding is strong and repeated; any gate found redundant at this team's actual scale informs a proposed, evidence-based Playbook amendment — proposed to the Editorial Standards Council, not enacted unilaterally.

---

## 12. Final Commander's Brief

Five blockers, eighteen tasks, six of them on the critical path, one of them — the narration technology decision — worth more than all the others combined because it's the pivot the longest chain on the board waits on. Everything else has slack, can run in parallel starting today, and does not need to wait on anyone.

The job now is not creative and it is not architectural. It is sequencing and follow-through: close the small stuff in parallel (version control, colour palette, curriculum text, exclusion list) while the one real decision (T2) gets made, then move through the gates in the order the Story Lifecycle actually requires, not the order that feels most finished first. Nothing on this board requires inventing anything new. Everything on it requires someone specific doing a specific thing, and someone else — never the same person — checking that they did.

Ship when the five conditions in Part 10 are true. Not before, and not held back waiting for more than that. Production #002 gets chosen after this one's retrospective, informed by real evidence this production is about to generate — not before.

The studio stops planning here. It starts building.
