// lib/assignments/printRouteContent.ts
//
// Printable Adaptive Assignments pilot — route content generation.
//
// Stage 0 finding this file exists to correct: lib/assignments/pdfRenderer.ts's
// buildTasks()/buildEnrichmentTasks() GENERATE replacement questions from a
// bare `topic` string (only Level 3 quotes the first 100 characters of the
// real `instructions`) — they do not preserve what the teacher actually
// wrote. Reusing them as-is for "Core Practice" would violate the pilot's
// own generation rule ("Core Practice: closest to the teacher's original
// assignment"). This file's three functions instead treat the teacher's
// real `instructions` text as the one anchor every route is built around —
// generation only ADDS scaffolding (Guided) or an extra deepening prompt
// (Extension) around that real text; it never substitutes a fabricated
// question set for it. `pdfRenderer.ts` itself is untouched — its existing
// callers (the manual per-level "print by level" feature already shipped
// on the assignment detail page) keep their current behavior unchanged.
//
// Content stays a draft until a teacher approves it (enforced by
// lib/assignments/printRoutes.ts + the DB trigger on assignment_print_runs)
// — generation here never claims to BE the teacher's assignment; it is a
// proposal the teacher must review and may freely edit before approval.

import type { AssignmentSnapshot, PrintRoute } from '@/lib/repositories/assignmentPrintRun.repository'

const GUIDED_SCAFFOLD_INTRO =
  'Before you start: read the task below one step at a time. Use your notes and any examples from class to help you. It is okay to work through this slowly.'

const GUIDED_WORKED_EXAMPLE_PROMPT =
  'Worked example first: with a teacher, parent, or classmate, talk through one example related to this task before attempting it on your own.'

const EXTENSION_DEEPEN_PROMPT = (topic: string) =>
  `Once you have completed the task above, go further: explain how ${topic} connects to something else you have learned, and justify your thinking in your own words.`

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function renderInstructionsBlock(instructions: string): string {
  return `<div class="task-instructions">${escapeHtml(instructions)}</div>`
}

/**
 * One route's printable body — real assignment instructions preserved
 * verbatim, with only genuinely additive framing per route. Returns an
 * HTML fragment (not a full document — the combined class-set document
 * wraps these, see lib/assignments/printRoutePdf.ts).
 */
export function buildRouteBody(assignment: AssignmentSnapshot, route: PrintRoute): string {
  const instructions = renderInstructionsBlock(assignment.instructions)

  if (route === 'guided') {
    return `
      <div class="route-scaffold">${escapeHtml(GUIDED_SCAFFOLD_INTRO)}</div>
      <div class="route-scaffold route-scaffold-example">${escapeHtml(GUIDED_WORKED_EXAMPLE_PROMPT)}</div>
      ${instructions}
      <div class="answer-lines">${Array.from({ length: 8 }, () => '<div class="ans-line"></div>').join('')}</div>
    `
  }

  if (route === 'extension') {
    return `
      ${instructions}
      <div class="answer-lines">${Array.from({ length: 5 }, () => '<div class="ans-line"></div>').join('')}</div>
      <div class="route-extension">${escapeHtml(EXTENSION_DEEPEN_PROMPT(assignment.topic || assignment.subject))}</div>
      <div class="answer-lines">${Array.from({ length: 5 }, () => '<div class="ans-line"></div>').join('')}</div>
    `
  }

  // core — closest to the teacher's original assignment: real instructions,
  // light organization, no added scaffolding or extension prompts.
  return `
    ${instructions}
    <div class="answer-lines">${Array.from({ length: 8 }, () => '<div class="ans-line"></div>').join('')}</div>
  `
}
