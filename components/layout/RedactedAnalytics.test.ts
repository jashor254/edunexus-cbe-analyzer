import { test } from 'node:test'
import assert from 'node:assert/strict'
import { redactShareToken } from './RedactedAnalytics'

test('analytics URLs never carry a share token', () => {
  assert.equal(redactShareToken('https://www.edunexus.co.ke/shared/Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4'), 'https://www.edunexus.co.ke/shared/[token]')
  assert.equal(redactShareToken('https://www.edunexus.co.ke/shared/ABCDEF123456?utm=x#top'), 'https://www.edunexus.co.ke/shared/[token]?utm=x#top')
  assert.equal(redactShareToken('https://www.edunexus.co.ke/pricing'), 'https://www.edunexus.co.ke/pricing')
})
