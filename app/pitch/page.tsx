// app/pitch/page.tsx
//
// The Google Africa pitch deck. Public, no login, no database, no filesystem.
//
// Which screenshots are attached comes from lib/demo/availableAssets.ts, the
// manifest the capture script maintains — the same source /demo reads, so the
// two can never disagree about which product screens exist. A screen missing
// from disk degrades to a labelled placeholder; product UI is never drawn or
// approximated to fill a gap.

import { PitchDeck } from '@/components/pitch-deck/PitchDeck'
import { DEMO_AVAILABLE_ASSETS } from '@/lib/demo/availableAssets'

// Nothing about this page varies per request or per viewer.
export const dynamic = 'force-static'

export default function PitchPage() {
  return <PitchDeck availableAssets={DEMO_AVAILABLE_ASSETS} />
}
