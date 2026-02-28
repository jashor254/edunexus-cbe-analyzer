'use client'

import { useState } from 'react'
import { X, MessageSquare, Star, ThumbsUp, ThumbsDown, Send, CheckCircle } from 'lucide-react'

// ============================================================
// TYPES
// ============================================================

type FeedbackTrigger =
  | 'after_analysis'    // After pathway analysis generated
  | 'after_7_days'      // Email / in-app after 1 week
  | 'on_cancel'         // User about to leave/cancel
  | 'manual'            // Floating feedback button (always visible)

type FeedbackStep = 'rating' | 'details' | 'nps' | 'done'

interface FeedbackSystemProps {
  trigger: FeedbackTrigger
  userId: string
  childName?: string        // Personalizes the message
  onClose?: () => void
  onSubmit?: (data: FeedbackData) => void
  className?: string
}

interface FeedbackData {
  trigger: FeedbackTrigger
  rating: 'helpful' | 'not_helpful' | null
  npsScore: number | null
  category: string | null
  message: string
  wouldRecommend: boolean | null
}

// ============================================================
// CANCEL REASONS (for churn feedback)
// ============================================================

const CANCEL_REASONS = [
  { id: 'too_expensive',     label: '💸 Too expensive' },
  { id: 'not_useful',        label: '😐 Didn\'t find it useful' },
  { id: 'child_finished',    label: '🎓 Child finished assessments' },
  { id: 'found_better',      label: '🔍 Found something better' },
  { id: 'too_complicated',   label: '😵 Too complicated to use' },
  { id: 'missing_features',  label: '🔧 Missing features I need' },
  { id: 'other',             label: '💬 Other reason' },
]

// ============================================================
// CONFIGS PER TRIGGER
// ============================================================

const TRIGGER_CONFIG = {
  after_analysis: {
    emoji: '🎯',
    title: 'Was this analysis helpful?',
    subtitle: 'Your feedback helps us improve for all Kenyan parents',
    color: 'from-blue-500 to-indigo-600',
  },
  after_7_days: {
    emoji: '🌟',
    title: 'How\'s your experience so far?',
    subtitle: 'You\'ve been with us a week — we\'d love to hear from you',
    color: 'from-green-500 to-emerald-600',
  },
  on_cancel: {
    emoji: '😢',
    title: 'Before you go...',
    subtitle: 'Help us understand what went wrong',
    color: 'from-orange-500 to-red-500',
  },
  manual: {
    emoji: '💬',
    title: 'Share your thoughts',
    subtitle: 'We read every single message',
    color: 'from-purple-500 to-pink-500',
  },
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function FeedbackSystem({
  trigger,
  userId,
  childName,
  onClose,
  onSubmit,
  className = '',
}: FeedbackSystemProps) {
  const [step, setStep] = useState<FeedbackStep>('rating')
  const [data, setData] = useState<FeedbackData>({
    trigger,
    rating: null,
    npsScore: null,
    category: null,
    message: '',
    wouldRecommend: null,
  })
  const [submitting, setSubmitting] = useState(false)

  const config = TRIGGER_CONFIG[trigger]

  // ── Submit to API ──
  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, userId }),
      })
      onSubmit?.(data)
      setStep('done')
    } catch (err) {
      console.error('Feedback submit failed:', err)
      setStep('done') // Still show success to user
    } finally {
      setSubmitting(false)
    }
  }

  // ── Quick rating → go to details ──
  const handleRating = (rating: 'helpful' | 'not_helpful') => {
    setData((d) => ({ ...d, rating }))
    setStep('details')
  }

  // ── NPS score selected ──
  const handleNPS = (score: number) => {
    setData((d) => ({ ...d, npsScore: score }))
  }

  return (
    <div className={`bg-white rounded-3xl border-2 border-slate-100 shadow-2xl overflow-hidden max-w-md w-full ${className}`}>

      {/* Header */}
      <div className={`bg-gradient-to-r ${config.color} p-5 text-white relative`}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-3xl mb-2">{config.emoji}</div>
        <h3 className="text-xl font-black leading-tight">
          {childName && trigger === 'after_analysis'
            ? `Was ${childName}'s analysis helpful?`
            : config.title}
        </h3>
        <p className="text-white/80 text-sm mt-1">{config.subtitle}</p>
      </div>

      <div className="p-6">

        {/* ── STEP 1: Quick Rating ── */}
        {step === 'rating' && (
          <div className="space-y-4">

            {/* Thumbs for analysis/weekly */}
            {(trigger === 'after_analysis' || trigger === 'after_7_days') && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleRating('helpful')}
                  className="flex flex-col items-center gap-2 p-5 border-2 border-slate-200 rounded-2xl hover:border-green-400 hover:bg-green-50 transition-all group"
                >
                  <ThumbsUp className="w-8 h-8 text-slate-400 group-hover:text-green-500 transition-colors" />
                  <span className="font-black text-slate-700 group-hover:text-green-700">
                    Yes, helpful!
                  </span>
                </button>
                <button
                  onClick={() => handleRating('not_helpful')}
                  className="flex flex-col items-center gap-2 p-5 border-2 border-slate-200 rounded-2xl hover:border-red-400 hover:bg-red-50 transition-all group"
                >
                  <ThumbsDown className="w-8 h-8 text-slate-400 group-hover:text-red-500 transition-colors" />
                  <span className="font-black text-slate-700 group-hover:text-red-700">
                    Not quite
                  </span>
                </button>
              </div>
            )}

            {/* Cancel reasons */}
            {trigger === 'on_cancel' && (
              <div className="space-y-2">
                {CANCEL_REASONS.map((reason) => (
                  <button
                    key={reason.id}
                    onClick={() => {
                      setData((d) => ({ ...d, category: reason.id }))
                      setStep('details')
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 font-semibold transition-all ${
                      data.category === reason.id
                        ? 'border-orange-400 bg-orange-50 text-orange-800'
                        : 'border-slate-200 hover:border-orange-300 hover:bg-orange-50/50 text-slate-700'
                    }`}
                  >
                    {reason.label}
                  </button>
                ))}
              </div>
            )}

            {/* Manual / general */}
            {trigger === 'manual' && (
              <div className="space-y-3">
                <textarea
                  value={data.message}
                  onChange={(e) => setData((d) => ({ ...d, message: e.target.value }))}
                  placeholder="Tell us anything — what you love, what's broken, what's missing..."
                  className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl resize-none focus:outline-none focus:border-purple-400 text-sm font-semibold text-slate-700 placeholder:text-slate-400"
                  rows={4}
                />
                <button
                  onClick={handleSubmit}
                  disabled={!data.message.trim() || submitting}
                  className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white py-3 rounded-xl font-black transition-all"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Sending...' : 'Send Feedback'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Details ── */}
        {step === 'details' && (
          <div className="space-y-4">

            {/* Contextual message */}
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-sm text-slate-600 font-semibold">
                {data.rating === 'helpful'
                  ? '🎉 Glad it was helpful! What did you like most?'
                  : data.rating === 'not_helpful'
                  ? '😔 Sorry about that. What was missing or confusing?'
                  : '📝 Any other details you can share?'}
              </p>
            </div>

            {/* Text area */}
            <textarea
              value={data.message}
              onChange={(e) => setData((d) => ({ ...d, message: e.target.value }))}
              placeholder={
                data.rating === 'helpful'
                  ? 'e.g. The pathway explanation was very clear...'
                  : data.rating === 'not_helpful'
                  ? 'e.g. I expected more detail about specific subjects...'
                  : 'Share anything that would help us improve...'
              }
              className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl resize-none focus:outline-none focus:border-blue-400 text-sm font-semibold text-slate-700 placeholder:text-slate-400"
              rows={3}
            />

            {/* NPS Question */}
            <div>
              <p className="text-sm font-black text-slate-700 mb-3">
                How likely are you to recommend EduNexus to another parent?
              </p>
              <div className="grid grid-cols-11 gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    onClick={() => handleNPS(score)}
                    className={`py-2 rounded-lg text-xs font-black transition-all ${
                      data.npsScore === score
                        ? score >= 9
                          ? 'bg-green-500 text-white'
                          : score >= 7
                          ? 'bg-yellow-500 text-white'
                          : 'bg-red-500 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-slate-400 font-semibold">Not likely</span>
                <span className="text-xs text-slate-400 font-semibold">Very likely</span>
              </div>
            </div>

            {/* Would recommend */}
            {data.npsScore !== null && data.npsScore >= 9 && (
              <div className="p-3 bg-green-50 border-2 border-green-200 rounded-xl">
                <p className="text-sm font-black text-green-800 mb-2">
                  🎉 Thank you! Would you share EduNexus with other CBC parents?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setData((d) => ({ ...d, wouldRecommend: true }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-black transition-all ${
                      data.wouldRecommend === true
                        ? 'bg-green-500 text-white'
                        : 'bg-white border-2 border-green-300 text-green-700 hover:bg-green-50'
                    }`}
                  >
                    Yes! 🙌
                  </button>
                  <button
                    onClick={() => setData((d) => ({ ...d, wouldRecommend: false }))}
                    className={`flex-1 py-2 rounded-lg text-sm font-black transition-all ${
                      data.wouldRecommend === false
                        ? 'bg-slate-500 text-white'
                        : 'bg-white border-2 border-slate-300 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white py-3 rounded-xl font-black transition-all"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Sending...' : 'Submit Feedback'}
            </button>

            <button
              onClick={handleSubmit}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 font-semibold py-1"
            >
              Skip — submit without comment
            </button>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">
              Asante sana! 🙏
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Your feedback has been received. We read every single response
              and use it to make EduNexus better for all Kenyan parents.
            </p>
            {data.wouldRecommend === true && (
              <div className="mt-4 p-3 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <p className="text-sm font-black text-blue-800">
                  🎁 Share your referral link and earn 1 month free!
                </p>
              </div>
            )}
            <button
              onClick={onClose}
              className="mt-5 px-6 py-2 bg-slate-900 text-white rounded-full font-black text-sm hover:bg-slate-800 transition-all"
            >
              Close
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

// ============================================================
// FLOATING FEEDBACK BUTTON (always visible)
// ============================================================

export function FeedbackButton({
  userId,
  childName,
}: {
  userId: string
  childName?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-full shadow-2xl font-black text-sm transition-all hover:scale-105"
      >
        <MessageSquare className="w-4 h-4" />
        Feedback
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <FeedbackSystem
            trigger="manual"
            userId={userId}
            childName={childName}
            onClose={() => setOpen(false)}
            className="w-full max-w-md"
          />
        </div>
      )}
    </>
  )
}

// ============================================================
// POST-ANALYSIS INLINE FEEDBACK (embed after analysis)
// ============================================================

export function PostAnalysisFeedback({
  userId,
  childName,
}: {
  userId: string
  childName: string
}) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <div className="mt-6">
      <FeedbackSystem
        trigger="after_analysis"
        userId={userId}
        childName={childName}
        onClose={() => setDismissed(true)}
        onSubmit={() => setTimeout(() => setDismissed(true), 3000)}
      />
    </div>
  )
}