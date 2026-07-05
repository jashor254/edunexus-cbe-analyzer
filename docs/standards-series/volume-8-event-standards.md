# EduNexus Standards Series

## Volume 8 — Educational Event Standards

### Canonical Event Definitions for Event-Driven Educational Systems

**Edition 1.0 — June 2026**

---

> *An event is not data. An event is a fact — something that happened in the real world that the system must acknowledge. Educational events are facts about learning: a competency demonstrated, a risk identified, a lesson taught, an assessment completed. Treating them as facts, not just messages, changes how we design systems that respond to them.*

---

## Preface

This volume defines the canonical educational event types, their schemas, versioning rules, ordering guarantees, delivery semantics, replay behaviour, and security requirements.

Educational events are the vocabulary of event-driven educational systems. When every system in an educational ecosystem uses the same vocabulary to describe the same facts — when `AssessmentCompleted` means the same thing in the LMS, the assessment platform, the learner intelligence engine, and the parent portal — data flows between systems without translation.

These standards aim to achieve for educational events what UNIX signals, HTTP status codes, and CloudEvents have achieved in their respective domains: a shared vocabulary that makes every implementation more interoperable.

---

## Part 1 — Event Schema Standard

### 1.1 Base Event Schema

All educational events conform to this base schema:

```json
{
  "$schema": "https://eduis.org/schemas/v1/event.json",
  "id": "string (UUIDv4 — globally unique)",
  "type": "string (namespaced event type: e.g., assessment.session.completed)",
  "specversion": "1.0",
  "source": "string (URI identifying the producer: e.g., urn:eduis:system:assessment-engine)",
  "subject": "string (the primary entity affected: e.g., urn:eduis:learner:ke:school-xyz:abc123)",
  "time": "datetime (ISO 8601, UTC, when the fact occurred — not when the event was emitted)",
  "datacontenttype": "application/json",
  "dataschema": "string (URI to the event-specific schema)",
  "tenantid": "string (the tenant context for this event)",
  "correlationid": "string | null (links related events in a workflow)",
  "sequenceid": "string | null (for ordered event streams)",
  "data": {
    "...event-specific payload..."
  }
}
```

This schema is based on the CloudEvents specification (v1.0) with educational-domain extensions (`tenantid`, `correlationid`, `sequenceid`).

### 1.2 Event Naming Convention

Event types follow a hierarchical dot-notation:

```
{domain}.{entity}.{action}
{domain}.{entity}.{sub_entity}.{action}
```

Examples:
- `assessment.session.completed`
- `learner.risk_score.elevated`
- `teacher.lesson_plan.approved`

Rules:
- All lowercase
- Words separated by underscores
- Hierarchical: broader domain first, specific action last
- Past tense: events describe facts that have occurred

### 1.3 Idempotency Keys

Every event includes an idempotency key embedded in the `id` field. Consumers that process an event with an `id` they have already processed must:
- Return a success response to the delivery system (to prevent redelivery)
- Not reprocess the event or apply side effects again

---

## Part 2 — Canonical Educational Events

### Assessment Events

#### `assessment.session.started`

Emitted when a learner begins an assessment session.

```json
{
  "id": "evt_8f3k2m9x",
  "type": "assessment.session.started",
  "source": "urn:eduis:system:assessment-engine",
  "subject": "urn:eduis:learner:ke:school-xyz:abc123",
  "time": "2026-06-29T08:00:00Z",
  "tenantid": "school-xyz",
  "data": {
    "session_id": "string",
    "assessment_id": "string",
    "assessment_type": "formative | summative | diagnostic",
    "curriculum_refs": [...],
    "learner_id": "string",
    "class_id": "string",
    "teacher_id": "string",
    "time_limit_minutes": "integer | null",
    "device_type": "desktop | tablet | mobile"
  }
}
```

**Consumers:** Learning Intelligence Engine (updates engagement model), Teacher Portal (real-time progress monitoring), Analytics Engine.

#### `assessment.session.completed`

Emitted when a learner submits all responses.

```json
{
  "type": "assessment.session.completed",
  "data": {
    "session_id": "string",
    "assessment_id": "string",
    "learner_id": "string",
    "started_at": "datetime",
    "completed_at": "datetime",
    "duration_seconds": "integer",
    "response_count": "integer",
    "total_items": "integer",
    "completion_rate": "number (0-1)"
  }
}
```

**Consumers:** Assessment Engine (trigger marking), Teacher Portal (notify teacher), Learning Intelligence Engine.

#### `assessment.result.available`

Emitted when a marked result is calculated and available.

```json
{
  "type": "assessment.result.available",
  "data": {
    "result_id": "string",
    "session_id": "string",
    "assessment_id": "string",
    "learner_id": "string",
    "teacher_id": "string",
    "class_id": "string",
    "summary": {
      "total_marks": "number",
      "percentage": "number",
      "performance_level": "below_expectation | approaching_expectation | meeting_expectation | exceeding_expectation"
    },
    "competency_updates": [
      {
        "curriculum_ref": "string",
        "performance_level": "string",
        "confidence_delta": "number"
      }
    ],
    "is_ai_marked": "boolean",
    "requires_teacher_review": "boolean"
  }
}
```

**Consumers:** Learner Intelligence Engine (update competency states), Teacher Portal (show result), Parent Portal (notify parent if configured), Reporting Engine.

#### `assessment.result.reviewed`

Emitted when a teacher reviews and finalizes an AI-marked result.

```json
{
  "type": "assessment.result.reviewed",
  "data": {
    "result_id": "string",
    "reviewed_by": "string (teacher_id)",
    "reviewed_at": "datetime",
    "edits_made": "boolean",
    "final_performance_level": "string"
  }
}
```

#### `assessment.result.anomaly_detected`

Emitted when a result is statistically anomalous.

```json
{
  "type": "assessment.result.anomaly_detected",
  "data": {
    "result_id": "string",
    "learner_id": "string",
    "assessment_id": "string",
    "anomaly_type": "unusually_high | unusually_low | completion_time_anomaly | response_pattern_anomaly",
    "anomaly_score": "number (0-1, 1 = most anomalous)",
    "comparison_baseline": "string"
  }
}
```

---

### Learner Events

#### `learner.enrolled`

```json
{
  "type": "learner.enrolled",
  "data": {
    "learner_id": "string",
    "school_id": "string",
    "class_id": "string",
    "grade": "integer",
    "academic_year": "string",
    "term": "integer",
    "enrollment_type": "regular | special_needs | repeating | late_joiner",
    "enrolled_by": "string"
  }
}
```

#### `learner.transferred`

```json
{
  "type": "learner.transferred",
  "data": {
    "learner_id": "string",
    "from_school_id": "string",
    "to_school_id": "string",
    "from_class_id": "string",
    "effective_date": "date",
    "reason": "string | null",
    "records_transferred": "boolean"
  }
}
```

#### `learner.risk_score.changed`

Emitted whenever a learner's risk score is recalculated and has changed.

```json
{
  "type": "learner.risk_score.changed",
  "data": {
    "learner_id": "string",
    "school_id": "string",
    "class_id": "string",
    "previous_score": "integer | null",
    "current_score": "integer",
    "previous_level": "string | null",
    "current_level": "low | moderate | elevated | critical",
    "level_changed": "boolean",
    "primary_factors": [
      {
        "factor": "string",
        "weight": "number",
        "description": "string"
      }
    ],
    "model_version": "string"
  }
}
```

#### `learner.risk_score.elevated`

Emitted when risk level crosses the elevated threshold (score >= 60). This is a specific event separate from `risk_score.changed` because it requires immediate action routing.

```json
{
  "type": "learner.risk_score.elevated",
  "data": {
    "learner_id": "string",
    "school_id": "string",
    "class_id": "string",
    "teacher_id": "string",
    "current_score": "integer",
    "primary_factor": "string",
    "recommended_actions": ["string"],
    "time_at_elevated_risk_days": "integer"
  }
}
```

#### `learner.risk_score.critical`

Emitted when risk level crosses the critical threshold (score >= 80). Requires immediate routing to head teacher and welfare team.

#### `learner.risk_score.resolved`

Emitted when risk level drops below elevated threshold after having been elevated.

```json
{
  "type": "learner.risk_score.resolved",
  "data": {
    "learner_id": "string",
    "current_score": "integer",
    "days_at_elevated_or_above": "integer",
    "interventions_that_contributed": ["string (intervention_id)"]
  }
}
```

#### `learner.competency.milestone`

Emitted when a learner reaches a significant competency milestone.

```json
{
  "type": "learner.competency.milestone",
  "data": {
    "learner_id": "string",
    "milestone_type": "sub_strand_mastered | strand_completed | prerequisite_unlocked | grade_ready",
    "curriculum_ref": "string",
    "performance_level": "string",
    "unlocked_refs": ["string"],
    "evidence_count": "integer"
  }
}
```

#### `learner.trajectory.changed`

Emitted when a learner's overall trajectory direction changes.

```json
{
  "type": "learner.trajectory.changed",
  "data": {
    "learner_id": "string",
    "previous_trajectory": "improving | stable | declining | insufficient_data",
    "current_trajectory": "improving | stable | declining",
    "trajectory_change_date": "date",
    "contributing_factors": ["string"]
  }
}
```

#### `learner.attendance.concern`

Emitted when a learner's attendance drops below the configured threshold.

```json
{
  "type": "learner.attendance.concern",
  "data": {
    "learner_id": "string",
    "school_id": "string",
    "class_id": "string",
    "teacher_id": "string",
    "attendance_rate_30days": "number (0-1)",
    "consecutive_absences": "integer",
    "threshold_breached": "number (0-1)",
    "last_attendance_date": "date"
  }
}
```

---

### Lesson Generation Events

#### `lesson_plan.generated`

```json
{
  "type": "lesson_plan.generated",
  "data": {
    "plan_id": "string",
    "teacher_id": "string",
    "class_id": "string",
    "curriculum_ref": "string",
    "ai_model_version": "string",
    "ai_tokens_used": "integer",
    "generation_time_ms": "integer"
  }
}
```

#### `lesson_plan.approved`

```json
{
  "type": "lesson_plan.approved",
  "data": {
    "plan_id": "string",
    "teacher_id": "string",
    "class_id": "string",
    "curriculum_ref": "string",
    "was_ai_generated": "boolean",
    "edits_made": "boolean",
    "edit_distance_percent": "number | null"
  }
}
```

#### `lesson_plan.taught`

Emitted when a teacher marks a lesson as delivered.

```json
{
  "type": "lesson_plan.taught",
  "data": {
    "plan_id": "string",
    "teacher_id": "string",
    "class_id": "string",
    "curriculum_ref": "string",
    "taught_date": "date",
    "actual_duration_minutes": "integer",
    "notes": "string | null"
  }
}
```

---

### Risk Score Changed (duplicate — intentional)

The `learner.risk_score.changed` and `learner.risk_score.elevated` are separate events with different routing requirements. The `changed` event is informational; the `elevated` event demands action.

---

### Teacher Events

#### `teacher.feedback.submitted`

```json
{
  "type": "teacher.feedback.submitted",
  "data": {
    "feedback_id": "string",
    "teacher_id": "string",
    "feedback_type": "lesson_plan_edit | assessment_edit | observation | ai_quality_report",
    "source_id": "string (the item being given feedback on)",
    "rating": "integer (1-5) | null",
    "categories": ["string"],
    "improvement_applied": "boolean"
  }
}
```

#### `teacher.class.coverage_alert`

```json
{
  "type": "teacher.class.coverage_alert",
  "data": {
    "teacher_id": "string",
    "class_id": "string",
    "alert_type": "behind_schedule | significant_gap | end_of_term_risk",
    "curriculum_coverage_rate": "number (0-1)",
    "expected_rate_at_this_point": "number (0-1)",
    "sub_strands_behind": ["string"],
    "weeks_remaining_in_term": "integer"
  }
}
```

---

### Attendance Recorded

#### `attendance.recorded`

```json
{
  "type": "attendance.recorded",
  "data": {
    "class_id": "string",
    "teacher_id": "string",
    "date": "date",
    "period": "full_day | morning | afternoon",
    "total_enrolled": "integer",
    "present": "integer",
    "absent_excused": "integer",
    "absent_unexcused": "integer",
    "late": "integer",
    "attendance_rate": "number (0-1)",
    "recorded_at": "datetime"
  }
}
```

---

### Intervention Events

#### `intervention.assigned`

```json
{
  "type": "intervention.assigned",
  "data": {
    "intervention_id": "string",
    "learner_id": "string",
    "assigned_to": "string",
    "assigned_role": "teacher | head_teacher | counsellor | parent",
    "priority": "low | medium | high | urgent",
    "due_date": "date",
    "recommended_actions": ["string"]
  }
}
```

#### `intervention.acknowledged`

#### `intervention.completed`

```json
{
  "type": "intervention.completed",
  "data": {
    "intervention_id": "string",
    "learner_id": "string",
    "completed_by": "string",
    "completed_at": "datetime",
    "implementation_notes": "string | null",
    "outcome_observed": "string | null"
  }
}
```

#### `intervention.overdue`

Emitted by the platform when an intervention passes its due date without completion.

---

### Curriculum Validated

#### `curriculum.content.validated`

```json
{
  "type": "curriculum.content.validated",
  "data": {
    "content_id": "string",
    "content_type": "lesson_plan | assessment | resource",
    "curriculum_refs": [...],
    "validation_level": "reference | alignment | coverage",
    "passed": "boolean",
    "alignment_score": "number (0-1) | null",
    "issues": [
      {
        "rule_id": "string",
        "severity": "error | warning",
        "description": "string"
      }
    ]
  }
}
```

---

### Portfolio Events

#### `portfolio.evidence.submitted`

#### `portfolio.evidence.approved`

```json
{
  "type": "portfolio.evidence.approved",
  "data": {
    "evidence_id": "string",
    "learner_id": "string",
    "reviewed_by": "string",
    "curriculum_refs": [...],
    "performance_levels_recorded": [
      { "curriculum_ref": "string", "level": "string" }
    ]
  }
}
```

#### `portfolio.submitted`

Emitted when a learner submits their complete portfolio for assessment.

---

## Part 3 — Versioning

### Schema Versioning

Every event type is versioned using a `dataschema` URI:

```
https://eduis.org/events/v1/assessment.session.completed.json
https://eduis.org/events/v2/assessment.session.completed.json
```

### Compatibility Rules

**Minor version changes** (v1.0 → v1.1):
- Adding optional fields to the `data` object
- Adding new enum values to existing fields
- Adding new metadata fields

Consumers must ignore unknown fields. Minor version changes do not require consumer updates.

**Major version changes** (v1 → v2):
- Removing fields
- Changing field types or semantics
- Restructuring the `data` object

Major version changes require consumer updates. Old and new versions are delivered in parallel for 12 months, then the old version is retired.

### Deprecation Notice

Deprecated events include a `deprecated: true` field in the metadata and a `deprecation_notice` field with the sunset date and migration instructions.

---

## Part 4 — Ordering

### Ordering Guarantees

**Within a single entity (e.g., a single learner):** Events are delivered in the order they were emitted. If `assessment.session.started` is emitted before `assessment.session.completed`, it will always be delivered first.

**Within a tenant:** Events from different entities are not globally ordered. The event system does not guarantee that `learner.enrolled` for Learner A is delivered before `assessment.session.started` for Learner B.

**Across tenants:** No ordering guarantee.

### Sequence Identifiers

For strict ordering requirements, events include a `sequenceid` that is monotonically increasing within an entity:

```json
{
  "sequenceid": "learner:abc123:000000000042",
  ...
}
```

Consumers that require strict ordering maintain their own sequence tracking and hold events that arrive out of order until missing events are received or the gap timeout expires.

---

## Part 5 — Delivery Guarantees

### At-Least-Once Delivery

All events are delivered at least once. Events may be delivered more than once in failure scenarios. Consumers must be idempotent.

**Idempotency implementation:**
```sql
CREATE TABLE processed_events (
  event_id   uuid PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);

-- Before processing an event:
INSERT INTO processed_events (event_id) VALUES ($1)
ON CONFLICT (event_id) DO NOTHING
RETURNING event_id;

-- If no row returned, the event was already processed. Skip.
```

### Acknowledgement

Consumers acknowledge events by returning a 2xx HTTP status within 30 seconds of delivery. Events that receive no acknowledgement are retried.

### Retry Schedule

| Attempt | Delay |
|---|---|
| 1 | Immediate |
| 2 | 30 seconds |
| 3 | 5 minutes |
| 4 | 30 minutes |
| 5 | 2 hours |
| 6 | 6 hours |
| 7 | 24 hours |

After 7 failed attempts: moved to Dead Letter Queue.

### Dead Letter Queue

Events in the DLQ:
- Are retained for 30 days
- Are accessible for inspection through the management API
- Can be replayed to any endpoint on demand
- Generate an alert to the tenant administrator

---

## Part 6 — Replay Behaviour

### Replay Scenarios

Replay is necessary when:
- A consumer endpoint was unavailable for an extended period
- A new consumer needs to process historical events
- Events were incorrectly processed and need reprocessing

### Replay API

```
POST /events/replay
{
  "event_types": ["assessment.result.available", "learner.risk_score.elevated"],
  "from": "2026-06-01T00:00:00Z",
  "to": "2026-06-29T23:59:59Z",
  "tenant_id": "school-xyz",
  "target_endpoint": "https://my-app.example.com/webhooks"
}
```

Replay events are tagged with `replay: true` and the original `time` field is preserved.

### Replay Idempotency

Replayed events have the same `id` as the original. Consumers that are idempotent (which all consumers must be) handle replay correctly by ignoring already-processed events.

---

## Part 7 — Security

### Event Signing

All events are signed by the producer using an HMAC-SHA256 signature over the event payload. The signature is included in the delivery header:

```
Eduis-Signature: t=1719672000,v1=a9b3c7d8e2f1...
```

Consumers must verify the signature before processing any event:

```typescript
import { verifyEventSignature } from '@eduis/events-sdk';

const isValid = verifyEventSignature(
  rawBody,
  headers['eduis-signature'],
  process.env.WEBHOOK_SECRET
);

if (!isValid) {
  return res.status(401).json({ error: 'Invalid signature' });
}
```

### Tenant Isolation

Events are scoped to a tenant. A consumer subscribed to events for Tenant A cannot receive events for Tenant B, regardless of authentication.

### Sensitive Data in Events

Events must not contain:
- Full learner personal records (only learner IDs)
- Assessment responses (only results)
- Parent contact information (only parent IDs)
- Teacher personal information (only teacher IDs)

Sensitive data is available through the API; events are notifications that data is available, not the data itself.

### Event Log Retention

All events are logged and retained for 90 days. After 90 days, events are archived for 7 years for audit purposes (accessing archived events requires a formal request).

---

## Part 8 — Custom Events

### Custom Event Namespacing

Third-party systems and plugins can emit custom events using a namespaced type:

```
{organisation_domain}.{event_type}
com.myschoolapp.parent_meeting.scheduled
org.mydistrict.inspection.completed
```

Custom events follow the same base schema as platform events. They are:
- Delivered to subscribers who explicitly subscribe to the custom type
- Subject to the same security and idempotency requirements
- Audited in the same event log

### Custom Event Registration

Custom event types should be registered with the platform so they appear in documentation and can be subscribed to through the standard subscription interface:

```
POST /events/types/register
{
  "type": "com.myschoolapp.parent_meeting.scheduled",
  "description": "A parent-teacher meeting has been scheduled",
  "data_schema": "https://myschoolapp.com/schemas/events/parent-meeting-scheduled.json",
  "producer": "com.myschoolapp"
}
```

---

## Appendix — Event Quick Reference

| Event | Trigger | Action Consumers |
|---|---|---|
| `assessment.session.started` | Learner begins assessment | Engagement tracking |
| `assessment.session.completed` | Learner submits assessment | Marking trigger |
| `assessment.result.available` | Result calculated | Intelligence update, parent alert |
| `assessment.result.anomaly_detected` | Statistical anomaly | Teacher review alert |
| `learner.enrolled` | New enrollment | Class roster, system provisioning |
| `learner.transferred` | School transfer | Record transfer, access revocation |
| `learner.risk_score.changed` | Score recalculated | Analytics |
| `learner.risk_score.elevated` | Risk >= elevated | Teacher alert, head teacher alert |
| `learner.risk_score.critical` | Risk >= critical | Immediate welfare response |
| `learner.risk_score.resolved` | Risk drops below elevated | Resolution notification |
| `learner.competency.milestone` | Milestone reached | Parent celebration notification |
| `learner.trajectory.changed` | Trajectory shifts | Risk model update |
| `learner.attendance.concern` | Attendance drops | Pastoral alert |
| `lesson_plan.generated` | AI generation complete | Quality monitoring |
| `lesson_plan.approved` | Teacher approves draft | Record of work update |
| `lesson_plan.taught` | Teacher marks lesson taught | Coverage tracking |
| `teacher.feedback.submitted` | Teacher provides AI feedback | Quality improvement |
| `teacher.class.coverage_alert` | Coverage falling behind | Head teacher alert |
| `attendance.recorded` | Attendance taken | Analytics, safeguarding |
| `intervention.assigned` | Intervention created | Assignee notification |
| `intervention.completed` | Intervention done | Effectiveness tracking |
| `intervention.overdue` | Deadline passed | Escalation alert |
| `curriculum.content.validated` | Validation run | Quality dashboard |
| `portfolio.evidence.submitted` | Evidence uploaded | Teacher review queue |
| `portfolio.evidence.approved` | Evidence approved | Learner notification, model update |

---

*EduNexus Standards Series — Volume 8: Educational Event Standards*

*Edition 1.0 — June 2026*
