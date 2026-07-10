// lib/intelligence/subjectMapping.ts
// Subject mapping stage of the ingestion pipeline. Reuses the existing,
// already-correct subject-key canonicalization in lib/pathwayCalculator.ts
// rather than reinventing it — that utility already handles the real
// aliases Kenyan schools use (emat, geo, csl, hisc, etc.), it was just
// never wired to any import path (per the ingestion engine audit).

import { normalizeSubjectKey } from '@/lib/pathwayCalculator'

export type SubjectMappingResult = {
  canonicalSubject: string
  wasMapped: boolean   // true if the input differed from the canonical key (worth surfacing, not an issue)
}

export function mapSubject(rawSubject: string): SubjectMappingResult {
  const canonical = normalizeSubjectKey(rawSubject)
  return {
    canonicalSubject: canonical,
    wasMapped: canonical !== rawSubject.trim().toLowerCase(),
  }
}
