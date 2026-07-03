# EduNexus Standards Series

## Volume 3 — Educational API Standards

**Edition 1.0 — June 2026**

---

> *An API is not just a technical interface. It is a contract, a vocabulary, and a statement of what the system believes is worth naming.*

---

## Preface

This volume defines standard API specifications for educational domain resources. These specifications are not EduNexus-specific — they are proposed as open standards that any educational platform may adopt, implement, or extend.

The goal is interoperability: when a Learner resource means the same thing in an LMS, an assessment platform, a parent portal, and a government dashboard, data can flow freely between them without translation layers.

Each API specification in this volume defines:
- The canonical resource model
- Standard operations (CRUD and domain-specific)
- Query parameters and filter semantics
- Response structure
- Error codes
- Event definitions
- Versioning approach

These specifications use REST as the primary transport, with JSON as the serialization format and OpenAPI 3.1 as the documentation format.

---

## 1. Learner API

### Resource Model

The Learner resource represents a student enrolled in an educational institution.

```json
{
  "id": "urn:eduis:learner:ke:school-xyz:abc123",
  "type": "Learner",
  "version": "1.0",
  "personal": {
    "given_name": "string",
    "family_name": "string",
    "date_of_birth": "date",
    "gender": "male | female | not_specified",
    "nationality": "string (ISO 3166-1 alpha-2)",
    "language_of_instruction": "string (BCP 47)"
  },
  "enrollment": {
    "school_id": "string",
    "grade": "integer",
    "class_id": "string",
    "academic_year": "string",
    "enrollment_status": "active | inactive | suspended | graduated",
    "enrollment_date": "datetime"
  },
  "contacts": [
    {
      "id": "string",
      "relationship": "parent | guardian | emergency",
      "given_name": "string",
      "family_name": "string",
      "phone": "string (E.164)",
      "email": "string",
      "preferred_language": "string (BCP 47)",
      "preferred_channel": "whatsapp | sms | email | in_app"
    }
  ],
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime",
    "created_by": "string",
    "tenant_id": "string"
  }
}
```

### Standard Operations

| Method | Path | Description |
|---|---|---|
| POST | `/learners` | Create a learner record |
| GET | `/learners/{id}` | Retrieve a learner by ID |
| PATCH | `/learners/{id}` | Update learner fields |
| DELETE | `/learners/{id}` | Soft-delete a learner record |
| GET | `/learners` | List learners (with filters) |
| POST | `/learners/batch` | Retrieve multiple learners by ID |

### Query Parameters

```
GET /learners
  ?school_id=string       — filter by school
  ?class_id=string        — filter by class
  ?grade=integer          — filter by grade
  ?status=active|inactive — filter by enrollment status
  ?q=string               — search by name
  ?cursor=string          — pagination cursor
  ?limit=integer          — page size (max 100)
  ?fields=string          — comma-separated field projection
```

### Domain Operations

```
GET  /learners/{id}/attendance          — attendance history
POST /learners/{id}/attendance          — record attendance event
GET  /learners/{id}/assessments         — assessment results
GET  /learners/{id}/portfolio           — portfolio evidence
GET  /learners/{id}/competencies        — competency states
POST /learners/{id}/competencies/update — record competency evidence
```

### Learner Events

```
learner.created          — new learner record created
learner.enrolled         — learner enrolled in a class
learner.transferred      — learner transferred to a different class/school
learner.graduated        — learner completed their educational programme
learner.suspended        — learner enrollment suspended
learner.contact.updated  — guardian contact information updated
```

### Error Codes

| Code | Description |
|---|---|
| `LEARNER_NOT_FOUND` | Learner ID does not exist in this tenant |
| `LEARNER_ALREADY_EXISTS` | Learner with same identity already enrolled |
| `ENROLLMENT_CONFLICT` | Learner already enrolled in a conflicting class |
| `INVALID_GRADE` | Specified grade is not valid for this curriculum system |

---

## 2. Teacher API

### Resource Model

```json
{
  "id": "urn:eduis:teacher:ke:school-xyz:tch001",
  "type": "Teacher",
  "version": "1.0",
  "personal": {
    "given_name": "string",
    "family_name": "string",
    "tsc_number": "string",
    "gender": "string",
    "phone": "string (E.164)",
    "email": "string"
  },
  "professional": {
    "school_id": "string",
    "employment_type": "permanent | contract | volunteer",
    "employment_date": "date",
    "subjects": ["string"],
    "qualifications": [
      {
        "type": "degree | diploma | certificate",
        "field": "string",
        "institution": "string",
        "year": "integer"
      }
    ],
    "tsc_registration_status": "registered | pending | not_registered"
  },
  "assignments": [
    {
      "class_id": "string",
      "subject": "string",
      "academic_year": "string",
      "term": "integer"
    }
  ],
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime",
    "tenant_id": "string"
  }
}
```

### Standard Operations

| Method | Path | Description |
|---|---|---|
| POST | `/teachers` | Create a teacher record |
| GET | `/teachers/{id}` | Retrieve a teacher |
| PATCH | `/teachers/{id}` | Update teacher fields |
| GET | `/teachers` | List teachers (with filters) |

### Domain Operations

```
GET  /teachers/{id}/classes              — class assignments
POST /teachers/{id}/classes              — create class assignment
GET  /teachers/{id}/lesson-plans         — lesson plan library
GET  /teachers/{id}/schemes-of-work      — scheme of work
GET  /teachers/{id}/assessments          — assessment bank
GET  /teachers/{id}/records-of-work      — record of work
```

### Teacher Events

```
teacher.created                     — new teacher record
teacher.assigned.class              — teacher assigned to a class
teacher.unassigned.class            — teacher removed from a class
teacher.qualification.added         — qualification recorded
```

---

## 3. Assessment API

### Resource Model: Assessment Instrument

```json
{
  "id": "string",
  "type": "Assessment",
  "version": "1.0",
  "metadata": {
    "title": "string",
    "description": "string",
    "assessment_type": "formative | summative | diagnostic | portfolio",
    "curriculum_refs": [
      {
        "curriculum_system": "CBC | 844 | IGCSE",
        "grade": "integer",
        "subject": "string",
        "strand_id": "string",
        "sub_strand_id": "string",
        "learning_outcome_id": "string"
      }
    ],
    "difficulty": "introductory | standard | challenging",
    "time_limit_minutes": "integer | null",
    "created_by": "string",
    "school_id": "string",
    "is_shared": "boolean"
  },
  "sections": [
    {
      "id": "string",
      "title": "string",
      "instruction": "string",
      "items": [...]
    }
  ]
}
```

### Resource Model: Assessment Item

```json
{
  "id": "string",
  "type": "AssessmentItem",
  "item_type": "mcq | multi_select | short_answer | structured | essay | matching | ordering",
  "curriculum_refs": [...],
  "bloom_level": "remember | understand | apply | analyze | evaluate | create",
  "difficulty": "number (0-1)",
  "stem": "string",
  "options": [
    {
      "id": "string",
      "text": "string",
      "is_correct": "boolean",
      "explanation": "string"
    }
  ],
  "marking_scheme": "object",
  "rubric_id": "string | null",
  "marks": "number"
}
```

### Resource Model: Assessment Result

```json
{
  "id": "string",
  "type": "AssessmentResult",
  "assessment_id": "string",
  "learner_id": "string",
  "session": {
    "started_at": "datetime",
    "completed_at": "datetime",
    "duration_seconds": "integer",
    "device_type": "string"
  },
  "responses": [
    {
      "item_id": "string",
      "response": "object",
      "marks_awarded": "number",
      "performance_level": "below | approaching | meeting | exceeding | null",
      "ai_feedback": "string | null"
    }
  ],
  "summary": {
    "total_marks": "number",
    "percentage": "number",
    "performance_level": "below | approaching | meeting | exceeding",
    "competency_updates": [
      {
        "curriculum_ref": "string",
        "performance_level": "string",
        "confidence_delta": "number"
      }
    ]
  },
  "metadata": {
    "marked_by": "string | null",
    "marked_at": "datetime | null",
    "validated_by": "string | null"
  }
}
```

### Standard Operations

```
POST /assessments              — create assessment
GET  /assessments/{id}         — retrieve assessment
PATCH /assessments/{id}        — update assessment
GET  /assessments              — list assessments (with filters)

POST /assessments/items        — create item in bank
GET  /assessments/items        — query item bank

POST /assessments/{id}/sessions        — start assessment session
PUT  /assessments/{id}/sessions/{sid}  — submit responses
GET  /assessments/{id}/results         — list results
GET  /assessments/{id}/analytics       — assessment analytics
```

### Assessment Events

```
assessment.created              — assessment created
assessment.session.started      — learner began assessment
assessment.session.completed    — learner submitted responses
assessment.result.marked        — result calculated
assessment.result.published     — result released to learner/parent
assessment.analytics.updated    — item analytics recalculated
```

---

## 4. Curriculum API

### Resource Model: Curriculum Node

The Curriculum API exposes the curriculum as a hierarchical graph. Every node in the graph — regardless of its level — shares a common structure:

```json
{
  "id": "CBC_G8_MATHS_S3_SS2",
  "type": "CurriculumNode",
  "node_type": "subject | strand | sub_strand | learning_outcome | performance_indicator",
  "curriculum_system": "CBC",
  "grade": 8,
  "subject": "mathematics",
  "title": "Linear Equations in One Unknown",
  "description": "string",
  "parent_id": "CBC_G8_MATHS_S3",
  "children": ["CBC_G8_MATHS_S3_SS2_LO1", "CBC_G8_MATHS_S3_SS2_LO2"],
  "prerequisites": ["CBC_G8_MATHS_S3_SS1"],
  "assessment_guidance": {
    "recommended_types": ["observation", "written", "project"],
    "performance_levels": {
      "below_expectation": "string",
      "approaching_expectation": "string",
      "meeting_expectation": "string",
      "exceeding_expectation": "string"
    }
  },
  "metadata": {
    "version": "string",
    "effective_date": "date",
    "source_document": "string"
  }
}
```

### Standard Operations

```
GET /curriculum/systems                        — list available curriculum systems
GET /curriculum/systems/{system}               — get curriculum system summary
GET /curriculum/nodes/{id}                     — get specific curriculum node
GET /curriculum/nodes/{id}/children            — get direct children
GET /curriculum/nodes/{id}/prerequisites       — get prerequisite nodes
GET /curriculum/nodes/{id}/dependents          — get nodes that depend on this one
GET /curriculum/subjects/{system}/{grade}      — list subjects for grade

POST /curriculum/search                        — semantic search
{
  "q": "string",
  "curriculum_system": "CBC",
  "grade": 8,
  "subject": "mathematics",
  "node_type": "sub_strand"
}

POST /curriculum/validate                      — validate content alignment
```

### Curriculum Events

```
curriculum.version.updated          — curriculum document updated by authority
curriculum.node.deprecated          — curriculum element removed or replaced
```

---

## 5. School API

### Resource Model

```json
{
  "id": "urn:eduis:school:ke:001234",
  "type": "School",
  "version": "1.0",
  "official": {
    "name": "string",
    "knec_code": "string",
    "nemis_code": "string",
    "category": "public | private | faith_based | international",
    "type": "primary | secondary | integrated",
    "curriculum_systems": ["CBC", "8-4-4"]
  },
  "location": {
    "county": "string",
    "sub_county": "string",
    "ward": "string",
    "address": "string",
    "coordinates": { "lat": "number", "lon": "number" }
  },
  "contact": {
    "phone": "string",
    "email": "string",
    "website": "string"
  },
  "academic_calendar": {
    "year": "integer",
    "terms": [
      {
        "term": 1,
        "start_date": "date",
        "end_date": "date",
        "opening_day": "date"
      }
    ],
    "public_holidays": ["date"]
  },
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

### Standard Operations

```
POST /schools              — register a school
GET  /schools/{id}         — retrieve school
PATCH /schools/{id}        — update school information
GET  /schools/{id}/grades  — list grades in the school
GET  /schools/{id}/classes — list classes
GET  /schools/{id}/staff   — list staff
GET  /schools/{id}/learners — list learners (paginated)
```

---

## 6. Outcome API

### Resource Model

The Outcome API records verified learning outcomes for individual learners — the formal record of what a learner has demonstrably achieved.

```json
{
  "id": "string",
  "type": "LearningOutcome",
  "learner_id": "string",
  "curriculum_ref": "string",
  "performance_level": "below | approaching | meeting | exceeding",
  "confidence": "number (0-1)",
  "evidence": [
    {
      "source": "assessment | observation | portfolio | peer",
      "source_id": "string",
      "date": "date",
      "performance_level": "string"
    }
  ],
  "verified_by": "string",
  "verified_at": "datetime",
  "school_id": "string",
  "academic_year": "string",
  "term": "integer",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Standard Operations

```
POST /outcomes                           — record a learning outcome
GET  /outcomes/{id}                      — retrieve outcome
GET  /learners/{id}/outcomes             — all outcomes for a learner
GET  /learners/{id}/outcomes?curriculum_ref=CBC_G8_MATHS_S3_SS2
POST /outcomes/batch                     — record multiple outcomes
GET  /classes/{id}/outcomes/summary      — class-level outcome summary
```

---

## 7. Intervention API

### Resource Model

```json
{
  "id": "string",
  "type": "Intervention",
  "learner_id": "string",
  "trigger": {
    "type": "risk_score | assessment_result | attendance | teacher_referral",
    "source_id": "string",
    "triggered_at": "datetime"
  },
  "recommendation": {
    "category": "academic | pastoral | parental | referral",
    "description": "string",
    "specific_actions": ["string"],
    "priority": "low | medium | high | urgent",
    "resources": ["string"]
  },
  "assignment": {
    "assigned_to": "string",
    "assigned_role": "teacher | head_teacher | counsellor | parent",
    "assigned_at": "datetime",
    "due_date": "date"
  },
  "implementation": {
    "status": "pending | in_progress | completed | dismissed",
    "notes": "string",
    "implemented_at": "datetime",
    "implemented_by": "string"
  },
  "outcome": {
    "effectiveness_score": "integer | null",
    "notes": "string",
    "evaluated_at": "datetime | null"
  },
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

### Standard Operations

```
POST /interventions                          — create intervention
GET  /interventions/{id}                     — retrieve intervention
PATCH /interventions/{id}/implementation     — update implementation status
POST /interventions/{id}/outcome             — record outcome
GET  /learners/{id}/interventions            — interventions for a learner
GET  /classes/{id}/interventions             — interventions for a class
GET  /schools/{id}/interventions/active      — active interventions school-wide
```

### Intervention Events

```
intervention.created             — intervention assigned
intervention.acknowledged        — assigned person acknowledged the intervention
intervention.completed           — intervention marked complete
intervention.outcome.evaluated   — effectiveness scored
intervention.overdue             — intervention past due date without completion
```

---

## 8. Attendance API

### Resource Model

```json
{
  "id": "string",
  "type": "AttendanceRecord",
  "learner_id": "string",
  "class_id": "string",
  "school_id": "string",
  "date": "date",
  "period": "full_day | morning | afternoon | period",
  "status": "present | absent | late | excused | unknown",
  "reason": "string | null",
  "recorded_by": "string",
  "recorded_at": "datetime"
}
```

### Standard Operations

```
POST /attendance                              — record attendance event
POST /attendance/batch                        — record class attendance
GET  /learners/{id}/attendance                — learner attendance history
GET  /classes/{id}/attendance                 — class attendance for date
GET  /classes/{id}/attendance/summary         — class attendance summary
GET  /schools/{id}/attendance/daily           — school daily attendance report
```

### Attendance Events

```
attendance.absent.threshold         — learner absence crosses configured threshold
attendance.pattern.concerning       — attendance pattern indicates concern
```

---

## 9. Reporting API

### Resource Model: Report

```json
{
  "id": "string",
  "type": "LearnerReport",
  "learner_id": "string",
  "school_id": "string",
  "academic_year": "string",
  "term": "integer",
  "report_type": "formative | summative | holistic | portfolio",
  "status": "draft | review | approved | published",
  "sections": [
    {
      "subject": "string",
      "teacher_id": "string",
      "competency_summaries": [
        {
          "strand": "string",
          "performance_level": "string",
          "comment": "string"
        }
      ],
      "overall_performance": "string",
      "teacher_comment": "string",
      "teacher_signature_at": "datetime | null"
    }
  ],
  "head_teacher_comment": "string | null",
  "published_at": "datetime | null",
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

### Standard Operations

```
POST /reports/generate                    — generate report (triggers AI comment generation)
GET  /reports/{id}                        — retrieve report
PATCH /reports/{id}/sections/{subject}    — update section comment
POST /reports/{id}/approve               — head teacher approves report
POST /reports/{id}/publish               — publish to parent portal
GET  /learners/{id}/reports              — report history for learner
GET  /classes/{id}/reports/status        — completion status for class
```

### Reporting Events

```
report.generated               — report draft created
report.section.completed       — teacher completed their section
report.approved                — head teacher approved
report.published               — report released to parent
```

---

## 10. Portfolio API

### Resource Model

```json
{
  "id": "string",
  "type": "PortfolioEvidence",
  "learner_id": "string",
  "school_id": "string",
  "academic_year": "string",
  "term": "integer",
  "evidence_type": "text | image | audio | video | link | observation | peer_assessment",
  "content": {
    "type": "string",
    "url": "string | null",
    "text": "string | null",
    "metadata": "object"
  },
  "curriculum_refs": [
    {
      "curriculum_ref": "string",
      "competency_demonstrated": "string",
      "performance_level": "string | null"
    }
  ],
  "submitted_by": "string",
  "submitted_at": "datetime",
  "review": {
    "status": "pending | approved | rejected | revision_requested",
    "reviewed_by": "string | null",
    "reviewed_at": "datetime | null",
    "reviewer_comment": "string | null"
  },
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

### Standard Operations

```
POST /portfolio/evidence                       — submit evidence
GET  /portfolio/evidence/{id}                  — retrieve evidence
PATCH /portfolio/evidence/{id}/review          — teacher reviews evidence
GET  /learners/{id}/portfolio                  — learner's portfolio
GET  /learners/{id}/portfolio?term=2&year=2026 — filtered portfolio
GET  /classes/{id}/portfolio/summary           — class portfolio completion
```

---

## 11. Career API

### Resource Model: Career Profile

```json
{
  "id": "string",
  "type": "CareerProfile",
  "learner_id": "string",
  "interests": [
    {
      "career_id": "string",
      "interest_level": "exploring | interested | committed",
      "stated_at": "datetime"
    }
  ],
  "competency_matches": [
    {
      "career_id": "string",
      "match_score": "number (0-1)",
      "match_basis": "current | trajectory | combined",
      "gap_summary": "string",
      "computed_at": "datetime"
    }
  ],
  "pathway_plan": {
    "target_career_id": "string",
    "target_institution": "string | null",
    "subject_choices": ["string"],
    "development_actions": ["string"],
    "created_at": "datetime",
    "updated_by": "string"
  },
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

### Resource Model: Career

```json
{
  "id": "string",
  "type": "Career",
  "title": "string",
  "description": "string",
  "category": "string",
  "sub_category": "string",
  "kenya_context": {
    "market_size": "small | medium | large",
    "growth_trend": "declining | stable | growing | high_growth",
    "geographic_concentration": "string",
    "entry_pathways": ["string"]
  },
  "competency_requirements": [
    {
      "curriculum_ref": "string",
      "importance": "essential | important | helpful",
      "minimum_level": "approaching | meeting | exceeding"
    }
  ],
  "educational_requirements": {
    "minimum_qualification": "string",
    "preferred_subjects": ["string"],
    "university_programmes": ["string"]
  }
}
```

### Standard Operations

```
GET  /careers                                  — browse career directory
GET  /careers/{id}                             — retrieve career detail
GET  /careers/{id}/competency-requirements     — what competencies this career needs
POST /learners/{id}/career-profile             — create/update career profile
GET  /learners/{id}/career-profile             — retrieve career profile
POST /learners/{id}/career-profile/match       — compute career matches
GET  /learners/{id}/career-profile/pathway     — retrieve pathway plan
PATCH /learners/{id}/career-profile/pathway    — update pathway plan
```

### Career Events

```
career.match.computed          — career matches recalculated
career.profile.pathway.set     — learner committed to a pathway
career.profile.interest.added  — learner expressed interest in a career
```

---

## 12. Notification API

### Resource Model

```json
{
  "id": "string",
  "type": "Notification",
  "recipient": {
    "id": "string",
    "role": "teacher | parent | learner | administrator",
    "channel": "in_app | email | sms | whatsapp | push"
  },
  "content": {
    "template_id": "string",
    "data": "object",
    "rendered": {
      "subject": "string | null",
      "body": "string",
      "action_url": "string | null"
    }
  },
  "trigger": {
    "event_type": "string",
    "event_id": "string"
  },
  "delivery": {
    "status": "queued | sent | delivered | failed",
    "sent_at": "datetime | null",
    "delivered_at": "datetime | null",
    "failure_reason": "string | null",
    "retry_count": "integer"
  },
  "metadata": {
    "created_at": "datetime"
  }
}
```

### Standard Operations

```
POST /notifications/send           — send a notification
POST /notifications/batch          — send batch notifications
GET  /notifications/{id}           — retrieve notification status
GET  /notifications/templates      — list notification templates
POST /notifications/templates      — create notification template
GET  /notifications/preferences/{user_id} — get user notification preferences
PUT  /notifications/preferences/{user_id} — update preferences
```

---

## API Versioning Standard

All Educational API Standard implementations must follow this versioning contract:

**Version format:** `vMAJOR` in the URL path (`/v1/`, `/v2/`)

**Breaking change definition:** Any change that would cause an existing correct client to fail or behave incorrectly:
- Removing a field
- Changing a field's type
- Changing the semantics of a parameter
- Changing an error code
- Changing an event schema

**Non-breaking change definition:**
- Adding a new field (clients must ignore unknown fields)
- Adding a new endpoint
- Adding a new optional query parameter
- Adding a new error code

**Deprecation period:** 24 months from next major version release.

**Sunset notification:** 12 months before sunset.

---

## Error Standard

All Educational API Standard implementations must use this error format:

```json
{
  "error": {
    "code": "SNAKE_CASE_ERROR_CODE",
    "message": "Human-readable description ending with a period.",
    "details": {},
    "documentation_url": "https://[platform]/errors/SNAKE_CASE_ERROR_CODE",
    "request_id": "string"
  }
}
```

HTTP status codes must follow standard semantics. Do not return 200 with an error body.

---

## Pagination Standard

All list endpoints returning potentially large collections must support cursor-based pagination:

**Request:**
```
GET /learners?cursor=<opaque_cursor>&limit=25
```

**Response:**
```json
{
  "data": [...],
  "pagination": {
    "has_more": true,
    "next_cursor": "string",
    "count": 25,
    "total": 340
  }
}
```

Clients must not parse cursors. Cursors may change format between requests.

---

*EduNexus Standards Series — Volume 3: Educational API Standards*

*Edition 1.0 — June 2026*
