// lib/config/careerCohort.ts
//
// Cohort-relative capability (FIX 5 of the Career Intelligence corrective pass).
//
// Below this many learners with evidence in a school + grade cohort, no
// percentile is computed: a rank among a handful of peers says more about who
// happened to be assessed than about the learner, and would be presented with
// a precision it does not have. The same floor applies per dimension — a
// dimension needs this many cohort members with evidence for it.

export const COHORT_RELATIVE_MIN_LEARNERS = 15
