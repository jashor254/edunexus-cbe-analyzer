import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildBlueprintPdfUrl,
  cookiesForOrigin,
  renderBlueprintPdf,
} from './pdfExport'

test('cookiesForOrigin scopes parsed cookies to the application origin', () => {
  assert.deepEqual(
    cookiesForOrigin('sb-a=one; sb-b=two', 'https://app.example.com'),
    [
      { name: 'sb-a', value: 'one', url: 'https://app.example.com' },
      { name: 'sb-b', value: 'two', url: 'https://app.example.com' },
    ],
  )
})

test('buildBlueprintPdfUrl renders the canonical Blueprint page in PDF mode', () => {
  assert.equal(
    buildBlueprintPdfUrl('https://app.example.com', 'learner-1'),
    'https://app.example.com/student/blueprint/learner-1?export=pdf',
  )
})

test('renderBlueprintPdf closes context and browser after success (context.close() already closes its pages)', async () => {
  const closed: string[] = []
  // url? optional here (not required) to match Playwright's real
  // BrowserContext.addCookies Cookie type — cookiesForOrigin() always sets
  // it in practice, the assertion below still checks that.
  const addedCookies: Array<{ name: string; value: string; url?: string }> = []
  const pdf = await renderBlueprintPdf(
    {
      origin: 'https://app.example.com',
      learnerId: 'learner-1',
      cookieHeader: 'sb-auth=token',
    },
    {
      launchBrowser: async () => ({
        newContext: async () => ({
          addCookies: async (cookies) => { addedCookies.push(...cookies) },
          newPage: async () => ({
            emulateMedia: async () => {},
            goto: async (url) => {
              assert.equal(url, 'https://app.example.com/student/blueprint/learner-1?export=pdf')
              return { ok: () => true, status: () => 200 }
            },
            waitForSelector: async (selector) => { assert.match(selector, /data-blueprint-ready/) },
            getByRole: () => ({ waitFor: async () => {} }),
            evaluate: async () => undefined,
            pdf: async () => new Uint8Array([1, 2, 3]),
            close: async () => { closed.push('page') },
          }),
          close: async () => { closed.push('context') },
        }),
        close: async () => { closed.push('browser') },
      }),
    },
  )

  assert.deepEqual(Array.from(pdf), [1, 2, 3])
  assert.deepEqual(addedCookies, [{ name: 'sb-auth', value: 'token', url: 'https://app.example.com' }])
  // No explicit page.close() — Playwright's browserContext.close() already
  // closes every page belonging to it, so calling both is redundant and,
  // worse, a page.close() failure would previously skip context/browser
  // cleanup entirely (a real leak path). See pdfExport.ts's finally block.
  assert.deepEqual(closed, ['context', 'browser'])
})

test('renderBlueprintPdf closes context and browser when page rendering fails', async () => {
  const closed: string[] = []

  await assert.rejects(
    () => renderBlueprintPdf(
      {
        origin: 'https://app.example.com',
        learnerId: 'learner-1',
        cookieHeader: 'sb-auth=token',
      },
      {
        launchBrowser: async () => ({
          newContext: async () => ({
            addCookies: async () => {},
            newPage: async () => ({
              emulateMedia: async () => {},
              goto: async () => ({ ok: () => false, status: () => 500 }),
              waitForSelector: async () => {},
              getByRole: () => ({ waitFor: async () => {} }),
              evaluate: async () => undefined,
              pdf: async () => new Uint8Array([1]),
              close: async () => { closed.push('page') },
            }),
            close: async () => { closed.push('context') },
          }),
          close: async () => { closed.push('browser') },
        }),
      },
    ),
    /Blueprint route render failed: 500/,
  )

  assert.deepEqual(closed, ['context', 'browser'])
})

// Regression test for a real production bug: renderBlueprintPdf's success
// path used to `return page.pdf({...})` without awaiting it. In an async
// function, `return <promise>` lets the surrounding `finally` block start
// running immediately — before that promise settles — so `finally`'s
// context.close()/browser.close() raced page.pdf(), and Playwright's real
// browserContext.close() rejects any pdf() still in flight ("Target page,
// context or browser has been closed"). Every real call failed with that
// error. The mocks in the two tests above resolve fast enough that they
// never exercised this race — this one simulates the real "closing
// invalidates a pending pdf()" behaviour so the bug can't silently return.
test('renderBlueprintPdf awaits page.pdf() before closing resources (regression: close must never race a pending pdf())', async () => {
  let contextClosed = false

  const pdf = await renderBlueprintPdf(
    {
      origin: 'https://app.example.com',
      learnerId: 'learner-1',
      cookieHeader: 'sb-auth=token',
    },
    {
      launchBrowser: async () => ({
        newContext: async () => ({
          addCookies: async () => {},
          newPage: async () => ({
            emulateMedia: async () => {},
            goto: async () => ({ ok: () => true, status: () => 200 }),
            waitForSelector: async () => {},
            getByRole: () => ({ waitFor: async () => {} }),
            evaluate: async () => undefined,
            pdf: async () => {
              // Simulate real rendering work still in flight when close()
              // is called, the way the real browser genuinely behaves.
              await new Promise(resolve => setTimeout(resolve, 10))
              if (contextClosed) {
                throw new Error('Target page, context or browser has been closed')
              }
              return new Uint8Array([9, 9, 9])
            },
            close: async () => {},
          }),
          close: async () => { contextClosed = true },
        }),
        close: async () => {},
      }),
    },
  )

  assert.deepEqual(Array.from(pdf), [9, 9, 9])
})
