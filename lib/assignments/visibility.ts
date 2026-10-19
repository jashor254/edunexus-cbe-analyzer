// lib/assignments/visibility.ts
//
// A paper quick-created from Mark Papers (assignments.origin = 'paper_marking')
// is created 'draft' and stays out of every teacher and learner list until it
// is filed as a topical assignment (status → 'closed'). A paper filed into a
// termly assessment stays 'draft' forever: its marks live in that assessment,
// and showing it as an empty gradebook column or a calendar due date would be
// wrong. See docs/engineering/mark-papers-flow-plan.md.

/** PostgREST `.or()` filter: every assignment except an unfiled (or termly-filed) quick paper. */
export const LISTED_ASSIGNMENTS_FILTER = 'origin.eq.standard,status.neq.draft'
