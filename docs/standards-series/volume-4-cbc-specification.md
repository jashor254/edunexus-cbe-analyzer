# EduNexus Standards Series

## Volume 4 — CBC Intelligence Specification

### The Canonical Machine-Readable Representation of Kenya's Competency Based Curriculum

**Edition 1.0 — June 2026**

---

> *A curriculum document is a human artifact. A curriculum specification is a machine-readable contract. Both must be accurate. Only the specification can drive software.*

---

## Preface

Kenya's Competency Based Curriculum is described in official documents published by the Kenya Institute of Curriculum Development (KICD). These documents are authoritative for human interpretation. They are not designed for machine consumption.

This volume defines the CBC Intelligence Specification (CBCIS) — the canonical machine-readable representation of the CBC curriculum for use in educational software systems. The specification is derived from official KICD documents and validated against the professional judgment of practicing CBC teachers and curriculum experts.

The CBCIS defines:
- The structural hierarchy of the CBC curriculum
- The competency framework
- Performance indicator definitions
- Assessment model specification
- Coverage rules
- Progression model
- Validation rules
- Machine-readable schema

Any educational software system claiming CBC alignment should be able to validate that claim against the CBCIS. Any AI-generated educational content should be validated against the CBCIS before delivery to teachers or learners.

---

## Part 1 — Curriculum Hierarchy

### 1.1 Structural Overview

The CBC curriculum is organized in a hierarchy. The CBCIS models this hierarchy as a directed acyclic graph (DAG) with typed nodes and typed edges.

```
CBC Curriculum
  └── Level (Junior School, Senior School)
        └── Grade (Grade 7, Grade 8, Grade 9, Grade 10, Grade 11, Grade 12)
              └── Subject (Mathematics, English, Science and Technology, ...)
                    └── Strand (e.g., Strand 3: Algebra)
                          └── Sub-Strand (e.g., Sub-Strand 3.2: Linear Equations)
                                └── Learning Outcome (specific, measurable outcome)
                                      └── Performance Indicator (level-specific descriptor)
```

### 1.2 Node Type Definitions

#### Level Node

```json
{
  "node_type": "level",
  "id": "CBC_JUNIOR",
  "label": "Junior School",
  "grades": ["CBC_GRADE_7", "CBC_GRADE_8", "CBC_GRADE_9"],
  "age_range": { "min": 12, "max": 14 },
  "description": "The Junior School level covers Grades 7–9 and provides a broad-based curriculum emphasizing core competencies."
}
```

#### Grade Node

```json
{
  "node_type": "grade",
  "id": "CBC_GRADE_8",
  "level_id": "CBC_JUNIOR",
  "label": "Grade 8",
  "typical_age": 13,
  "subjects": ["CBC_G8_MATHS", "CBC_G8_ENGLISH", "CBC_G8_SCI", "CBC_G8_SST", "CBC_G8_CRE", "CBC_G8_IRE", "CBC_G8_HRE", "CBC_G8_AGRI", "CBC_G8_HOME_SCIENCE", "CBC_G8_ART_CRAFT", "CBC_G8_MUSIC", "CBC_G8_PHE", "CBC_G8_KISWAHILI"]
}
```

#### Subject Node

```json
{
  "node_type": "subject",
  "id": "CBC_G8_MATHS",
  "grade_id": "CBC_GRADE_8",
  "label": "Mathematics",
  "code": "MATHS",
  "category": "core",
  "weekly_lessons": 5,
  "strands": ["CBC_G8_MATHS_S1", "CBC_G8_MATHS_S2", "CBC_G8_MATHS_S3", "CBC_G8_MATHS_S4", "CBC_G8_MATHS_S5"],
  "kicd_document_reference": "Mathematics Curriculum Design, Grade 8, 2019"
}
```

#### Strand Node

```json
{
  "node_type": "strand",
  "id": "CBC_G8_MATHS_S3",
  "subject_id": "CBC_G8_MATHS",
  "label": "Strand 3",
  "title": "Algebra",
  "description": "This strand develops learners' algebraic thinking, including manipulation of algebraic expressions, linear equations, and introduction to quadratic concepts.",
  "sub_strands": ["CBC_G8_MATHS_S3_SS1", "CBC_G8_MATHS_S3_SS2", "CBC_G8_MATHS_S3_SS3"],
  "term_sequence": { "term_1": ["SS1"], "term_2": ["SS2"], "term_3": ["SS3"] }
}
```

#### Sub-Strand Node

```json
{
  "node_type": "sub_strand",
  "id": "CBC_G8_MATHS_S3_SS2",
  "strand_id": "CBC_G8_MATHS_S3",
  "label": "Sub-Strand 3.2",
  "title": "Linear Equations in One Unknown",
  "description": "Learners form and solve linear equations in one unknown, interpreting equations as mathematical models of real-world situations.",
  "prerequisites": ["CBC_G8_MATHS_S3_SS1"],
  "learning_outcomes": ["CBC_G8_MATHS_S3_SS2_LO1", "CBC_G8_MATHS_S3_SS2_LO2", "CBC_G8_MATHS_S3_SS2_LO3"],
  "recommended_lessons": 8,
  "kicd_document_reference": "Mathematics Curriculum Design, Grade 8, p. 47"
}
```

#### Learning Outcome Node

```json
{
  "node_type": "learning_outcome",
  "id": "CBC_G8_MATHS_S3_SS2_LO1",
  "sub_strand_id": "CBC_G8_MATHS_S3_SS2",
  "sequence": 1,
  "statement": "By the end of the sub-strand, the learner should be able to form linear equations in one unknown from given situations.",
  "performance_indicators": {
    "below_expectation": "CBC_G8_MATHS_S3_SS2_LO1_PI_BE",
    "approaching_expectation": "CBC_G8_MATHS_S3_SS2_LO1_PI_AE",
    "meeting_expectation": "CBC_G8_MATHS_S3_SS2_LO1_PI_ME",
    "exceeding_expectation": "CBC_G8_MATHS_S3_SS2_LO1_PI_EE"
  },
  "assessment_types": ["written", "observation", "oral"],
  "bloom_level": "apply"
}
```

#### Performance Indicator Node

```json
{
  "node_type": "performance_indicator",
  "id": "CBC_G8_MATHS_S3_SS2_LO1_PI_ME",
  "learning_outcome_id": "CBC_G8_MATHS_S3_SS2_LO1",
  "level": "meeting_expectation",
  "descriptor": "The learner accurately forms linear equations in one unknown from given word problems and simple real-world situations independently.",
  "observable_behaviors": [
    "Correctly identifies the unknown and assigns a variable",
    "Translates verbal statements into algebraic equations",
    "Checks solutions by substitution"
  ],
  "example_evidence": [
    "Solves 3 out of 4 given word problems by correctly forming and solving the equation",
    "Explains their reasoning verbally when asked"
  ]
}
```

---

## Part 2 — Competency Framework

### 2.1 Core Competencies

The CBC identifies seven core competencies that cut across all subjects and strands. These competencies are not assessed separately from subject content — they are developed through subject-based learning and assessed alongside subject competencies.

```json
{
  "core_competencies": [
    {
      "id": "CBC_CC_COMM",
      "label": "Communication and Collaboration",
      "description": "The ability to communicate clearly and effectively in different contexts and with different audiences, and to work collaboratively with others.",
      "sub_competencies": [
        "Listening and speaking",
        "Reading and writing",
        "Collaboration and teamwork",
        "Digital communication"
      ]
    },
    {
      "id": "CBC_CC_CRIT",
      "label": "Critical Thinking and Problem Solving",
      "description": "The ability to analyze information, evaluate arguments, and apply reasoning to solve problems.",
      "sub_competencies": [
        "Analytical thinking",
        "Creative thinking",
        "Reflective thinking",
        "Transfer of learning"
      ]
    },
    {
      "id": "CBC_CC_IMAG",
      "label": "Imagination and Creativity",
      "description": "The ability to generate novel ideas, explore possibilities, and create innovative solutions.",
      "sub_competencies": [
        "Creative expression",
        "Innovation",
        "Entrepreneurial thinking"
      ]
    },
    {
      "id": "CBC_CC_CITZ",
      "label": "Citizenship",
      "description": "The development of national identity, respect for others, and active participation in civic life.",
      "sub_competencies": [
        "Social cohesion",
        "Rights and responsibilities",
        "Environmental stewardship",
        "Global citizenship"
      ]
    },
    {
      "id": "CBC_CC_DIGI",
      "label": "Digital Literacy",
      "description": "The ability to use digital tools effectively, ethically, and safely.",
      "sub_competencies": [
        "Information literacy",
        "Media literacy",
        "Digital citizenship",
        "Computational thinking"
      ]
    },
    {
      "id": "CBC_CC_LEARN",
      "label": "Learning to Learn",
      "description": "Metacognitive skills: the ability to plan, monitor, and evaluate one's own learning.",
      "sub_competencies": [
        "Self-management",
        "Goal setting",
        "Reflective learning",
        "Resilience"
      ]
    },
    {
      "id": "CBC_CC_SELF",
      "label": "Self-Efficacy",
      "description": "Belief in one's ability to achieve goals, manage challenges, and take responsibility for one's development.",
      "sub_competencies": [
        "Confidence",
        "Emotional intelligence",
        "Health and wellness",
        "Entrepreneurship"
      ]
    }
  ]
}
```

### 2.2 Values Framework

The CBC also defines values that educational programmes should develop. These are assessed observationally and recorded in holistic assessments.

```json
{
  "values": [
    { "id": "CBC_VAL_LOVE", "label": "Love" },
    { "id": "CBC_VAL_RESP", "label": "Responsibility" },
    { "id": "CBC_VAL_RESP2", "label": "Respect" },
    { "id": "CBC_VAL_UNITY", "label": "Unity" },
    { "id": "CBC_VAL_PEACE", "label": "Peace" },
    { "id": "CBC_VAL_PATRIOT", "label": "Patriotism" },
    { "id": "CBC_VAL_SOCIAL", "label": "Social Justice" },
    { "id": "CBC_VAL_INTEGR", "label": "Integrity" }
  ]
}
```

### 2.3 Pertinent and Contemporary Issues (PCIs)

PCIs are cross-cutting themes that must be addressed across subjects throughout the curriculum. They are not separate subjects but must be integrated into subject teaching.

```json
{
  "pertinent_contemporary_issues": [
    { "id": "PCI_ENVIRO", "label": "Environmental Education" },
    { "id": "PCI_PEACE", "label": "Peace Education" },
    { "id": "PCI_GENDER", "label": "Gender" },
    { "id": "PCI_FINANCIAL", "label": "Financial Literacy" },
    { "id": "PCI_DRUG", "label": "Drug and Substance Abuse Prevention" },
    { "id": "PCI_DISASTER", "label": "Disaster Risk Reduction" },
    { "id": "PCI_HIV", "label": "HIV and AIDS Education" },
    { "id": "PCI_CANCER", "label": "Cancer Prevention" },
    { "id": "PCI_INCLUSIVE", "label": "Inclusivity" },
    { "id": "PCI_COHESION", "label": "Social Cohesion" },
    { "id": "PCI_SAFETY", "label": "Child Online Safety" },
    { "id": "PCI_DIGITAL", "label": "Digital Literacy" }
  ]
}
```

---

## Part 3 — Assessment Model

### 3.1 Assessment Philosophy

The CBC assessment model is based on continuous and comprehensive assessment rather than examination-only assessment. Key principles:

- **Formative assessment** is continuous and informs teaching.
- **Summative assessment** occurs at defined points (end of term, end of year) but is not the only measure.
- **Portfolio assessment** accumulates evidence over time.
- **Observation** is a valid and required form of assessment.
- **Performance levels** replace marks or percentages as the primary reporting unit.

### 3.2 Performance Level Definitions

```json
{
  "performance_levels": [
    {
      "level": "exceeding_expectation",
      "code": "EE",
      "numeric_code": 4,
      "general_descriptor": "The learner consistently demonstrates the learning outcome independently and can extend their understanding to novel contexts, support peers, or go beyond what was taught.",
      "reporting_language": {
        "teacher_to_parent": "Your child exceeds expectations in this area and demonstrates exceptional understanding.",
        "teacher_internal": "Learner demonstrates mastery and can apply learning in novel contexts.",
        "learner_facing": "You are doing excellent work in this area and are ready for more challenge."
      }
    },
    {
      "level": "meeting_expectation",
      "code": "ME",
      "numeric_code": 3,
      "general_descriptor": "The learner consistently demonstrates the learning outcome independently in familiar contexts.",
      "reporting_language": {
        "teacher_to_parent": "Your child is meeting expectations in this area.",
        "teacher_internal": "Learner demonstrates the expected competency independently.",
        "learner_facing": "You are doing well in this area and meeting the expected standard."
      }
    },
    {
      "level": "approaching_expectation",
      "code": "AE",
      "numeric_code": 2,
      "general_descriptor": "The learner demonstrates some evidence of the learning outcome but requires support or makes inconsistent errors.",
      "reporting_language": {
        "teacher_to_parent": "Your child is developing in this area and may benefit from additional support.",
        "teacher_internal": "Learner shows partial understanding; targeted support recommended.",
        "learner_facing": "You are making progress in this area. A little more practice will get you there."
      }
    },
    {
      "level": "below_expectation",
      "code": "BE",
      "numeric_code": 1,
      "general_descriptor": "The learner does not yet demonstrate the learning outcome and requires significant support.",
      "reporting_language": {
        "teacher_to_parent": "Your child needs additional support in this area. Please speak with the teacher about how you can help at home.",
        "teacher_internal": "Learner requires intensive support; remedial intervention recommended.",
        "learner_facing": "This is an area where you need more practice. Your teacher will help you."
      }
    }
  ]
}
```

### 3.3 Assessment Types Specification

```json
{
  "assessment_types": [
    {
      "type": "observation",
      "description": "Teacher observation of learner behavior during learning activities",
      "evidence_format": "narrative | checklist | rating_scale",
      "appropriate_for": ["practical_skills", "attitudes", "values", "core_competencies", "oral_work"],
      "documentation": "Observation record form or anecdotal notes",
      "validity_requirements": "Must reference specific observable behaviors from performance indicators"
    },
    {
      "type": "written",
      "description": "Learner-produced written work assessed against a marking scheme or rubric",
      "evidence_format": "marked_script | rubric_assessment",
      "appropriate_for": ["knowledge_recall", "conceptual_understanding", "analytical_writing", "mathematical_reasoning"],
      "documentation": "Marked script with marks/levels recorded"
    },
    {
      "type": "oral",
      "description": "Spoken assessment: oral questions, presentations, or discussions",
      "evidence_format": "teacher_record | recorded_audio",
      "appropriate_for": ["language_competency", "communication", "reading_fluency", "explanation"]
    },
    {
      "type": "project",
      "description": "Extended task completed over time, assessed against a rubric",
      "evidence_format": "product + process_documentation",
      "appropriate_for": ["creative_competencies", "research", "problem_solving", "integration_across_strands"]
    },
    {
      "type": "portfolio",
      "description": "Curated collection of evidence demonstrating competency development over time",
      "evidence_format": "collection + reflections",
      "appropriate_for": ["holistic_competency_development", "growth_over_time"]
    },
    {
      "type": "peer",
      "description": "Learner-to-learner assessment validated by teacher",
      "evidence_format": "peer_rating + teacher_validation",
      "appropriate_for": ["collaborative_work", "communication", "presentation_skills"],
      "validation_requirement": "Teacher must verify peer assessments before recording"
    }
  ]
}
```

### 3.4 Assessment Schedule Specification

```json
{
  "assessment_schedule": {
    "continuous_assessment": {
      "frequency": "ongoing",
      "minimum_evidence_per_sub_strand": 2,
      "recommended_evidence_per_sub_strand": 3,
      "acceptable_evidence_span_days": 21
    },
    "formative_assessment": {
      "frequency": "at_least_weekly",
      "documentation_required": true,
      "feeds_into_learner_model": true
    },
    "summative_assessment": {
      "frequency": "end_of_term",
      "scope": "all_sub_strands_taught_in_term",
      "format": "school_determined",
      "reporting_unit": "performance_level"
    },
    "holistic_assessment": {
      "frequency": "end_of_term",
      "scope": "core_competencies_and_values",
      "format": "narrative_report"
    }
  }
}
```

---

## Part 4 — Coverage Rules

Coverage rules define what must be taught and assessed within each academic period.

### 4.1 Term Coverage Requirements

```json
{
  "coverage_rules": {
    "term": {
      "requirement": "All sub-strands in the scheme of work for the term must be taught. A minimum of 80% of sub-strands must have at least one formative assessment record.",
      "scheme_of_work_required": true,
      "minimum_coverage_percentage": 80,
      "alert_threshold_percentage": 70
    },
    "year": {
      "requirement": "All sub-strands in the curriculum for the subject and grade must be taught across the three terms combined.",
      "strands_per_term": "see strand.term_sequence field",
      "flexibility": "Term sequence may be adjusted by the teacher with head teacher approval, provided all sub-strands are covered within the year."
    }
  }
}
```

### 4.2 Prerequisite Enforcement Rules

```json
{
  "prerequisite_rules": {
    "enforcement_mode": "advisory",
    "description": "Sub-strands with prerequisites SHOULD be taught after their prerequisites. The system flags but does not block teaching a dependent sub-strand before its prerequisite.",
    "warning_threshold": "If a teacher schedules a sub-strand before its prerequisite, the system displays a warning and records the deviation.",
    "learner_readiness": "If a learner does not have the prerequisite competency, the system marks them as needing prerequisite remediation before the current sub-strand."
  }
}
```

---

## Part 5 — Progression Model

### 5.1 Grade Progression

```json
{
  "grade_progression": {
    "junior_to_senior": {
      "from_grades": ["CBC_GRADE_7", "CBC_GRADE_8", "CBC_GRADE_9"],
      "to_grades": ["CBC_GRADE_10", "CBC_GRADE_11", "CBC_GRADE_12"],
      "progression_requirement": "Automatic on completion of Grade 9, subject to national assessment.",
      "national_assessment": "Kenya Junior School Assessment (KJSA) at end of Grade 9",
      "pathways": {
        "stem": { "qualifying_subjects": ["Mathematics", "Science and Technology"] },
        "humanities": { "qualifying_subjects": ["Social Studies", "Languages"] },
        "arts_sports": { "qualifying_subjects": ["Creative Arts", "Physical Education"] },
        "tvet": { "qualifying_subjects": ["Pre-Technical Studies"] }
      }
    }
  }
}
```

### 5.2 Within-Grade Progression

Within a grade, learners are expected to progress through sub-strands in the sequence defined by the scheme of work. However, the CBC does not have a formal gate mechanism within a grade — all learners in a class are taught the same curriculum, with differentiation in how it is delivered and the level of support provided.

```json
{
  "within_grade_progression": {
    "model": "whole_class_with_differentiation",
    "description": "All learners in a class experience the same curriculum in the same sequence. Differentiation in pedagogy and support addresses individual learner needs rather than creating different curriculum tracks within a class.",
    "differentiation_types": [
      { "type": "remedial", "for": "below_expectation learners", "approach": "Additional support, simplified tasks, peer support" },
      { "type": "standard", "for": "approaching and meeting expectation", "approach": "Standard curriculum delivery" },
      { "type": "extension", "for": "exceeding expectation", "approach": "Enrichment tasks, peer mentoring, deeper exploration" }
    ]
  }
}
```

---

## Part 6 — Validation Rules

CBCIS validation rules define the constraints that must be satisfied for a curriculum reference or educational content to be considered valid.

### 6.1 Reference Validation Rules

```json
{
  "reference_validation_rules": [
    {
      "rule_id": "REF_001",
      "name": "Node existence",
      "description": "Every curriculum node ID referenced in content must exist in the CBCIS.",
      "severity": "error",
      "check": "curriculum_node_exists(node_id)"
    },
    {
      "rule_id": "REF_002",
      "name": "Grade-subject consistency",
      "description": "A sub-strand reference must be consistent with the claimed grade and subject.",
      "severity": "error",
      "check": "sub_strand.subject_id == claimed_subject AND sub_strand.grade_id == claimed_grade"
    },
    {
      "rule_id": "REF_003",
      "name": "Performance level validity",
      "description": "Assessment records must use one of the four valid performance levels.",
      "severity": "error",
      "check": "performance_level IN ['below_expectation', 'approaching_expectation', 'meeting_expectation', 'exceeding_expectation']"
    },
    {
      "rule_id": "REF_004",
      "name": "Prerequisite sequence",
      "description": "A lesson plan or scheme of work should not schedule a sub-strand before its prerequisites.",
      "severity": "warning",
      "check": "FOR ALL prereq IN sub_strand.prerequisites: prereq is scheduled before sub_strand"
    }
  ]
}
```

### 6.2 Content Validation Rules

```json
{
  "content_validation_rules": [
    {
      "rule_id": "CONT_001",
      "name": "Learning outcome reference accuracy",
      "description": "Content that claims to address a learning outcome must actually address it.",
      "severity": "warning",
      "check": "ai_alignment_score(content, learning_outcome) >= 0.7",
      "note": "Requires AI evaluation"
    },
    {
      "rule_id": "CONT_002",
      "name": "No invented curriculum elements",
      "description": "Content must not reference learning outcomes, sub-strands, or strands that do not exist.",
      "severity": "error",
      "check": "ALL curriculum_refs_in_content are_valid_according_to REF_001"
    },
    {
      "rule_id": "CONT_003",
      "name": "Age appropriateness",
      "description": "Content must be appropriate for the grade level specified.",
      "severity": "warning",
      "check": "reading_level(content) WITHIN expected_range(grade)"
    },
    {
      "rule_id": "CONT_004",
      "name": "Assessment type appropriateness",
      "description": "Assessment items must use types appropriate for the claimed learning outcome.",
      "severity": "warning",
      "check": "assessment_type IN learning_outcome.assessment_types"
    }
  ]
}
```

---

## Part 7 — Curriculum Ontology

The CBC curriculum as an ontological model expresses relationships between concepts that go beyond the structural hierarchy.

### 7.1 Concept Graph

Educational concepts from different subjects are related through the curriculum ontology. For example:

- Grade 8 Mathematics Linear Equations (CBC_G8_MATHS_S3_SS2) relates to Grade 8 Science and Technology "representing quantitative relationships graphically"
- Grade 8 English "formal writing" relates to report writing in Science and Social Studies

The concept graph enables:
- Cross-subject lesson integration suggestions
- Identification of concepts taught in multiple subjects
- Career pathway mapping through concept networks

### 7.2 Bloom's Taxonomy Mapping

Each learning outcome in the CBCIS is mapped to a Bloom's Taxonomy level:

| Bloom Level | CBC Examples |
|---|---|
| Remember | "Identify types of energy", "State Ohm's Law" |
| Understand | "Explain the water cycle", "Describe properties of matter" |
| Apply | "Solve linear equations", "Apply budgeting principles" |
| Analyze | "Compare and contrast two ecosystems", "Examine primary sources" |
| Evaluate | "Assess the impact of human activity on the environment" |
| Create | "Design an experiment", "Compose a poem", "Build a model" |

AI-generated assessments must ensure Bloom's level distribution appropriate to the learning outcome:
- Most assessment items should be at or above the Bloom's level of the learning outcome
- At least one item per sub-strand assessment should be at Apply level or above

---

## Part 8 — Machine-Readable Specification

The complete CBCIS is available in three machine-readable formats:

### 8.1 JSON Schema

The CBCIS JSON Schema defines the structure of all node types and provides validation for any curriculum reference claim.

Available at: `/curriculum/specifications/CBC/schema.json`

### 8.2 RDF / OWL Ontology

The CBCIS is also published as an OWL ontology for semantic web applications and linked data integration.

Available at: `/curriculum/specifications/CBC/ontology.owl`

### 8.3 SQL Seed Data

For self-hosted implementations, the complete CBCIS is available as a PostgreSQL seed migration.

Available at: `/curriculum/specifications/CBC/seed.sql`

### 8.4 Validation API

```
POST /curriculum/specifications/CBC/validate
{
  "reference": {
    "grade": 8,
    "subject": "mathematics",
    "strand_id": "CBC_G8_MATHS_S3",
    "sub_strand_id": "CBC_G8_MATHS_S3_SS2",
    "learning_outcome_id": "CBC_G8_MATHS_S3_SS2_LO1"
  }
}

Response:
{
  "valid": true,
  "canonical_id": "CBC_G8_MATHS_S3_SS2_LO1",
  "node": { ... }
}
```

---

## Part 9 — Reporting Standards

### 9.1 Term Report Requirements

A CBC-compliant term report must include:

```json
{
  "report_requirements": {
    "per_subject": {
      "competency_summary": {
        "format": "performance_level_per_strand",
        "required": true
      },
      "teacher_comment": {
        "format": "narrative",
        "required": true,
        "guidance": "Must reference specific competencies, not generic statements. Must be learner-specific."
      },
      "teacher_signature": {
        "required": true
      }
    },
    "holistic": {
      "core_competency_summary": {
        "format": "performance_level_per_core_competency",
        "required": true
      },
      "values_observation": {
        "format": "narrative",
        "required": true
      }
    },
    "administrative": {
      "attendance_summary": { "required": true },
      "head_teacher_comment": { "required": true },
      "next_term_report_date": { "required": true }
    }
  }
}
```

### 9.2 Performance Level Reporting Convention

Performance levels in reports must use the standard CBC terminology:

- **Exceeding Expectation (EE)** — not "Excellent" or "Distinction"
- **Meeting Expectation (ME)** — not "Good" or "Pass"
- **Approaching Expectation (AE)** — not "Fair" or "Average"
- **Below Expectation (BE)** — not "Fail" or "Poor"

Systems that display reports to parents should translate these codes to the parent-appropriate language defined in the Performance Level Definitions (Part 3.2), not to examination-era equivalents.

---

*EduNexus Standards Series — Volume 4: CBC Intelligence Specification*

*Edition 1.0 — June 2026*

*This specification is derived from official KICD curriculum documents and validated with practicing teachers and curriculum experts. For matters of official curriculum interpretation, KICD documents are authoritative.*
