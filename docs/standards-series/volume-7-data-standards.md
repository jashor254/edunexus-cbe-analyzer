# EduNexus Standards Series

## Volume 7 — Educational Data Standards

### Canonical Domain Objects for Interoperable Educational Systems

**Edition 1.0 — June 2026**

---

> *Data that means different things to different systems is not shared data. It is parallel data — structurally identical in appearance but semantically incompatible. The cost of that incompatibility is paid every time someone tries to make sense of education across system boundaries.*

---

## Preface

This volume defines canonical domain objects — the authoritative data shapes for educational concepts — that any educational information system can adopt. When these objects are shared across an LMS, an ERP, an assessment platform, and a parent portal, data flows freely without translation layers.

These are not database schemas. They are canonical domain models: the authoritative definition of what each concept means, what attributes it carries, and how it relates to other concepts.

Implementation details (storage format, database engine, ORM) are left to each system. The canonical model defines the contract.

---

## 1. Learner

The Learner is the central entity of educational systems. All other entities relate to it.

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/learner.json",
  "id": "string (URN: urn:eduis:learner:{country}:{institution}:{local_id})",
  "version": "1.0",
  "personal": {
    "given_name": "string (required)",
    "family_name": "string (required)",
    "other_names": "string | null",
    "date_of_birth": "date (YYYY-MM-DD)",
    "gender": "male | female | not_specified | not_disclosed",
    "nationality": "string (ISO 3166-1 alpha-2)",
    "home_language": "string (BCP 47)",
    "language_of_instruction": "string (BCP 47)"
  },
  "identification": {
    "national_id": "string | null",
    "birth_certificate_number": "string | null",
    "nemis_number": "string | null",
    "previous_school_ids": ["string"]
  },
  "enrollment": {
    "school_id": "string (URN)",
    "grade": "integer",
    "class_id": "string",
    "class_stream": "string | null",
    "academic_year": "string (YYYY)",
    "term": "integer | null",
    "enrollment_date": "date",
    "enrollment_status": "active | inactive | suspended | transferred | graduated | deceased",
    "enrollment_type": "regular | special_needs | repeating | late_joiner"
  },
  "special_needs": {
    "has_special_needs": "boolean",
    "categories": ["string"],
    "accommodations_required": ["string"],
    "support_plan_id": "string | null"
  },
  "contacts": [
    {
      "id": "string",
      "relationship": "father | mother | guardian | emergency_contact | social_worker",
      "given_name": "string",
      "family_name": "string",
      "phone": "string (E.164)",
      "phone_verified": "boolean",
      "email": "string | null",
      "email_verified": "boolean",
      "preferred_language": "string (BCP 47)",
      "preferred_notification_channel": "whatsapp | sms | email | in_app",
      "is_primary": "boolean",
      "lives_with_learner": "boolean"
    }
  ],
  "metadata": {
    "created_at": "datetime (ISO 8601)",
    "updated_at": "datetime (ISO 8601)",
    "created_by": "string",
    "source_system": "string",
    "tenant_id": "string"
  }
}
```

### Normalization Rules

- `id` is globally unique and does not change when a learner moves between schools.
- `given_name` and `family_name` are stored as the learner uses them, preserving case and characters.
- `date_of_birth` is required for all new records; existing records without DOB may have `null`.
- Only one contact may have `is_primary: true`.

### Relationships

| Relationship | Target Type | Cardinality |
|---|---|---|
| enrolled_in | Class | many-to-one per term |
| has_assessments | Assessment Result | one-to-many |
| has_competencies | Competency State | one-to-many |
| has_portfolio | Portfolio Evidence | one-to-many |
| has_interventions | Intervention | one-to-many |
| has_career_profile | Career Profile | one-to-one |

---

## 2. Teacher

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/teacher.json",
  "id": "string (URN: urn:eduis:teacher:{country}:{institution}:{local_id})",
  "version": "1.0",
  "personal": {
    "given_name": "string (required)",
    "family_name": "string (required)",
    "other_names": "string | null",
    "gender": "male | female | not_specified",
    "date_of_birth": "date | null",
    "phone": "string (E.164)",
    "email": "string"
  },
  "professional": {
    "tsc_number": "string | null",
    "tsc_registration_status": "registered | pending | not_registered | suspended",
    "employment_type": "permanent | contract | volunteer | visiting",
    "employment_date": "date | null",
    "employment_status": "active | on_leave | resigned | retired",
    "current_school_id": "string (URN)",
    "teaching_subjects": ["string"],
    "teaching_grades": ["integer"],
    "seniority_level": "teacher | senior_teacher | head_of_department | deputy_head | head_teacher",
    "department": "string | null"
  },
  "qualifications": [
    {
      "id": "string",
      "type": "phd | masters | bachelors | diploma | certificate | other",
      "field_of_study": "string",
      "institution": "string",
      "graduation_year": "integer",
      "verified": "boolean"
    }
  ],
  "professional_development": [
    {
      "id": "string",
      "title": "string",
      "provider": "string",
      "date": "date",
      "hours": "integer",
      "certificate_id": "string | null"
    }
  ],
  "assignments": [
    {
      "class_id": "string",
      "subject": "string",
      "academic_year": "string",
      "term": "integer",
      "is_class_teacher": "boolean"
    }
  ],
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime",
    "tenant_id": "string"
  }
}
```

---

## 3. School

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/school.json",
  "id": "string (URN: urn:eduis:school:{country}:{registration_code})",
  "version": "1.0",
  "official": {
    "name": "string (required)",
    "local_name": "string | null",
    "registration_number": "string | null",
    "knec_code": "string | null",
    "nemis_code": "string | null",
    "tsc_code": "string | null",
    "school_type": "nursery | primary | junior_secondary | secondary | integrated | special",
    "school_category": "public | private | faith_based | community | international",
    "ownership": "government | private | religious_organisation | community | ngo",
    "curriculum_systems": ["CBC", "8-4-4", "IGCSE", "IB"],
    "gender_composition": "boys | girls | mixed"
  },
  "location": {
    "country": "string (ISO 3166-1 alpha-2)",
    "province": "string | null",
    "county": "string | null",
    "sub_county": "string | null",
    "ward": "string | null",
    "village": "string | null",
    "address": "string | null",
    "postal_code": "string | null",
    "coordinates": {
      "latitude": "number | null",
      "longitude": "number | null"
    },
    "nearest_town": "string | null",
    "distance_from_town_km": "number | null"
  },
  "contact": {
    "phone": "string (E.164) | null",
    "email": "string | null",
    "website": "string | null"
  },
  "infrastructure": {
    "has_electricity": "boolean",
    "has_internet": "boolean",
    "internet_type": "fibre | 4g | 3g | satellite | none | null",
    "computer_lab": "boolean",
    "library": "boolean"
  },
  "academic_calendar": {
    "year": "integer",
    "terms": [
      {
        "term": "integer",
        "start_date": "date",
        "end_date": "date",
        "opening_day": "date",
        "closing_day": "date",
        "holiday_dates": ["date"]
      }
    ]
  },
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime",
    "verified": "boolean",
    "verified_at": "datetime | null"
  }
}
```

---

## 4. Assessment

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/assessment.json",
  "id": "string",
  "version": "1.0",
  "type": "formative | summative | diagnostic | portfolio | holistic | examination",
  "title": "string",
  "description": "string | null",
  "curriculum_refs": [
    {
      "curriculum_system": "CBC | 8-4-4 | IGCSE | IB",
      "grade": "integer",
      "subject": "string",
      "strand_id": "string | null",
      "sub_strand_id": "string | null",
      "learning_outcome_id": "string | null"
    }
  ],
  "authored_by": "string (teacher URN)",
  "school_id": "string",
  "academic_year": "string",
  "term": "integer | null",
  "configuration": {
    "time_limit_minutes": "integer | null",
    "attempts_allowed": "integer (default: 1)",
    "shuffle_questions": "boolean (default: false)",
    "show_feedback_immediately": "boolean",
    "marking_scheme": "automatic | teacher | moderated"
  },
  "sharing": {
    "visibility": "private | school | district | public",
    "shared_with": ["string (school URNs)"]
  },
  "sections": [
    {
      "id": "string",
      "title": "string",
      "instruction": "string | null",
      "weight": "number",
      "items": [...]
    }
  ],
  "total_marks": "number",
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime",
    "is_ai_generated": "boolean",
    "ai_model_version": "string | null"
  }
}
```

### Assessment Item Model

```json
{
  "id": "string",
  "section_id": "string",
  "sequence": "integer",
  "item_type": "mcq | multi_select | true_false | short_answer | structured | essay | matching | ordering | fill_blank | diagram | practical | oral",
  "curriculum_refs": [...],
  "bloom_level": "remember | understand | apply | analyze | evaluate | create",
  "cognitive_demand": "low | medium | high",
  "difficulty": "number (0-1, calibrated)",
  "discrimination": "number | null (psychometric)",
  "marks": "number",
  "stem": "string (the question text)",
  "media": [
    {
      "type": "image | audio | video | diagram",
      "url": "string",
      "alt_text": "string"
    }
  ],
  "options": [
    {
      "id": "string",
      "text": "string",
      "is_correct": "boolean",
      "explanation": "string | null"
    }
  ],
  "marking_scheme": {
    "type": "dichotomous | polytomous | rubric",
    "rubric_id": "string | null",
    "partial_credit": "boolean",
    "model_answer": "string | null"
  },
  "special_requirements": {
    "calculator_allowed": "boolean",
    "reference_materials_allowed": "boolean",
    "spoken_response": "boolean"
  }
}
```

---

## 5. Curriculum

See Volume 4 (CBC Intelligence Specification) for the detailed curriculum object model. The abstract curriculum objects are:

```json
{
  "CurriculumSystem": {
    "id": "string",
    "name": "string",
    "country": "string",
    "authority": "string",
    "version": "string",
    "effective_date": "date"
  },
  "CurriculumNode": {
    "id": "string",
    "system_id": "string",
    "node_type": "subject | strand | sub_strand | learning_outcome | performance_indicator",
    "title": "string",
    "description": "string",
    "parent_id": "string | null",
    "prerequisites": ["string"],
    "version": "string"
  }
}
```

---

## 6. Evidence

Evidence is the fundamental unit of competency assessment. It is anything that provides information about a learner's competency state.

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/evidence.json",
  "id": "string",
  "version": "1.0",
  "learner_id": "string",
  "school_id": "string",
  "academic_year": "string",
  "term": "integer",
  "evidence_type": "assessment_result | teacher_observation | portfolio_item | peer_assessment | self_assessment | attendance | engagement",
  "source_id": "string (ID of the source object: assessment_id, observation_id, etc.)",
  "curriculum_refs": [
    {
      "curriculum_ref": "string",
      "performance_level": "below_expectation | approaching_expectation | meeting_expectation | exceeding_expectation",
      "performance_score": "number | null",
      "confidence": "number (0-1)"
    }
  ],
  "core_competency_refs": [
    {
      "competency_id": "string",
      "performance_level": "string",
      "notes": "string | null"
    }
  ],
  "content_summary": "string | null",
  "collected_at": "datetime",
  "collected_by": "string (teacher URN | system)",
  "validated_by": "string | null",
  "validated_at": "datetime | null",
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

---

## 7. Portfolio

A Portfolio is the curated collection of evidence that represents a learner's development over time.

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/portfolio.json",
  "id": "string",
  "learner_id": "string",
  "school_id": "string",
  "academic_year": "string",
  "term": "integer | null",
  "title": "string",
  "description": "string | null",
  "status": "open | submitted | assessed | archived",
  "items": [
    {
      "id": "string",
      "evidence_id": "string",
      "evidence_type": "text | image | audio | video | link | document",
      "title": "string",
      "description": "string | null",
      "content": {
        "url": "string | null",
        "text": "string | null",
        "mime_type": "string | null",
        "size_bytes": "integer | null",
        "thumbnail_url": "string | null"
      },
      "curriculum_refs": [...],
      "learner_reflection": "string | null",
      "submitted_by": "learner | teacher",
      "submitted_at": "datetime",
      "review": {
        "status": "pending | approved | rejected | revision_requested",
        "reviewed_by": "string | null",
        "reviewed_at": "datetime | null",
        "feedback": "string | null"
      }
    }
  ],
  "assessment": {
    "assessed_by": "string | null",
    "assessed_at": "datetime | null",
    "overall_level": "string | null",
    "competency_levels": [...],
    "assessor_comment": "string | null"
  },
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

---

## 8. Competency

A Competency represents a learner's mastery state on a specific curriculum element at a point in time.

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/competency.json",
  "id": "string",
  "learner_id": "string",
  "curriculum_ref": "string",
  "school_id": "string",
  "academic_year": "string",
  "state": {
    "performance_level": "below_expectation | approaching_expectation | meeting_expectation | exceeding_expectation",
    "confidence": "number (0-1)",
    "evidence_count": "integer",
    "evidence_span_days": "integer",
    "trajectory": "improving | stable | declining | insufficient_data",
    "trajectory_confidence": "number (0-1)"
  },
  "evidence_summary": {
    "latest_evidence_at": "datetime",
    "evidence_types": ["assessment_result", "observation", "portfolio"],
    "average_level_numeric": "number (1-4)"
  },
  "prerequisites_state": {
    "all_prerequisites_met": "boolean",
    "unmet_prerequisites": ["string"]
  },
  "last_computed_at": "datetime",
  "model_version": "string",
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

---

## 9. Attendance

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/attendance.json",
  "id": "string",
  "learner_id": "string",
  "school_id": "string",
  "class_id": "string",
  "date": "date",
  "period": {
    "type": "full_day | half_day | lesson",
    "label": "string | null",
    "start_time": "time | null",
    "end_time": "time | null"
  },
  "status": "present | absent_excused | absent_unexcused | late | left_early | unknown",
  "late_minutes": "integer | null",
  "reason": "string | null",
  "reason_category": "illness | family | transport | weather | other | not_given | null",
  "recorded_by": "string",
  "recorded_at": "datetime",
  "verified_by": "string | null",
  "verified_at": "datetime | null"
}
```

### Attendance Summary Object

```json
{
  "learner_id": "string",
  "period": { "from": "date", "to": "date" },
  "total_days": "integer",
  "present_days": "integer",
  "absent_excused_days": "integer",
  "absent_unexcused_days": "integer",
  "late_occasions": "integer",
  "attendance_rate": "number (0-1)",
  "consecutive_absences_current": "integer",
  "maximum_consecutive_absences": "integer"
}
```

---

## 10. Observation

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/observation.json",
  "id": "string",
  "learner_id": "string",
  "teacher_id": "string",
  "class_id": "string",
  "observed_at": "datetime",
  "context": {
    "subject": "string | null",
    "curriculum_ref": "string | null",
    "activity_type": "lesson | assessment | group_work | practical | free_play | null"
  },
  "raw_input": {
    "format": "voice | text | structured_codes",
    "content": "string | object"
  },
  "structured_output": {
    "curriculum_assessments": [
      {
        "curriculum_ref": "string",
        "performance_level": "string",
        "observed_behavior": "string",
        "confidence": "number (0-1)"
      }
    ],
    "core_competency_observations": [
      {
        "competency_id": "string",
        "observation": "string",
        "level": "string | null"
      }
    ],
    "freeform_notes": "string | null"
  },
  "processing": {
    "status": "raw | ai_processed | teacher_reviewed",
    "ai_model_version": "string | null",
    "processed_at": "datetime | null",
    "reviewed_at": "datetime | null"
  },
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

---

## 11. Behavior

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/behavior.json",
  "id": "string",
  "learner_id": "string",
  "school_id": "string",
  "reported_by": "string",
  "incident_date": "date",
  "incident_time": "time | null",
  "category": "positive | concern | neutral",
  "type": "string",
  "description": "string",
  "location": "classroom | playground | corridor | online | offsite | null",
  "witnesses": ["string"],
  "severity": "minor | moderate | serious | critical | null",
  "action_taken": "string | null",
  "follow_up_required": "boolean",
  "follow_up_completed": "boolean",
  "parent_notified": "boolean",
  "parent_notified_at": "datetime | null",
  "confidential": "boolean",
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

---

## 12. Intervention

See Volume 3, Section 7 (Intervention API) for the canonical Intervention model.

---

## 13. Career Profile

### Canonical Model

```json
{
  "$schema": "https://eduis.org/schemas/v1/career-profile.json",
  "id": "string",
  "learner_id": "string",
  "version": "1.0",
  "interests": [
    {
      "career_id": "string",
      "career_title": "string",
      "interest_level": "exploring | curious | interested | committed",
      "stated_at": "datetime",
      "source": "self_stated | counsellor_suggested | system_recommended"
    }
  ],
  "subject_preferences": {
    "preferred": ["string"],
    "disliked": ["string"],
    "aspirational": ["string"]
  },
  "competency_matches": [
    {
      "career_id": "string",
      "career_title": "string",
      "match_score": "number (0-1)",
      "match_basis": "current_competency | trajectory | combined",
      "gap_count": "integer",
      "computed_at": "datetime"
    }
  ],
  "pathway_plan": {
    "target_career_id": "string | null",
    "target_career_title": "string | null",
    "target_institution": "string | null",
    "target_programme": "string | null",
    "planned_subject_choices": ["string"],
    "development_actions": [
      {
        "action": "string",
        "target_competency": "string",
        "priority": "high | medium | low",
        "status": "pending | in_progress | completed"
      }
    ],
    "last_updated": "datetime",
    "updated_by": "learner | counsellor | system"
  },
  "life_goals": {
    "aspirations": ["string"],
    "values": ["string"],
    "constraints": ["string"]
  },
  "metadata": {
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

---

## 14. Learning Analytics

### Canonical Model: Learner Analytics Summary

```json
{
  "$schema": "https://eduis.org/schemas/v1/learning-analytics.json",
  "id": "string",
  "learner_id": "string",
  "computed_at": "datetime",
  "period": { "from": "date", "to": "date" },
  "engagement": {
    "login_frequency_per_week": "number",
    "average_session_minutes": "number",
    "assignment_completion_rate": "number (0-1)",
    "average_submission_latency_hours": "number",
    "help_seeking_events": "integer",
    "peer_collaboration_events": "integer"
  },
  "performance": {
    "average_assessment_score": "number | null",
    "assessment_count": "integer",
    "competency_gains": "integer",
    "competency_declines": "integer",
    "below_expectation_rate": "number (0-1)",
    "meeting_or_above_rate": "number (0-1)"
  },
  "risk": {
    "current_score": "integer (0-100)",
    "current_level": "low | moderate | elevated | critical",
    "trend": "improving | stable | worsening",
    "primary_factors": ["string"],
    "last_computed": "datetime"
  },
  "trajectory": {
    "grade_start_average": "number | null",
    "current_average": "number | null",
    "projected_end_average": "number | null",
    "trend": "improving | stable | declining"
  }
}
```

---

## Interoperability Notes

### Identifier Strategy

All canonical objects use URN-format identifiers that are:
- Globally unique (no collision across implementations)
- Stable (do not change when a learner moves between schools)
- Self-describing (the URN encodes country, institution type, and local identifier)

Example: `urn:eduis:learner:ke:school:abc123`

### Field Presence

All canonical objects use the following field presence conventions:
- **Required fields** — must be present in all valid instances
- **Optional fields with null** — explicitly represented when not applicable
- **Omitted fields** — absent means not yet collected, not that the field is null

### Extension Pattern

Canonical objects can be extended with system-specific fields using a namespaced `extensions` property:

```json
{
  "id": "...",
  "...standard fields...",
  "extensions": {
    "com.myerp": {
      "internal_student_number": "ST001234",
      "hostel": "Block A"
    }
  }
}
```

Extensions are ignored by systems that do not understand them, preserving forward compatibility.

---

*EduNexus Standards Series — Volume 7: Educational Data Standards*

*Edition 1.0 — June 2026*
