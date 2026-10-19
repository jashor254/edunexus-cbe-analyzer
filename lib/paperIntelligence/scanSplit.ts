// lib/paperIntelligence/scanSplit.ts
//
// Pure — how a scanned class PDF splits into learners' scripts (Mark Papers
// bulk scan, S1 in docs/engineering/mark-papers-flow-plan.md). The scripts
// were stacked in class-list order with the same number of pages each; a
// learner marked absent has no script in the stack and takes no pages.
//
// Page-count splitting is only as good as the stack: one missing or extra
// page shifts every learner after it. So this never guesses — it reports a
// mismatch between the PDF's page count and what the plan expects, and the
// teacher confirms the split on thumbnails before anything is uploaded. Keep
// blank pages when scanning (blank-page removal breaks the count).

export type ScanLearner = { submissionId: string; name: string; absent: boolean }

export type ScanAssignment = { submissionId: string; name: string; pdfPages: number[] }

export type ScanPlan = {
  assignments: ScanAssignment[]
  /** Pages the plan expects: present learners × pages per learner. */
  expectedPages: number
  /** PDF pages no learner received (the PDF is longer than expected). */
  unassignedPages: number[]
  /** Present learners who got fewer pages than `pagesPerLearner` (the PDF is shorter than expected). */
  shortLearners: string[]
}

export function planScanSplit(totalPages: number, learners: ScanLearner[], pagesPerLearner: number, maxPagesPerScript: number): ScanPlan {
  if (!Number.isInteger(pagesPerLearner) || pagesPerLearner < 1) throw new Error('Pages per learner must be a whole number of at least 1.')
  if (pagesPerLearner > maxPagesPerScript) throw new Error(`A script can have at most ${maxPagesPerScript} pages.`)

  const present = learners.filter(l => !l.absent)
  const assignments: ScanAssignment[] = []
  const shortLearners: string[] = []
  let next = 1
  for (const learner of present) {
    const pdfPages: number[] = []
    for (let i = 0; i < pagesPerLearner && next <= totalPages; i++) pdfPages.push(next++)
    if (pdfPages.length === 0) { shortLearners.push(learner.name); continue }
    if (pdfPages.length < pagesPerLearner) shortLearners.push(learner.name)
    assignments.push({ submissionId: learner.submissionId, name: learner.name, pdfPages })
  }
  const unassignedPages: number[] = []
  for (let p = next; p <= totalPages; p++) unassignedPages.push(p)

  return { assignments, expectedPages: present.length * pagesPerLearner, unassignedPages, shortLearners }
}

/** A first guess at pages per learner: the PDF's pages over the present learners, when it divides evenly. */
export function suggestPagesPerLearner(totalPages: number, presentLearners: number, maxPagesPerScript: number): number | null {
  if (presentLearners < 1 || totalPages < 1 || totalPages % presentLearners !== 0) return null
  const per = totalPages / presentLearners
  return per <= maxPagesPerScript ? per : null
}
