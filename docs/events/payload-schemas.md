# Event Payload Schemas

All payloads are JSON objects nested inside the `payload` field of the event record. TypeScript definitions live in `lib/events/types.ts`.

## Base Event Envelope

Every event has this envelope (from `PlatformEventRecord`):

```typescript
{
  id:              string          // UUID
  event_type:      string          // e.g. 'teacher.assessment.created'
  event_version:   string          // '1.0'
  organization_id: string | null
  actor_id:        string | null   // UUID of the user who triggered the event
  resource_type:   string          // e.g. 'assessment'
  resource_id:     string          // UUID or composite key of the resource
  payload:         object          // event-specific data (see below)
  idempotency_key: string | null
  published_at:    string          // ISO 8601
  correlation_id:  string | null
  trace_id:        string | null
  environment:     string | null
}
```

---

## Teacher Payloads

### `teacher.assessment.created`
```typescript
type TeacherAssessmentCreatedPayload = {
  assessment_id:   string
  class_id:        string
  title:           string
  assessment_type: string          // 'exam' | 'cat' | 'midterm' | 'endterm' | 'opener' | 'assignment'
  term:            string          // '1' | '2' | '3'
  year:            number
  subjects:        string[]
  curriculum_type: string          // 'cbc' | '844'
}
```

### `teacher.assessment.published`
```typescript
type TeacherAssessmentPublishedPayload = {
  assessment_id: string
  class_id?:     string
  title?:        string
}
```

### `teacher.lesson_plan.generated`
```typescript
type TeacherLessonPlanGeneratedPayload = {
  lesson_plan_id?:   string
  sow_id?:           string
  subject:           string
  grade:             string
  week_number?:      number
  count?:            number        // number of plans generated in batch
  generation_time_ms?: number
}
```

### `teacher.sow.generated`
```typescript
type TeacherSowGeneratedPayload = {
  sow_id:           string
  title:            string
  subject:          string
  grade:            string
  term:             string
  weeks:            number
  curriculum_type:  string
  generation_time_ms?: number
}
```

### `teacher.assignment.created`
```typescript
type TeacherAssignmentCreatedPayload = {
  assignment_id: string
  class_id:      string
  title:         string
  due_date:      string            // ISO 8601 date
}
```

### `teacher.assignment.graded`
```typescript
type TeacherAssignmentGradedPayload = {
  assignment_id:  string
  submission_id:  string
  student_id:     string
  score?:         number
}
```

---

## Student Payloads

### `student.session.completed`
```typescript
type StudentSessionCompletedPayload = {
  session_id:        string
  student_id:        string
  subject:           string
  exchanges:         number
  duration_seconds?: number
}
```

### `student.assessment.submitted`
```typescript
type StudentAssessmentSubmittedPayload = {
  assessment_id: string
  student_id:    string
  class_id:      string
  mean_score?:   number
}
```

### `student.milestone.achieved`
```typescript
type StudentMilestoneAchievedPayload = {
  mission_id:  string
  student_id?: string
  teacher_id?: string
  module_id:   string
  xp_earned?:  number
}
```

### `student.career_recommendation.updated`
```typescript
type StudentCareerRecommendationUpdatedPayload = {
  student_id:     string
  top_career_slug: string
  match_count:    number
}
```

---

## Billing Payloads

### `billing.payment.succeeded`
```typescript
type BillingPaymentSucceededPayload = {
  reference:       string
  amount_kobo:     number          // amount in smallest currency unit
  currency:        string          // 'KES' | 'NGN'
  plan?:           string          // 'starter' | 'term' | 'family' | 'premium'
  tokens_granted?: number
}
```

### `billing.payment.failed`
```typescript
type BillingPaymentFailedPayload = {
  reference: string
  reason?:   string
}
```

---

## Organization Payloads

### `organization.member.invited`
```typescript
type OrganizationMemberInvitedPayload = {
  school_user_id: string
  user_id:        string
  role:           string           // 'teacher' | 'admin' | 'parent'
  school_id:      string
}
```

### `organization.member.removed`
```typescript
{
  school_user_id: string
}
```

---

## System Payloads

### `system.intelligence.updated`
```typescript
type SystemIntelligenceUpdatedPayload = {
  student_id:     string
  trigger:        string           // 'assessment' | 'compass' | 'formative' | 'parent'
  layers_updated: string[]         // e.g. ['learner_model', 'next_actions', 'career_milestones']
}
```
