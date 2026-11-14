// Minimal semver helpers (no dependencies). Only what Jashor Breaker needs.

/** @param {string} v @returns {{major:number,minor:number,patch:number}|null} */
export function parseExact(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim())
  return m ? { major: +m[1], minor: +m[2], patch: +m[3] } : null
}

/** @param {string} a @param {string} b @returns {number} negative, 0, positive; NaN if unparsable */
export function compareExact(a, b) {
  const x = parseExact(a)
  const y = parseExact(b)
  if (!x || !y) return NaN
  return x.major - y.major || x.minor - y.minor || x.patch - y.patch
}

/**
 * Lower-bound major of a simple range such as ">=20.9.0", "^22.1.0", "22", "22.x".
 * Returns null when it cannot be determined (never guesses).
 * @param {string} range @returns {number|null}
 */
export function rangeLowerMajor(range) {
  const m = /^\s*(?:>=|\^|~|v)?\s*(\d+)(?:\.|$|\s)/.exec(String(range))
  return m ? +m[1] : null
}
