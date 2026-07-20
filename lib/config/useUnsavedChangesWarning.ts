'use client'

// lib/config/useUnsavedChangesWarning.ts
//
// PRP-4 (Teacher Continuity & Session Recovery, Phase 4/7) — the marks-entry
// grid (app/teacher/classes/[classId]/assessments/[assessmentId]/page.tsx)
// saves in one batch on an explicit "Save" click, not per-cell (Phase 1's
// audit finding: typed-but-unsaved marks are lost on a refresh with zero
// persistence today). Phase 3 explicitly rules out persisting the marks
// themselves to browser storage ("do not preserve confidential educational
// data unnecessarily") — real student names and scores are exactly that
// kind of data. So this is a warning, not a recovery mechanism: it asks
// the browser to confirm before discarding unsaved changes, the same
// native protection most spreadsheet/form tools use, with zero storage of
// the data itself.

import { useEffect } from 'react'

export function useUnsavedChangesWarning(hasUnsavedChanges: boolean): void {
  useEffect(() => {
    if (!hasUnsavedChanges) return

    function handler(e: BeforeUnloadEvent) {
      e.preventDefault()
      // Chrome requires returnValue to be set; the string itself is
      // ignored by modern browsers in favor of a generic prompt.
      e.returnValue = ''
    }

    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])
}
