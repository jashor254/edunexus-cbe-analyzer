// Kill switch for POST /api/share/generate. FAIL-CLOSED: the route has no
// first-party UI caller and accepts caller-supplied report content, so until
// reports are derived server-side from stored learner evidence it must not
// create records. Flipping this to true is a deliberate, reviewed code change
// (a unit test pins the value) — never an env var that a misconfigured Preview
// or Production could enable by accident.
//
// The secure reader (get_shared_report_by_token, lib/sharedReports/read.ts) and
// the owner revoke route are deliberately NOT gated: existing links keep working
// and can be revoked, and future server-generated reports reuse the same reader.
export const SHARE_GENERATION_ENABLED: boolean = false

export const SHARE_GENERATION_DISABLED_MESSAGE = 'Report sharing is not available.'
