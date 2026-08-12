# Production #001 Readiness Audit — "Why ¾ Is Bigger Than ⅗"

**Status:** Point-in-time readiness audit, not a Standard. Every finding below is checked against real, inspectable evidence — files on disk, installed tooling, actual API configuration — not assumed infrastructure. Where the six governing documents assumed something exists (a rendering pipeline, a publishing pipeline, a visual vocabulary), this audit verified whether it actually does, and in what state.

**Method note:** this audit inspected `/home/the-dev/manim-projects/edunexus-tiktok` and `/home/the-dev/manim-projects/edunexus-social` — the actual working production folders referenced in prior project memory — rather than treating "the Production Pipeline exists" as a given. This materially changed several conclusions below; several things assumed absent turned out to be real and working, and at least one thing assumed real (a defined House Voice) turned out to have prior art that actively conflicts with the Standard just written.

---

## 1. Executive Summary

Production #001 is closer to buildable than a cold reading of the six governing documents would suggest — there is a real, functioning Manim pipeline (v0.20.1, installed and working), a real muxing script, a real mechanical QA checker, and a partially-built visual asset library that independently converged on some of the same primitives the Visual Language Standard formalized (`bridge()`, `bucket()`, `house()`, `magnifier()` all already exist as functions). The technical floor is not the blocker.

The blocker is narrower and specific: **there is no compliant narration source.** Twelve voice `.mp3` files exist from a prior TikTok project, but their companion script (`script.txt`) is written in exactly the register the House Voice Standard forbids — rhetorical "what if I told you," dramatic ellipses, motivational-guru closing lines — and there is no record anywhere in the codebase of which TTS engine produced them, making them neither reusable nor reproducible. This confirms, with hard evidence, the assessment given before this audit began: the identity is defined, the source voice is not.

Two further findings raise the audit's confidence from "mostly ready" to "ready with named exceptions": the entire `manim-projects` tree has **no version control at all** — a real, immediate risk independent of Production #001 specifically — and the existing visual asset library contains several symbols (`funnel`, `sticky_note`, `graduation_cap`, `pencil_scribble`, `paper_fold_corner`) that were never run through the Visual Dictionary's admission process (Visual Language Standard §16, §11) and must be before Production #001 can use or safely ignore them.

**Verdict, stated in full in Section 12: READY WITH MINOR PREPARATION.**

---

## 2. Educational Readiness

**Learning objective:** stated cleanly in the Reference Production design review — a learner who has watched the piece can correctly compare a new, unseen fraction pair and explain why, not just recall this specific pair. This objective is well-formed and does not need revision.

**Curriculum accuracy:** the raw KICD Mathematics curriculum source exists in the repo (`data/kicd-pdfs/mathematics.pdf`, `mathematics-parsed.json`), which is real, checkable evidence the platform already has authoritative source material available. **Not yet done:** nobody has pulled the specific Grade 7 fractions strand from that source and confirmed the equivalent-fractions framing used in the Reference Production review matches KICD's actual strand language and sequencing. This is a small, bounded task (reading one section of an already-available document), not a missing capability.

**Known misconceptions:** the "larger denominator means larger fraction" misconception is well-documented in general mathematics-education literature and was used as the Pattern Library's own running example — but no CBC-specific teacher validation exists in this repo confirming it's the misconception Kenyan Grade 7 learners specifically present with most often, as opposed to a different, locally more common one (e.g., confusion in unlike-denominator addition rather than pure comparison). This is a real, if modest, evidence gap — the Reference Production review's own Section 6 flagged "unclear evidence basis for the misconception's prevalence" as a predicted failure mode, and that prediction currently has no counter-evidence on file.

**Expected learner difficulties, transfer objective, teacher usefulness:** all reasoned about thoroughly in the Reference Production review (Sections 3–7) and internally consistent with the Story Engine and Pattern Library. No gap found here beyond the general absence of any real-teacher review pass, which the Playbook's own Learning Gate (Playbook §8) already requires before this specific piece can pass Gate 6 — meaning this isn't a new finding, just confirmation the existing gate is the correct place it gets caught.

**Verdict: substantially ready.** One bounded task outstanding (pull the actual KICD Grade 7 fractions strand text) and one gate already scheduled to catch the rest (Learning Gate's real-teacher check).

---

## 3. Story Readiness

The Reference Production design review already mapped this topic to the complete ten-stage Story Lifecycle in detail (Reference Production §4) — Orientation through Application/Transfer, with the Misconception → Understanding Canonical Structure. That mapping is sound and does not need redoing.

**Missing questions, identified fresh by this audit:**

- **What, specifically, is the Expectation-stage framing?** The design review states a learner "reasoning from whole-number intuition" assumes larger denominator means larger fraction — but doesn't specify *how* that assumption will be surfaced on screen/in narration as the viewer's own plausible guess (a first-person framing? a shown example learner's guess? direct address?). This is a real open question that must be resolved before scripting, not during it, per the Playbook's Story Gate (Playbook §9's requirement that the full Lifecycle be mapped before Gate 3 passes).
- **What is the actual second, transfer-testing fraction pair?** The Reference Production review correctly flags (§6) that the transfer example must be "structurally different" from the primary example, but no candidate pair has been chosen or checked against that requirement yet.

**Story risks:** the single largest, already-named risk (Reference Production §6) is metaphor creep — reaching for a "pizza slices" cliché the Visual Language Standard's own mapping table says isn't needed for a Comparison-category piece. This audit finds this risk *elevated*, not merely theoretical: the existing `edunexus_assets.py` library already contains a general-purpose illustrative style (whimsical, hand-drawn doodle figures — `learner_figure`, `teacher_figure`, `sticky_note`, `pencil_scribble`) built for a different, more metaphor-heavy prior production style, which will be the path of least resistance for whoever scripts this next, unless explicitly redirected.

**Unsupported assumptions:** none found beyond what Section 2 already names (misconception prevalence).

**Verdict: ready, with two specific open questions to resolve at Gate 3, not before.**

---

## 4. Visual Readiness

This is where the audit found the most consequential new information.

**Existing reusable primitives (real, in `edunexus_assets.py`, 397 lines):** `bridge()`, `bucket()` + `water_fill()`, `house()`, `magnifier()`, `book()`/`notebook()`. These map directly and by name onto Visual Language Standard §4/§16 primitives — meaning a working Manim implementation of several canonical primitives already exists and does not need to be built from nothing. This is a genuine, previously-unrecognized asset.

**Symbols requiring admission review before use (present in the code, not yet in the Visual Dictionary):** `learner_figure`, `teacher_figure`, `speech_bubble`, `milestone_flag`, `patch`, `funnel`, `graduation_cap`, `sticky_note`, `pencil_scribble`, `math_doodle`, `crack_line`, `paper_fold_corner`. None of these currently have a fixed, single meaning defined anywhere in the Visual Language Standard. Per that Standard's own rule (§16: "any new symbol proposed for future use must clear the same bar... one meaning, testable"), these cannot be used in Production #001 without either (a) a quick admission pass confirming a clean single meaning and adding them to the canonical dictionary, or (b) being deliberately excluded from this specific production. Given Production #001's Comparison-heavy, Correction-heavy content, most of these (funnel, graduation cap, sticky note) are unlikely to be needed at all — the practical resolution is exclusion, not admission, for this piece specifically, deferring the admission question to whichever future production actually needs them.

**Typography — a genuine gap in the Standard itself, not just the production:** the existing engine hardcodes `FONT = "Caveat"` (a handwritten-style typeface, confirmed installed system-wide at `~/.fonts/Caveat-*.ttf`). The Visual Language Standard, on review, never specifies a canonical typeface — it covers on-screen text *timing and rhythm* (§10) but not typography itself. This means Caveat is currently prior art, not a ratified Standard choice. For Production #001 specifically this is low-risk (Caveat is a reasonable, already-working, warm/handwritten choice broadly consistent with the Standard's overall restraint-over-polish stance) — but it should be named explicitly as an implicit decision being made by this production, not silently inherited from old code.

**Anything still undefined:** exact colour hex values for the role-based colour system (Visual Language Standard §9 defines *roles* — confirmed/neutral/uncertain/flagged/hypothetical — deliberately, explicitly leaving exact hex values to "the brand's design system, not this document"). No such design system with concrete hex values was found anywhere in the repo. This must exist, even minimally, before a single frame can be coloured correctly.

**Verdict: ready with minor preparation** — exclude the non-admitted symbols from this production rather than block on admitting them, and produce a minimal five-role colour palette (a half-day task, not a design project) before Visual Gate.

---

## 5. Voice Readiness

**What already exists:** twelve `.mp3` files (`voice_v1_default.mp3` through `voice_v7_final.mp3`, dated June 28), and the script they were recorded against (`script.txt`).

**What blocks narration, with direct evidence:** the existing script reads —

> *"What if I told you... school was never designed to guarantee you a job?"* ... *"It will belong to the people who kept learning."*

This is, point for point, the register the House Voice Standard explicitly forbids: rhetorical hook framing ("what if I told you"), dramatic ellipsis pacing, and a closing line in the motivational-guru register (§10 of that Standard names "motivational guru" directly as forbidden, citing exactly this kind of inspirational-close line as the failure pattern). These twelve files cannot be reused for Production #001, or for anything claiming House Voice compliance, regardless of how they sound acoustically — the problem is the content and delivery register, not the voice quality.

**Provenance is also unverified:** no reference to any TTS engine, API, or model was found anywhere in the `edunexus-tiktok` or `edunexus-social` codebases (searched for ElevenLabs, XTTS, Piper, Coqui, Azure/Google/AWS speech APIs — no matches). These files were most likely produced through a web interface and manually downloaded, meaning there is no reproducible pipeline behind them even setting the register problem aside.

**Should Production #001 proceed with a temporary narrator, or wait for the permanent House Voice?** Neither, cleanly — the honest third option is: **record or synthesize a short, purpose-built narration for this specific production, written and read against the House Voice Standard's actual casting brief (§12) for the first time**, rather than either reusing incompatible prior audio or waiting indefinitely for a fully "permanent" voice to be cast. This is consistent with the Reference Production review's own framing of Production #001 as deliberately low-stakes and safe-to-revise — the narration used here should be understood as the studio's *first real test* of the House Voice Standard against real material, not as the final, permanent voice locked in irreversibly. If it's close, it becomes the reference. If it needs revision, that's exactly the kind of finding the Playbook's Post-Publication Review exists to capture (Playbook §10, §13).

**Verdict: this is the single hardest real blocker.** Everything else in this audit is preparation; this requires an actual decision and either a recording session or a synthesis run before Gate 4 can even be attempted.

---

## 6. Technical Readiness

Audited against real, installed tooling rather than assumption.

| Area | Status | Evidence |
|---|---|---|
| **Rendering** | Working | Manim 0.20.1 installed in project venv; multiple prior renders exist and play correctly (confirmed via `ffprobe` on `ripple_effect_v19.mp4`: 1080×1920, 45.7s, clean video+audio streams) |
| **Animation** | Working, partial vocabulary | `edunexus_engine.py` (771 lines) + `edunexus_assets.py` (397 lines) — a real, non-trivial engine already exists; see Section 4 for what's compliant vs. not yet admitted |
| **Muxing** | Working | `mux.py` exists and is used in the existing pipeline |
| **QA** | Working, but narrower than the Playbook's gates | `qa_check.py` performs real mechanical checks (stream validity, resolution, duration range, silence-gap detection) — genuinely useful, but this is a *file-integrity* check, not the Playbook's editorial Learning/Voice/Visual gates; the two are complementary and neither should be mistaken for the other |
| **Publishing** | Partially working, gap named in its own code | `publisher.py` in `edunexus-social` has live, working Facebook and LinkedIn auto-posting (confirmed API tokens present in `.env`), driven by DeepSeek-generated captions — but its own docstring states explicitly: *"doesn't justify TikTok/YouTube API integration yet"*. Given Production #001's natural home is short-form video, actual publication to the platforms that matter most will be **manual**, not automated, at least for this production. |
| **Asset organisation** | Ad hoc, functional | Flat directory of numbered script files (`doodly_v1.py` through `doodly_v19...py`) with no folder structure separating in-progress from shipped work |
| **Versioning** | **Not present — real risk** | `manim-projects` and both subfolders are confirmed **not git repositories** (`git status` fails with "not a git repository" at every level checked). Hours of rendering work, paid API-generated assets, and the only copies of twelve voice files currently have no version history and no recorded backup mechanism. |
| **Backups** | Unknown/unconfirmed | No backup script, cron job, or cloud-sync configuration found in either project folder during this audit |
| **Render time** | Unmeasured | No logged benchmark found; unknown how long a full Production #001-length render will take on available hardware |
| **Failure recovery** | Untested | No evidence of a documented recovery process if a render or publish step fails partway |

**Verdict: mostly ready, with one genuine blocker-adjacent risk (no version control) that should be fixed before, not after, Production #001 — this is a five-minute `git init` and first commit, and there is no good reason to build the studio's first canonical reference production on top of an unversioned folder.**

---

## 7. Asset Inventory

| Asset | Status | Notes |
|---|---|---|
| Logo | Exists (`components/ui/Logo.tsx`, `public/favicon.svg`) | In-product brand asset; not yet confirmed as the version to use in a video closing card, but exists |
| Icons | Not specifically audited for video use | Product uses standard icon libraries; no video-specific icon set found |
| Fonts | Exists (Caveat, installed) | See Section 4 — functional but not yet a ratified Standard choice |
| Sound effects | **Not found** | No SFX library located in either project folder |
| Music | **Not found** | No background music assets located; given the House Voice Standard's calm, unhurried register, this may be a deliberate non-requirement rather than a gap — worth confirming, not assuming |
| Visual primitives | Partially exists | See Section 4 — several canonical primitives already implemented; several non-canonical symbols present and excluded for this production |
| Reference illustrations | Not applicable | No separate illustration asset pipeline found; all visuals are Manim-generated primitives, not imported artwork |
| Pronunciation dictionary | **Does not exist** | Confirmed by direct search — no pronunciation or phoneme reference file exists anywhere in the repo or the manim-projects tree; House Voice Standard §6 assumes one is available for CBC/curriculum terms, but this production only needs "denominator," "equivalent," "numerator," which is a small enough set to handle by direct script annotation rather than requiring a full dictionary before this production can proceed |
| Colour palette (hex values) | **Does not exist** | See Section 4 — a real, small gap that must close before Visual Gate |

---

## 8. Risk Register

Production-specific only, per instruction — no generic risks.

| Risk | Probability | Impact | Detectability | Mitigation | Owner |
|---|---|---|---|---|---|
| Existing incompatible voice assets get reused under time pressure ("it's just a first draft") | Medium | High — directly violates House Voice Standard, undermines the entire reference-production purpose | High (Voice Gate's forbidden-register check would catch it if actually run) | Explicitly retire `script.txt` and the twelve `voice_v*.mp3` files from consideration for this production before scripting begins; do not leave them in a location a rushed contributor could grab | Voice Director / whoever scripts Production #001 |
| Existing whimsical asset library (`sticky_note`, `pencil_scribble`, `graduation_cap`) gets used by default because it's the path of least resistance in the existing engine | Medium-High | Medium — produces a visually inconsistent piece relative to the newly-formalized Visual Language Standard, undermining reference-production credibility | Medium (only caught if Visual Gate reviewer specifically checks symbol-by-symbol against the Dictionary, not just "does this look fine") | Name the excluded symbol list explicitly in the production brief before storyboarding starts, not as an afterthought at Visual Gate | Visual/Animation Director |
| Unversioned production folder loses work (accidental overwrite, disk failure, `.venv` corruption) mid-production | Low-Medium | High — no recovery path currently exists | Low until it happens — silent risk | `git init` + first commit on `manim-projects` before any Production #001 work begins; establish a real backup target (even a simple periodic copy to cloud storage) | Pipeline Engineer |
| Colour role palette improvised ad hoc during animation rather than fixed once, in advance | Medium | Medium — risks inconsistent colour use within this single production, and sets a bad precedent for every future production reusing "whatever #001 happened to use" | Medium (Visual Gate would catch obvious inconsistency, but not necessarily a plausible-but-arbitrary choice) | Fix five concrete hex values against the Visual Language Standard's five roles before storyboarding, treat it as a real, if small, deliverable | Visual Director / Creative Director |
| No TikTok/YouTube publishing automation means manual upload introduces a human error window (wrong caption, wrong crop, wrong platform metadata) at the one step furthest from editorial review | Medium | Low-Medium — recoverable (a video can be corrected/reposted), but avoidable | Low (no automated check exists at this step) | A short, written manual-publish checklist (platform, caption, crop, timing) — a small addition, not a new pipeline | Executive Producer |
| Curriculum specificity unverified — misconception framing may not match actual CBC learner error patterns as closely as assumed | Low-Medium | Medium — would weaken, not invalidate, the piece; Learning Gate's real-teacher check should catch it before publication regardless | Medium (only caught if Learning Gate is actually run with a real teacher, not skipped as "probably fine") | Pull the actual KICD Grade 7 fractions strand text and, if feasible, a quick real-teacher sanity check before Gate 6 | Curriculum Specialist / Educational Research Lead |

---

## 9. Dependency Map

Not dates — dependencies and unlock relationships.

```
[KICD strand pull + misconception validation] ─┐
                                                 ├─→ Idea Gate ─→ Pattern Gate
[Colour role palette fixed]                     │
[Excluded-symbol list confirmed]                │
                                                 ↓
                                          Story Design (Lifecycle mapping,
                                          resolve the two open Story
                                          Readiness questions from §3)
                                                 │
                                                 ↓
                                            Story Gate
                                                 │
                              ┌──────────────────┴──────────────────┐
                              ↓                                     ↓
                     Scripting (parallel with)              Narration decision:
                     Visual Planning (storyboard,                record/synthesize
                     using ONLY admitted primitives)              new House Voice-
                              │                                    compliant audio
                              ↓                                     │
                          Voice Gate  ←───────────────────────────┘
                              │
                          Visual Gate
                              │
                          Learning Gate (real-teacher
                          comprehension check)
                              │
                          Accessibility Gate
                              │
                        Rendering / Muxing
                        (existing mux.py, qa_check.py —
                        no new build required)
                              │
                        Editorial Standards Council
                        sign-off (Gate 8) — first real
                        exercise of this function
                              │
                        Publication (manual — no
                        TikTok/YouTube automation exists)
                              │
                        Post-Publication Review
```

**Can happen in parallel, starting immediately, independent of everything else:** `git init` on `manim-projects` (Section 6); fixing the five-role colour palette (Section 4); confirming the excluded-symbol list (Section 4); pulling the KICD fractions strand text (Section 2). None of these four block each other and none require any prior step in this pipeline — they should start now, in parallel, regardless of when scripting begins.

**Hard sequential dependency, no shortcut available:** the narration decision (record/synthesize new audio) must be resolved before Voice Gate, and Voice Gate must pass before rendering begins — there is no way to render placeholder audio and swap it later without effectively re-running the whole pipeline, since pacing (visual timing) is directly derived from narration timing per the Story Engine's Voice Orchestration (§6 of that document).

---

## 10. Success Criteria

Restated with a concrete "how it's checked" attached to each, tightened from the Reference Production review's Section 5 into checkable form for this specific readiness gate:

- **Process proof, not content proof:** all eight Playbook gates were run for real, each with a named reviewer and a recorded pass/fail — even if some reviewers are the same person wearing different hats at this stage. A production with a perfect final video but no gate records has not actually tested whether the Playbook works.
- **The Voice Gate specifically produced a real finding**, positive or negative, about whether the House Voice Standard's numeric targets (pacing, cadence) held up against an actual recorded read — not just a subjective "sounds fine."
- **At least one concrete, filed finding** lands in the Post-Publication Review that updates a specific Standard document (per Playbook §13's evidence-only amendment rule) — a production that produces zero findings has not been examined closely enough.
- **The excluded-symbol and colour-palette decisions made for this production either get formally admitted to the Visual Dictionary or are explicitly logged as "still open"** — nothing silently becomes precedent without a decision being visible.

**Before the studio allows Production #002:** all of the above must be true, and the version-control gap named in Section 6 must be closed — not because Production #002 requires git history specifically, but because starting a second production on top of an unversioned folder compounds a known, already-identified risk rather than fixing it while the cost of fixing it is still low.

---

## 11. Remaining Blockers

Stated plainly, each with its evidence, ranked by how much it actually stops work:

1. **No House Voice Standard-compliant narration exists or has a defined path to exist.** (Section 5) — hard blocker for Voice Gate and everything downstream of it. Evidence: `script.txt` content directly contradicts House Voice Standard §10; no TTS provenance found in either codebase.
2. **No version control on the production folder.** (Section 6) — not a blocker to *starting* work, but should be closed before meaningful new work accumulates on top of it. Evidence: `git status` fails at every level of `manim-projects`.
3. **No fixed colour-role hex palette.** (Section 4) — small, bounded, blocks Visual Gate specifically, not earlier stages. Evidence: Visual Language Standard §9 explicitly defers hex values to a design system that doesn't exist in the repo.
4. **Curriculum specificity for the chosen misconception is asserted, not yet verified against KICD source or real teacher input.** (Section 2) — does not block starting story/visual work, but must close before Learning Gate. Evidence: KICD math source exists in-repo and hasn't been pulled for this specific strand; no teacher validation record found.
5. **Two open story-design questions** (exact Expectation-stage framing; the specific transfer fraction pair) — must resolve before Story Gate, not before. (Section 3)

None of these require inventing new studio infrastructure. All five are bounded, concrete tasks with a clear owner and a clear point in the Dependency Map (Section 9) where they must close.

---

## 12. Final Go / No-Go Decision

**READY WITH MINOR PREPARATION.**

The architecture (Standards) is sound and does not need revision. The technical pipeline is real, tested, and largely sufficient — this audit found more working infrastructure than the six governing documents assumed, not less. What stands between "now" and a first storyboard is a short, bounded list of concrete tasks, not open architectural questions: retire the incompatible existing voice assets and commission or synthesize new narration against the House Voice Standard's actual casting brief; fix a five-value colour palette; confirm which existing visual symbols are excluded from this production; version-control the production folder; and pull the specific KICD strand text this topic depends on.

None of these five blockers require another planning document. Each has a named owner in Section 8's risk register and a specific position in Section 9's dependency map. Once they close — realistically a matter of days of focused work, not weeks of further design — Production #001 can proceed directly into Story Gate with confidence that the studio's real infrastructure, not just its stated philosophy, is behind it.
