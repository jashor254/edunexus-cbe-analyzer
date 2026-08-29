// Author-approved publication metadata for the Engineering Educational Intelligence
// PDF build. This file is the single source of truth for publication metadata —
// it is intentionally separate from the frozen manuscript prose in
// docs/manuscript/engineering-educational-intelligence/ so that metadata (an ISBN,
// most notably) can change without ever touching chapter or front-matter content.
//
// To insert a real ISBN later: set the BOOK_ISBN environment variable when running
// the build (e.g. `BOOK_ISBN=978-...  npm run book:pdf`). Leave it unset to omit the
// ISBN line entirely — never hardcode a placeholder value here.

export const metadata = {
  title: "Engineering Educational Intelligence",
  subtitle: "What a learner record must be — and what a system is entitled to claim it knows",
  author: "Dennis Kariuki",
  edition: "First Edition",
  year: "2026",
  publisher: "EduNexus Kenya",
  website: "edunexus.co.ke",
  contactEmail: "hello@edunexus.co.ke",
  isbn: process.env.BOOK_ISBN?.trim() || null,
};
