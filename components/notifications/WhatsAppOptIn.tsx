'use client'

import { useState } from 'react'
import { MessageCircle, CheckCircle2, Loader2 } from 'lucide-react'

type Props = {
  studentName: string
  studentId:   string
  onSuccess:   (phone: string) => void
  onSkip:      () => void
  className?:  string
}

function formatPhoneDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  // Display as 0XXX XXX XXX
  if (digits.length <= 4)  return digits
  if (digits.length <= 7)  return `${digits.slice(0, 4)} ${digits.slice(4)}`
  return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`
}

function extractRawDigits(display: string): string {
  return display.replace(/\D/g, '')
}

// Returns a 12-digit E.164 form (without +) or null if invalid.
function normaliseForApi(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  let normalised: string
  if (digits.startsWith('0') && digits.length === 10) {
    normalised = '254' + digits.slice(1)
  } else if (digits.startsWith('254') && digits.length === 12) {
    normalised = digits
  } else {
    return null
  }
  if (!normalised.startsWith('2547') && !normalised.startsWith('2541')) return null
  return normalised
}

export default function WhatsAppOptIn({
  studentName,
  studentId,
  onSuccess,
  onSkip,
  className = '',
}: Props) {
  const [phone,   setPhone]   = useState('')
  const [consent, setConsent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmedPhone, setConfirmedPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | null>(null)

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw     = e.target.value
    const digits  = extractRawDigits(raw)
    setPhone(formatPhoneDisplay(digits))
    setPhoneError(null)
  }

  function validatePhone(): boolean {
    const normalised = normaliseForApi(phone)
    if (!normalised) {
      setPhoneError('Enter a valid 10-digit Kenyan number, e.g. 0712 345 678')
      return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validatePhone()) return

    const normalised = normaliseForApi(phone)
    if (!normalised) { setPhoneError('Enter a valid 10-digit Kenyan number'); return }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/parent/whatsapp-optin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          phone:     normalised,
          optIn:     true,
          studentId,
        }),
      })
      const json = await res.json()

      if (!res.ok || !json.success) {
        throw new Error(json.error ?? 'Failed to activate WhatsApp')
      }

      setConfirmedPhone(json.data?.phone ?? extractRawDigits(phone))
      setSuccess(true)
      onSuccess(json.data?.phone ?? extractRawDigits(phone))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className={`bg-green-900/30 border border-green-500/40 rounded-2xl p-6 ${className}`}>
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <p className="text-white font-black text-lg">WhatsApp activated! ✅</p>
            <p className="text-green-300 text-sm mt-1">
              Updates for <span className="font-bold">{studentName}</span> will be sent to{' '}
              <span className="font-bold">+{confirmedPhone}</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Opt-in form ────────────────────────────────────────────────────────────
  return (
    <div className={`bg-slate-900 border border-green-500/30 rounded-2xl p-6 ${className}`}>
      <form onSubmit={handleSubmit} noValidate>

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-white font-black text-lg leading-tight">
              Get instant updates on WhatsApp
            </p>
            <p className="text-slate-400 text-sm mt-0.5">
              We'll message you when{' '}
              <span className="text-white font-medium">{studentName}</span>'s work
              is marked or a teacher raises a concern.
            </p>
          </div>
        </div>

        {/* Bullets */}
        <ul className="space-y-1.5 mb-5">
          {[
            'Assignment marked → instant WhatsApp',
            'Teacher alert → instant WhatsApp',
            'Full report details always in your email',
          ].map(text => (
            <li key={text} className="flex items-center gap-2 text-sm text-white">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              {text}
            </li>
          ))}
        </ul>

        {/* Phone input */}
        <div className="mb-4">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
            Your WhatsApp number
          </label>
          <div className="flex">
            <span className="inline-flex items-center gap-1 px-3 py-3 bg-slate-800 border border-slate-600 border-r-0 rounded-l-xl text-sm text-slate-300 font-medium select-none">
              🇰🇪 +254
            </span>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onBlur={validatePhone}
              placeholder="0712 345 678"
              className={`flex-1 px-3 py-3 bg-slate-800 border text-white placeholder-slate-500 rounded-r-xl text-sm focus:outline-none focus:ring-1 transition-colors ${
                phoneError
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-slate-600 focus:border-green-500 focus:ring-green-500'
              }`}
            />
          </div>
          {phoneError && (
            <p className="mt-1.5 text-xs text-red-400 font-medium">{phoneError}</p>
          )}
        </div>

        {/* Consent */}
        <label className="flex items-start gap-3 mb-5 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={e => setConsent(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-600 bg-slate-800 text-green-500 focus:ring-green-500 focus:ring-offset-slate-900 shrink-0"
          />
          <span className="text-xs text-slate-400 leading-relaxed">
            I agree to receive WhatsApp notifications from EduNexus about{' '}
            <span className="text-white font-medium">{studentName}</span>'s learning.
            I can turn this off anytime in settings.
          </span>
        </label>

        {/* Error */}
        {error && (
          <p className="mb-4 text-sm text-red-400 font-medium">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!phone || !consent || loading}
          className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Activating…</>
            : 'Activate WhatsApp Updates 💚'
          }
        </button>

        {/* Skip */}
        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-slate-500 hover:text-slate-400 transition-colors"
          >
            Maybe later
          </button>
        </div>

      </form>
    </div>
  )
}
