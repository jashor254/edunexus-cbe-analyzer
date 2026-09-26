'use client'

import { Smartphone, RotateCcw } from 'lucide-react'
import type { PaywallInfo } from '@/lib/payments/paywall'

type Props = {
  info:     PaywallInfo
  message?: string | null
  onRetry?: () => void
}

// Shown when a gated route answers 402. The pay link opens in a new tab so the
// teacher keeps everything they entered here, pays, then comes back and
// retries — without refilling a multi-step form.
export default function PaywallNotice({ info, message, onRetry }: Props) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">
        {message ?? (info.label && info.priceKes !== null
          ? `This needs the ${info.label} — KES ${info.priceKes}.`
          : 'This needs a purchase to continue.')}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={info.payUrl}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white hover:bg-emerald-700"
        >
          <Smartphone className="h-4 w-4" />
          {info.priceKes !== null ? `Pay KES ${info.priceKes} with M-Pesa` : 'See pricing'}
        </a>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400 px-4 py-2 font-bold hover:bg-amber-100"
          >
            <RotateCcw className="h-4 w-4" /> I&apos;ve paid — try again
          </button>
        )}
      </div>
    </div>
  )
}
