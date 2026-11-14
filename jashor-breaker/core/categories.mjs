/**
 * Report categories: the six things a reader must never confuse.
 *  confirmed-vulnerability  a deterministic observation that directly demonstrates the weakness
 *  suspected-vulnerability  a strong signal whose impact was not demonstrated
 *  unverified-finding       cannot be established from what the check can see
 *  accepted-risk            a recorded, unexpired human decision to live with a risk (visibility only)
 *  expired-acceptance       a recorded decision whose date has passed: the risk is unaccepted again
 *  failed-security-control  a control that should be working (a gate, a register, a pin) is absent or broken
 * `kind` (what sort of fact) takes precedence; otherwise `classification` decides. Absent kind = vulnerability.
 */
export const CATEGORIES = Object.freeze([
  'expired-acceptance', 'failed-security-control', 'confirmed-vulnerability', 'suspected-vulnerability', 'unverified-finding', 'accepted-risk',
])

export const CATEGORY_LABEL = Object.freeze({
  'expired-acceptance': 'Expired risk acceptance',
  'failed-security-control': 'Failed security control',
  'confirmed-vulnerability': 'Confirmed vulnerability',
  'suspected-vulnerability': 'Suspected vulnerability',
  'unverified-finding': 'Unverified finding',
  'accepted-risk': 'Accepted risk',
})

export function categorise(f) {
  if (f.kind === 'expired-acceptance') return 'expired-acceptance'
  if (f.kind === 'accepted-risk') return 'accepted-risk'
  if (f.kind === 'control-failure') return 'failed-security-control'
  return { confirmed: 'confirmed-vulnerability', suspected: 'suspected-vulnerability' }[f.classification] ?? 'unverified-finding'
}

export function countByCategory(findings) {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0]))
  for (const f of findings) out[categorise(f)]++
  return out
}
