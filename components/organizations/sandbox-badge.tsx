'use client'

import { FlaskConical } from 'lucide-react'

type Props = {
  size?: 'sm' | 'md'
}

export function SandboxBadge({ size = 'sm' }: Props) {
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono font-semibold uppercase tracking-wider rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 ${
        size === 'md'
          ? 'px-3 py-1 text-xs'
          : 'px-2 py-0.5 text-[10px]'
      }`}
    >
      <FlaskConical className={size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
      sandbox
    </span>
  )
}
