# EduNexus Event Catalog

All events use `event_version: '1.0'` unless noted.

## Teacher Events

| Event Type | Resource Type | When Emitted | Description |
|------------|--------------|--------------|-------------|
| `teacher.assessment.created` | `assessment` | After `createAssessment()` succeeds | New assessment created for a class |
| `teacher.assessment.published` | `assessment` | After `publishAssessment()` succeeds | Assessment made visible to learners |
| `teacher.lesson_plan.generated` | `lesson_plan` | After weekly/specific lesson plans are saved | AI-generated lesson plans written to DB |
| `teacher.sow.generated` | `sow` | After scheme of work generation completes | Full SOW saved for a term |
| `teacher.row.submitted` | `row` | After record of work is submitted | Teacher submits weekly ROW |
| `teacher.assignment.created` | `assignment` | After assignment insert succeeds | Assignment created for a class |
| `teacher.assignment.graded` | `assignment` | After a submission is marked | Student submission scored |

## Student Events

| Event Type | Resource Type | When Emitted | Description |
|------------|--------------|--------------|-------------|
| `student.session.completed` | `compass_session` | After `endSession()` with status=completed | Learner finishes a Compass AI session |
| `student.assessment.submitted` | `assessment` | After assessment marks are processed | Student assessment scores processed |
| `student.milestone.achieved` | `mission_completion` | After `upsertMissionCompletion()` | Teacher or student completes an Academy mission |
| `student.knowledge_graph.updated` | `knowledge_graph` | After KG traversal updates mastery | Student's knowledge graph node updated |
| `student.career_recommendation.updated` | `career_profile` | After career engine recomputes matches | Career recommendation rankings changed |
| `student.career_pathway.changed` | `career_profile` | After recommended pathway changes | Pathway recommendation changed |

## Parent Events

| Event Type | Resource Type | When Emitted | Description |
|------------|--------------|--------------|-------------|
| `parent.observation.submitted` | `parent_observation` | After parent logs an observation | Parent records home learning observation |
| `parent.pulse.generated` | `parent_pulse` | After pulse report is generated | Weekly parent intelligence report ready |

## Organization Events

| Event Type | Resource Type | When Emitted | Description |
|------------|--------------|--------------|-------------|
| `organization.created` | `school` | After school registration completes | New school/org onboarded |
| `organization.member.invited` | `school_user` | After `addSchoolUser()` succeeds | Teacher or parent added to a school |
| `organization.member.joined` | `school_user` | After invite is accepted | Member accepted their invitation |
| `organization.member.removed` | `school_user` | After `deactivateSchoolUser()` succeeds | Member deactivated from school |
| `organization.subscription.upgraded` | `subscription` | After plan upgrade | Subscription tier increased |
| `organization.subscription.canceled` | `subscription` | After cancellation | Subscription canceled |

## API Events

| Event Type | Resource Type | When Emitted | Description |
|------------|--------------|--------------|-------------|
| `api.key.created` | `api_key` | After API key creation | Developer API key issued |
| `api.key.revoked` | `api_key` | After API key revocation | Developer API key revoked |
| `api.quota.exceeded` | `api_key` | After quota check fails | API usage quota exceeded |

## Billing Events

| Event Type | Resource Type | When Emitted | Description |
|------------|--------------|--------------|-------------|
| `billing.payment.succeeded` | `payment` | After Paystack verification succeeds | Payment processed successfully |
| `billing.payment.failed` | `payment` | After Paystack verification fails | Payment attempt failed |
| `billing.trial.ending` | `subscription` | From scheduled cron | Trial period ending soon alert |

## System Events

| Event Type | Resource Type | When Emitted | Description |
|------------|--------------|--------------|-------------|
| `system.intelligence.updated` | `learner_intelligence` | After EILS continuous learning cycle | Learner model layers updated |
| `system.research.completed` | `eir_cycle` | After EIR research cycle completes | Intelligence research cycle finished |
| `system.ai_provider.switched` | `ai_config` | After AI provider change | Active AI provider switched |
| `system.job.completed` | `cron_job` | After cron job success | Background job completed |
| `system.job.failed` | `cron_job` | After cron job error | Background job failed |
