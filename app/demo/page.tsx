// app/demo/page.tsx
//
// The reviewer presentation. Public, no login, no database.
//
// The single server-side responsibility here is to check which approved
// screenshots are actually present in public/demo/google-africa/, so a missing
// file degrades to an honest labelled panel instead of a broken image. That is
// a filesystem read of a static asset directory — no query, no service, no
// product logic.

import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { DemoPresentation } from '@/components/demo-presentation/DemoPresentation'
import { DEMO_ASSETS, DEMO_ASSET_DIR } from '@/lib/demo/presentation'

// The asset set is fixed at build time; nothing about this page varies per
// request or per viewer.
export const dynamic = 'force-static'

async function listAvailableAssets(): Promise<string[]> {
  const expected = new Set<string>(Object.values(DEMO_ASSETS))
  try {
    const entries = await readdir(path.join(process.cwd(), 'public', DEMO_ASSET_DIR))
    return entries.filter(entry => expected.has(entry))
  } catch {
    // Directory absent (nothing attached yet) — every slide falls back to its
    // placeholder. Not an error state for the page.
    return []
  }
}

export default async function DemoPage() {
  const availableAssets = await listAvailableAssets()
  return <DemoPresentation availableAssets={availableAssets} />
}
