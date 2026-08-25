// lib/storage/lmsBuckets.integration.test.ts
//
// LMS Basics Phase 0a/1a — proves the two new private Storage buckets
// (assignment-submissions, class-resources) actually behave the way every
// API route built on them assumes: private (no public URL), real upload
// works, a signed URL can be minted and used to fetch the object back.
// This is the one piece of the LMS Basics work that isn't exercised by any
// repository-layer test, since Storage isn't a Postgres table.
//
// Run: npx tsx --env-file=.env.local --test lib/storage/lmsBuckets.integration.test.ts
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { createTestServiceClient as createServiceClient } from '@/utils/supabase/test-service'

const db = createServiceClient()
const uploadedPaths: Array<{ bucket: string; path: string }> = []

after(async () => {
  for (const { bucket, path } of uploadedPaths) {
    await db.storage.from(bucket).remove([path])
  }
})

for (const bucket of ['assignment-submissions', 'class-resources']) {
  test(`${bucket}: bucket exists and is private (public=false)`, async () => {
    const { data, error } = await db.storage.getBucket(bucket)
    assert.equal(error, null)
    assert.equal(data?.public, false)
  })

  test(`${bucket}: upload → createSignedUrl → fetch round-trip works`, async () => {
    const path = `integration-test/${Date.now()}.txt`
    const contents = new TextEncoder().encode('synthetic LMS integration test file')

    const { error: uploadError } = await db.storage.from(bucket).upload(path, contents, {
      contentType: 'text/plain',
      upsert: true,
    })
    assert.equal(uploadError, null)
    uploadedPaths.push({ bucket, path })

    const { data: signed, error: signError } = await db.storage.from(bucket).createSignedUrl(path, 60)
    assert.equal(signError, null)
    assert.ok(signed?.signedUrl)

    const res = await fetch(signed!.signedUrl)
    assert.equal(res.status, 200)
    const text = await res.text()
    assert.equal(text, 'synthetic LMS integration test file')
  })

  test(`${bucket}: getPublicUrl does not permit an unsigned fetch (bucket is private)`, async () => {
    const path = `integration-test/${Date.now()}-private.txt`
    const contents = new TextEncoder().encode('should not be publicly readable')
    await db.storage.from(bucket).upload(path, contents, { contentType: 'text/plain', upsert: true })
    uploadedPaths.push({ bucket, path })

    const { data: pub } = db.storage.from(bucket).getPublicUrl(path)
    const res = await fetch(pub.publicUrl)
    // Private bucket: the "public" URL 404s/403s rather than serving the file.
    assert.notEqual(res.status, 200)
  })
}
