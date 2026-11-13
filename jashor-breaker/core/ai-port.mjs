// Model-independent AI port. v0 ships NO model integration.
//
// Rules for any future provider (local model first):
//  1. It receives ONLY the output of toAiSafeView(): ids, titles, classes, rationale,
//     file locations. Never raw evidence snippets, never file contents.
//  2. It can only propose; it cannot execute. Proposals are data that a human
//     (or a deterministic, guard-checked runner) must accept.
//  3. A proposal that implies an active test is rejected by the guard in v0.

/**
 * @typedef {{id:string,title:string,severity:string,classification:string,rationale:string,locations:string[]}} AiSafeFinding
 * @typedef {{findingId:string,kind:'explain'|'propose-test'|'prioritise',text:string,requiresMode:'passive'|'active'}} AiProposal
 * @typedef {{name:string, propose:(findings:AiSafeFinding[])=>Promise<AiProposal[]>}} ModelProvider
 */

/** Strip a finding down to what a model may see. */
export function toAiSafeView(finding) {
  return {
    id: finding.id,
    title: finding.title,
    severity: finding.severity,
    classification: finding.classification,
    rationale: finding.rationale,
    locations: finding.evidence.map((e) => e.location),
  }
}

/** Default provider: does nothing. Keeps the engine fully functional with no model present. */
export const NullProvider = {
  name: 'null',
  async propose() {
    return []
  },
}

/** Proposals needing anything beyond passive mode are refused in v0. */
export function acceptableProposals(proposals) {
  return proposals.filter((p) => p.requiresMode === 'passive')
}
