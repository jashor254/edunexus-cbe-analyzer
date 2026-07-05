# EduNexus Standards Series

## Volume 5 — Educational AI Standards

### Responsible AI for Educational Intelligence Systems

**Edition 1.0 — June 2026**

---

> *AI in education is not a feature. It is a responsibility. Every output may affect how a teacher teaches, how a student is assessed, and how a parent understands their child. The engineering standards must reflect that weight.*

---

## Preface

Artificial intelligence is transforming educational software. AI generates lesson plans, produces assessment items, writes report comments, predicts learner risk, and recommends interventions. These capabilities are genuinely valuable — they can reduce teacher administrative burden, improve the timeliness of support for struggling learners, and personalize education at a scale that was previously impossible.

But AI in educational contexts carries risks that do not exist in general-purpose applications:

**Hallucination risks.** An AI that invents a curriculum learning outcome that does not exist, or describes a historical event incorrectly, or provides a mathematically wrong explanation, is not merely producing bad content. It is corrupting the educational experience of real children.

**Bias risks.** An AI trained on data that underrepresents certain populations will produce content and predictions that disadvantage those populations. In education, this may manifest as risk scores that are systematically higher for learners from specific demographics, or career recommendations that reflect historical inequalities rather than individual potential.

**Authority risks.** Teachers and parents may trust AI-generated content more than they should, particularly when it is presented confidently and formatted professionally. Systems must design against over-reliance on AI output.

**Privacy risks.** AI systems that are trained on learner data must handle that data with the most stringent protections. Using learner data to train AI models without appropriate consent is a serious ethical violation.

This volume defines standards for responsible AI in educational software. These standards apply to any organization building AI capabilities for educational contexts.

---

## Standard 1 — Prompt Architecture

### 1.1 The Curriculum-Grounded Prompt

All AI prompts for curriculum-related generation must include verified curriculum content as grounding context. The grounding content must be:

- Retrieved from an authoritative curriculum source (not inferred or paraphrased)
- Specific to the curriculum level, grade, subject, strand, and sub-strand specified in the request
- Verbatim where precision matters (learning outcomes, performance indicators)

**Required structure for curriculum-grounded prompts:**

```
[SYSTEM CONTEXT]
You are an educational content generator for [CURRICULUM_SYSTEM] [GRADE] [SUBJECT].
You must only reference curriculum elements listed in the CURRICULUM CONTEXT below.
Do not invent, paraphrase, or extrapolate curriculum elements.

[CURRICULUM CONTEXT]
Sub-Strand: [TITLE]
Learning Outcomes:
1. [VERBATIM_LO_1]
2. [VERBATIM_LO_2]

Performance Indicators:
Meeting Expectation: [VERBATIM_PI_ME]
Exceeding Expectation: [VERBATIM_PI_EE]
Approaching Expectation: [VERBATIM_PI_AE]
Below Expectation: [VERBATIM_PI_BE]

[PEDAGOGICAL CONSTRAINTS]
[Context-appropriate pedagogical guidance]

[LEARNER CONTEXT — if available]
Class performance profile: [SUMMARY]

[TASK]
[Specific generation task]
```

**Prohibited prompt patterns:**

- "Generate a lesson plan for Grade 8 Mathematics" (no curriculum grounding)
- "Cover the key concepts in algebra" (vague, invites hallucination)
- "Write learning objectives" (not anchored to actual curriculum outcomes)

### 1.2 The Negative Constraint

Every curriculum-grounded prompt must include explicit negative constraints:

```
CRITICAL CONSTRAINTS:
- Reference ONLY the learning outcomes listed in CURRICULUM CONTEXT above.
- Do not reference learning outcomes from other sub-strands unless explicitly listed.
- If you are unsure whether a concept is in this sub-strand, state that uncertainty explicitly.
- Do not invent performance indicators. Use only those provided.
```

### 1.3 Context Isolation

Different generation tasks require different amounts of context. Do not include irrelevant context:

| Task | Required context | Not required |
|---|---|---|
| Lesson plan | Curriculum LOs, class profile, prior lesson | Individual learner data |
| Report comment | Learner assessment records, teacher observations | Other learners' data |
| Risk explanation | Individual learner model | Class-level aggregates |
| Career guidance | Learner competency profile, career requirements | Other learners' profiles |

Context overloading reduces output quality and increases cost. Context isolation also serves privacy: only include learner data that is necessary for the specific generation task.

### 1.4 Persona Calibration

Prompts must calibrate the AI's persona to the target audience:

```
AUDIENCE: This content is for a primary school teacher preparing a lesson for 13-year-old learners in Kenya.
LANGUAGE: Clear, professional, but not academic. Use examples from a Kenyan context.
TONE: Supportive and practical.
```

Different personas for different audiences:
- **Teacher-facing:** Professional, pedagogically rigorous, practical
- **Parent-facing:** Plain language, supportive, focused on actions
- **Student-facing:** Age-appropriate, encouraging, clear
- **Administrator-facing:** Data-oriented, action-focused, concise

---

## Standard 2 — Grounding

### 2.1 Grounding Definition

Grounding is the practice of anchoring AI generation in verified factual content. Grounded AI responses make claims that can be traced to specific source material. Ungrounded AI responses may be fluent and confident but lack verifiable accuracy.

### 2.2 Curriculum Grounding Requirements

| Content Type | Grounding Requirement |
|---|---|
| Learning outcomes | Must be verbatim from authoritative curriculum source |
| Performance indicators | Must be verbatim from authoritative curriculum source |
| Subject content (facts) | Must be verifiable against standard educational references |
| Examples and scenarios | Must be culturally appropriate; must not contradict facts |
| Assessments | Must address the stated learning outcomes |
| Rubrics | Must align to the CBC performance level framework |

### 2.3 Grounding Verification

After generation, the platform must verify:

1. **Reference check.** Every curriculum reference in the generated content exists in the curriculum knowledge base.
2. **Accuracy check.** Factual claims in scientific, historical, or mathematical content are validated against reference sources.
3. **Alignment check.** Generated content addresses the stated learning outcomes (AI-evaluated, with confidence score).

Content that fails reference check must be rejected. Content that fails accuracy check must be flagged. Content that scores below alignment threshold should be flagged for teacher review.

### 2.4 Retrieval-Augmented Generation

For complex knowledge domains, grounding is enhanced through Retrieval-Augmented Generation (RAG):

1. Parse the generation request to identify required knowledge
2. Retrieve relevant curriculum nodes from the curriculum knowledge base
3. Retrieve relevant pedagogical guidance from the pedagogical knowledge base
4. Retrieve relevant Kenyan contextual examples from the context knowledge base
5. Include retrieved content in the AI prompt as grounding material
6. Generate response using the retrieved content as primary reference

RAG reduces hallucination by giving the AI model accurate source material to reference rather than relying on its training data, which may be inaccurate for specific curricula.

---

## Standard 3 — Evaluation

### 3.1 Evaluation Dimensions

Every AI-generated educational output must be evaluated on four dimensions before delivery:

**Accuracy.** Factual claims are correct. Curriculum references are valid.

**Alignment.** The content addresses the specified learning outcomes.

**Appropriateness.** The content is suitable for the specified age group, cultural context, and pedagogical purpose.

**Quality.** The content is well-structured, grammatically correct, and pedagogically effective.

### 3.2 Automated Evaluation

Automated evaluation should run on every generated output:

```json
{
  "evaluation_pipeline": [
    {
      "check": "curriculum_reference_validity",
      "method": "curriculum_engine_lookup",
      "threshold": 1.0,
      "failure_action": "reject"
    },
    {
      "check": "factual_accuracy",
      "method": "knowledge_base_verification",
      "threshold": 0.95,
      "failure_action": "flag"
    },
    {
      "check": "learning_outcome_alignment",
      "method": "ai_evaluator",
      "threshold": 0.75,
      "failure_action": "flag"
    },
    {
      "check": "age_appropriateness",
      "method": "readability_analysis",
      "threshold": null,
      "failure_action": "warn"
    }
  ]
}
```

### 3.3 Human Evaluation

Automated evaluation cannot catch all quality issues. Human evaluation must supplement automated evaluation:

**Sampling-based review.** A random sample of AI-generated outputs (minimum 1% in production, 100% in testing) is reviewed by curriculum experts or experienced teachers.

**Feedback-triggered review.** When a teacher or administrator reports an issue with AI-generated content, a human review is triggered for that specific output and for similar outputs generated in the same period.

**Periodic audit.** Monthly audit of AI generation quality across all content types. Findings feed into prompt engineering improvements.

### 3.4 Evaluation Metrics

Track these metrics for ongoing AI quality monitoring:

| Metric | Definition | Target |
|---|---|---|
| Curriculum accuracy rate | % of outputs with zero curriculum reference errors | >99.5% |
| Factual error rate | % of outputs with identified factual errors | <0.5% |
| Alignment score (avg) | Average learning outcome alignment score | >0.80 |
| Teacher acceptance rate | % of AI drafts approved without major edits | >70% |
| Teacher edit distance | Average edit distance from draft to approved | <25% |
| User-reported errors | Issues reported per 1000 generations | <2 |

---

## Standard 4 — Hallucination Prevention

### 4.1 Definition

An AI hallucination in educational context is any confident claim that:
- References a curriculum element that does not exist
- States a fact that is demonstrably false
- Describes a process, formula, or rule incorrectly
- Invents a person, event, or institution

Hallucinations in educational software are more serious than in general applications because they may directly corrupt a child's learning.

### 4.2 Prevention Mechanisms

**Mechanism 1: Closed-world generation.** For curriculum-specific generation, instruct the AI to operate in a closed world: only reference elements explicitly provided in the prompt. Never generalize or extrapolate to elements not provided.

**Mechanism 2: Confidence calibration.** When the AI is uncertain about a fact, it should express uncertainty. Prompts should instruct: "If you are not certain whether a fact is correct, say 'This may need verification' rather than stating it as established fact."

**Mechanism 3: Post-generation verification.** All curriculum references are verified against the curriculum knowledge base after generation. Unverified references are flagged or removed.

**Mechanism 4: Mathematical verification.** For mathematics content, a separate verification pass uses a symbolic mathematics engine to check that equations, calculations, and algorithms in the generated content are correct.

**Mechanism 5: Diversity of evidence.** Do not rely on a single AI model for critical educational content. Spot-check a sample of outputs against a second model or against human review.

### 4.3 Hallucination Response Protocol

When a hallucination is detected in production:

1. **Immediate.** Remove the affected content from teacher display. Replace with a message: "This content is being reviewed and will be available shortly."
2. **Within 1 hour.** Investigate the root cause: was it a prompt failure, a model failure, or a verification failure?
3. **Within 24 hours.** Generate a replacement using the corrected prompt or pipeline.
4. **Within 1 week.** Review all similar outputs from the same time period for the same type of error.
5. **Root cause remediation.** Update the prompt, verification logic, or evaluation threshold to prevent recurrence.

---

## Standard 5 — Educational Correctness

### 5.1 Definition

Educational correctness extends beyond factual accuracy. Content that is factually correct may still be educationally incorrect if it:

- Uses pedagogical approaches inappropriate for the learner's developmental level
- Assesses a different competency than intended
- Uses assessment language inconsistent with the curriculum's assessment framework
- Reinforces misconceptions common at the learner's development stage without addressing them
- Creates cognitive overload through inappropriate complexity

### 5.2 Pedagogical Suitability Evaluation

AI-generated educational content must be evaluated for pedagogical suitability:

**Bloom's level appropriateness.** If the learning outcome is at Apply level, assessment items must be at Apply level or above. Items that only test Remember are insufficient.

**Scaffolding appropriateness.** Complex tasks must be appropriately scaffolded for the learner's level. A task that requires multiple prerequisite skills without scaffolding is pedagogically inappropriate even if the final answer is correct.

**Example appropriateness.** Examples must be from the learner's experience or accessible context. An example using financial instruments unfamiliar to 13-year-old Kenyan learners is pedagogically inappropriate even if mathematically correct.

**Assessment fairness.** Assessment items must not systematically advantage or disadvantage learners based on factors unrelated to the competency being assessed (language complexity, cultural reference, socioeconomic assumption).

### 5.3 CBC Pedagogical Alignment

AI-generated content for CBC must align to CBC's pedagogical approach:

- **Learner-centered.** Activities center the learner's experience and agency.
- **Activity-based.** Learning is through doing, not just receiving.
- **Inquiry-based.** Learners are encouraged to ask questions and investigate.
- **Collaborative.** Activities include opportunities for peer interaction.
- **Contextual.** Content connects to learners' lived experience.

AI prompts must include these pedagogical principles and AI evaluation must check that generated content reflects them.

---

## Standard 6 — AI Governance

### 6.1 Governance Structure

Every educational platform using AI must establish a governance structure with:

**AI Ethics Committee.** Responsible for defining ethical guidelines, reviewing AI capabilities before deployment, and responding to ethical concerns raised by users.

**AI Quality Owner.** A named individual responsible for ongoing AI quality monitoring, evaluation, and improvement.

**Teacher Advisory Panel.** A group of practicing teachers who review AI outputs periodically and provide qualitative feedback.

**User Reporting Mechanism.** A clear, accessible way for any user (teacher, parent, learner, administrator) to report an AI output they believe is incorrect or inappropriate.

### 6.2 Model Selection Criteria

When selecting AI models for educational use:

| Criterion | Requirement |
|---|---|
| Knowledge cutoff | Must not be more than 12 months old |
| Language performance | Must be verified on the target language(s) |
| Educational benchmark | Must be evaluated against educational quality benchmarks |
| Bias testing | Must be tested for demographic bias in educational outputs |
| Data provenance | Training data must not include confidential educational data from the platform |

### 6.3 Model Version Management

```json
{
  "model_version_policy": {
    "production_model_change_process": [
      "1. Benchmark new model against current model on educational quality metrics",
      "2. Run A/B test with 5% of traffic",
      "3. Evaluate A/B results with teacher panel",
      "4. Gradual rollout if quality >= current model",
      "5. Maintain rollback capability for 30 days post-migration"
    ],
    "emergency_rollback_trigger": "Any metric declining >5% or quality incident affecting >1000 users"
  }
}
```

---

## Standard 7 — Teacher Oversight

### 7.1 Human-in-the-Loop Requirement

**All AI-generated educational content that affects learner assessment must pass through a human review step before being finalized.**

This is not optional. The human review step is a governance requirement, not a UX choice. AI systems that finalize educational content without human review are not compliant with this standard.

### 7.2 Review Interfaces

Human review interfaces must:

- **Show the draft clearly labeled as AI-generated.** Never present AI output as if it were already validated.
- **Show confidence indicators.** Where available, display AI confidence scores for specific claims.
- **Enable easy editing.** The path from reviewing to editing must be frictionless.
- **Require explicit approval.** Publishing AI content must require a positive approval action, not just the absence of rejection.
- **Track what was changed.** Record the diff between AI draft and approved version for quality monitoring.

### 7.3 Teacher Authority

AI is a tool. The teacher is the professional. Systems must not:

- Override teacher judgment with AI judgment
- Penalize teachers for editing or rejecting AI output
- Present AI content as having higher authority than teacher professional judgment
- Remove human review steps for efficiency

### 7.4 Review Fatigue Prevention

If review requirements are too burdensome, teachers will approve AI output without reading it — defeating the purpose of the review. Design review processes to prevent fatigue:

- **Highlight changes.** If the AI-generated plan differs significantly from a prior approved plan, highlight the differences rather than requiring review of the whole document.
- **Batch review.** Allow teachers to review multiple similar items in a structured batch (e.g., report comments for a full class).
- **Calibrated review depth.** Low-confidence AI outputs require more careful review than high-confidence outputs. Signal this to the teacher.

---

## Standard 8 — Human Review Requirements

### 8.1 Review Coverage Requirements

| Content Type | Review Requirement |
|---|---|
| AI lesson plan | Teacher review and approval before any classroom use |
| AI assessment item | Teacher review and approval before delivery to learners |
| AI report comment | Teacher review, edit, and sign-off before publication |
| AI risk explanation | Teacher review before sharing with parent |
| AI career recommendation | Teacher or counsellor review before sharing with learner |
| AI parent communication | Teacher or administrator approval before sending |
| AI learning resource | Teacher approval before adding to class materials |

### 8.2 Non-Review AI Uses

Some AI uses do not require human review because they are advisory rather than determinative:

- AI risk score calculation (teacher sees the score, not the learner — score informs not determines)
- AI curriculum alignment suggestions (highlighted for teacher consideration, not automatically applied)
- AI lesson plan structure suggestions (shown as options, teacher selects)
- AI related resource recommendations (shown as suggestions, teacher decides)

---

## Standard 9 — Bias Evaluation

### 9.1 Bias Definition in Educational AI

Bias in educational AI occurs when AI outputs systematically favour or disadvantage learners based on characteristics unrelated to the competency being assessed:

- **Demographic bias.** AI risk scores that are systematically higher for learners from specific demographic groups (gender, ethnicity, socioeconomic background) due to historical patterns in training data.
- **Content bias.** AI-generated assessment items that reference cultural contexts more familiar to some groups than others.
- **Language bias.** AI systems trained primarily on Standard English that evaluate Kenyan English or code-switching negatively.
- **Expectation bias.** AI systems that predict lower outcomes for learners based on the performance of historical learners from similar backgrounds.

### 9.2 Bias Testing Protocol

All AI models used in production must undergo bias testing before deployment:

**Demographic parity testing.** For risk prediction models: do learners with similar educational trajectories receive similar risk scores regardless of demographic characteristics?

**Content audit.** For generation models: does generated content use examples, names, and scenarios representative of diverse learners?

**Performance differential testing.** Does the AI model perform differently (produce lower quality output, make more errors) for some demographic groups than others?

**Outcome correlation audit.** Do AI career recommendations correlate with career success, or with historical demographic career patterns?

### 9.3 Bias Remediation

When bias is detected:

- Document the bias clearly and specifically
- Determine whether the bias can be remediated through prompt engineering, post-processing, or model retraining
- If remediation is not possible before the feature is needed, restrict the feature to contexts where the bias does not apply
- Never deploy a biased AI feature without explicit governance approval and a remediation timeline

---

## Standard 10 — Safety

### 10.1 Safety Categories

Educational AI must be safe from:

**Harmful content generation.** AI must never generate content that:
- Is violent, sexually explicit, or inappropriate for learners
- Promotes discrimination, hate, or prejudice
- Provides dangerous instructions
- Violates child protection principles

**Psychological harm.** AI-generated feedback must never:
- Shame or demean a learner
- Make categorical statements about a learner's capacity ("You are not a mathematics learner")
- Generate predictions framed as fixed destiny ("Based on your scores, you are unlikely to succeed in STEM")

**Data misuse.** AI systems must not:
- Use learner data for purposes beyond what was disclosed
- Train on identifiable learner data without explicit consent
- Share learner data with AI providers for model training purposes

### 10.2 Content Filters

All AI generation endpoints must have content filters that:

- Block generation of age-inappropriate content
- Flag content that contains discriminatory language
- Prevent generation of content about harmful or dangerous topics
- Detect and block prompt injection attempts

### 10.3 Child Data Protection

Educational AI systems process data about children. All requirements of applicable child data protection law apply:

- Parental consent must be obtained before processing a child's data for AI purposes beyond direct educational benefit
- Data minimization: only the data necessary for the specific AI task should be processed
- Purpose limitation: data collected for educational purposes must not be used for commercial AI training
- Data subject rights: parents and (where age-appropriate) learners have rights to access, correct, and delete their data

---

## Standard 11 — Versioning

### 11.1 AI Model Versioning

AI models change over time. A change in the underlying model may change AI outputs in ways that affect educational content. The platform must:

- Version all AI models in production
- Tag all AI-generated outputs with the model version used to generate them
- Maintain the ability to regenerate content using the same model version used originally
- Notify users when a model change is expected to affect output quality or style

### 11.2 Prompt Versioning

Prompts are code. They must be:

- Version-controlled in the same system as application code
- Tested before deployment
- Rolled back if they cause quality degradation
- Tagged on generated outputs so quality issues can be traced to specific prompt versions

### 11.3 Changelog Requirements

Every change to an AI model, prompt, or evaluation pipeline must be documented in a changelog with:

- Date of change
- Nature of change (model upgrade, prompt improvement, evaluation threshold change)
- Reason for change
- Quality metrics before and after
- Rollback procedure

---

## Standard 12 — Benchmark Datasets

### 12.1 Purpose

Benchmark datasets allow platforms to evaluate AI quality consistently over time and across model changes. Without benchmarks, quality evaluation is subjective and incomparable.

### 12.2 CBC Benchmark Dataset Structure

A CBC AI benchmark dataset must include:

**Lesson plan benchmark set.** 50 lesson plan generation requests covering:
- Each grade level (7–12)
- A variety of subjects
- A variety of strand positions (simple, complex, prerequisite-heavy)
- Expected outputs reviewed and approved by curriculum experts

**Assessment benchmark set.** 100 assessment generation requests covering:
- Each Bloom's level
- A variety of question types
- CBC-specific rubric generation
- Edge cases (cross-strand, project-based, oral assessment)

**Report comment benchmark set.** 50 report comment generation requests covering:
- Various performance levels
- Positive and concerning trajectories
- Different subjects
- Different learner contexts

**Risk explanation benchmark set.** 30 risk explanation requests covering:
- Low, moderate, elevated, and critical risk levels
- Various primary risk factors
- Scenarios requiring sensitive parent communication

### 12.3 Evaluation Protocol

Run the benchmark dataset:
- Before deploying any model or prompt change to production
- Monthly in production (using the same benchmark set)
- After any quality incident

Benchmark results must be stored with date, model version, and prompt version for longitudinal comparison.

---

*EduNexus Standards Series — Volume 5: Educational AI Standards*

*Edition 1.0 — June 2026*
