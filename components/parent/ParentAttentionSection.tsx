// components/parent/ParentAttentionSection.tsx
//
// Parent Portal Phase P4 — "WHAT NEEDS ATTENTION?" — pure rendering over
// the already-composed `AttentionItem[]` from
// `lib/parentExperience/attentionAction.ts`. No data access, no priority
// logic, no risk vocabulary of its own — every string it renders arrived
// pre-translated. Zero-attention state is honest, never a manufactured
// celebration (mission Step 12).

import Link from 'next/link'
import type { AttentionItem } from '@/lib/parentExperience/attentionAction'

function AttentionCard({ item, primary }: { item: AttentionItem; primary: boolean }) {
  const body = (
    <>
      <p className={`text-sm font-bold ${primary ? 'text-gray-900' : 'text-gray-800'}`}>{item.headline}</p>
      {item.detail && <p className="text-xs text-gray-500 mt-1">{item.detail}</p>}
    </>
  )
  const className = `block rounded-2xl border p-4 transition-colors ${
    primary ? 'bg-amber-50 border-amber-100' : 'bg-white border-gray-100 hover:bg-gray-50'
  } ${item.destination ? 'focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:outline-none' : ''}`

  if (!item.destination) {
    return <div className={className}>{body}</div>
  }
  return (
    <Link href={item.destination} className={className}>
      {body}
    </Link>
  )
}

export default function ParentAttentionSection({
  primaryAttention,
  secondaryAttention,
  zeroAttention,
  assignmentCheckFailedNote,
  learnerId,
}: {
  primaryAttention: AttentionItem | null
  secondaryAttention: AttentionItem[]
  zeroAttention: boolean
  assignmentCheckFailedNote: string | null
  learnerId: string
}) {
  if (zeroAttention) {
    return (
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Needs Attention</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-700 font-bold">Nothing needs your attention right now.</p>
          <Link href={`/child/${learnerId}/full`} className="text-xs text-teal-700 font-bold hover:underline mt-2 inline-block">
            See the full picture →
          </Link>
        </div>
      </div>
    )
  }

  if (!primaryAttention) {
    // assignmentCheckFailedNote-only state — a real read failed and nothing
    // else needed attention. Never rendered as a false all-clear.
    return (
      <div className="space-y-2">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Needs Attention</h2>
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-sm text-gray-500">{assignmentCheckFailedNote}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wide">Needs Attention</h2>
      <AttentionCard item={primaryAttention} primary />
      {secondaryAttention.map((item) => (
        <AttentionCard key={item.key} item={item} primary={false} />
      ))}
      {assignmentCheckFailedNote && <p className="text-[11px] text-gray-400 px-1">{assignmentCheckFailedNote}</p>}
      <Link href={`/child/${learnerId}/full`} className="text-xs font-bold text-teal-700 hover:underline focus-visible:underline focus-visible:outline-none inline-block">
        View full picture →
      </Link>
    </div>
  )
}
