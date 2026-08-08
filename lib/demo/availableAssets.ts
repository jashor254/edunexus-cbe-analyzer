// lib/demo/availableAssets.ts
//
// Which of the presentation's screenshots are actually present in
// public/demo/google-africa/.
//
// GENERATED — do not edit by hand. `scripts/captureDemoScreens.ts` rewrites
// this file after every capture run.
//
// Why a checked-in manifest rather than reading the directory: /demo is a
// statically rendered route, and Next does not permit dynamic filesystem
// access during static rendering. The set of attached screenshots is fixed at
// build time anyway — it changes only when someone commits new images — so a
// generated constant is both the honest representation and the one that
// builds. A file listed here that is missing from disk would 404 its image;
// a file omitted here renders the "Screen not attached" panel instead.

export const DEMO_AVAILABLE_ASSETS: readonly string[] = [
  'career-intelligence.png',
  'learner-blueprint-how-we-help-next.png',
  'learner-blueprint-where-we-stand-today.png',
  'teacher-dashboard.png',
  'teacher-documents-workflow.png',
]
