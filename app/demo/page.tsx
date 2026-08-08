// app/demo/page.tsx
//
// The reviewer presentation. Public, no login, no database, no filesystem.
//
// Which screenshots are attached comes from lib/demo/availableAssets.ts, a
// manifest the capture script maintains. This route previously read the asset
// directory with readdir(), which Next rejects during static rendering
// ("dynamic filesystem access") — and which was never the right shape anyway:
// the attached set is fixed at build time, so it belongs in a constant rather
// than a disk read on every render.

import { DemoPresentation } from '@/components/demo-presentation/DemoPresentation'
import { DEMO_AVAILABLE_ASSETS } from '@/lib/demo/availableAssets'

// Nothing about this page varies per request or per viewer.
export const dynamic = 'force-static'

export default function DemoPage() {
  return <DemoPresentation availableAssets={DEMO_AVAILABLE_ASSETS} />
}
