// Tiny JSON-Schema-subset validator (type, enum, required, properties,
// additionalProperties:false, items, pattern, minLength, minItems, const).
// Schemas in ../schemas are the single source of truth for config + findings.

/** @param {unknown} v */
function typeOf(v) {
  if (Array.isArray(v)) return 'array'
  if (v === null) return 'null'
  return typeof v
}

/**
 * @param {unknown} value
 * @param {Record<string, any>} schema
 * @param {string} [path]
 * @returns {string[]} error messages; empty array means valid
 */
export function validate(value, schema, path = '$') {
  const errors = []
  if (schema.const !== undefined && value !== schema.const) {
    errors.push(`${path}: must equal ${JSON.stringify(schema.const)}`)
    return errors
  }
  if (schema.type) {
    const want = Array.isArray(schema.type) ? schema.type : [schema.type]
    const got = typeOf(value)
    const ok = want.includes(got) || (got === 'number' && want.includes('integer') && Number.isInteger(value))
    if (!ok) {
      errors.push(`${path}: expected ${want.join('|')}, got ${got}`)
      return errors
    }
  }
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path}: must be one of ${schema.enum.join(', ')}`)
  }
  if (typeof value === 'string') {
    if (schema.minLength && value.length < schema.minLength) errors.push(`${path}: too short`)
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: does not match ${schema.pattern}`)
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems} items`)
    if (schema.items) value.forEach((item, i) => errors.push(...validate(item, schema.items, `${path}[${i}]`)))
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}: missing required "${key}"`)
    }
    const props = schema.properties ?? {}
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) errors.push(...validate(value[key], sub, `${path}.${key}`))
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in props)) errors.push(`${path}: unknown property "${key}"`)
      }
    }
  }
  return errors
}
