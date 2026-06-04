'use client'

import { useState, useEffect } from 'react'
import { Loader2, HelpCircle } from 'lucide-react'
import type { TopicTree } from '@/lib/compass/topicSelector'

interface TopicSelectorProps {
  subject: string
  grade: number
  curriculumType: string
  onSelect: (strand: string, substrand: string, displayName: string, slug: string) => void
  selectedSlug?: string
}

export default function TopicSelector({
  subject,
  grade,
  curriculumType,
  onSelect,
  selectedSlug,
}: TopicSelectorProps) {
  const [topics, setTopics]     = useState<TopicTree>([])
  const [loading, setLoading]   = useState(true)
  const [fallback, setFallback] = useState(false)
  const [freeText, setFreeText] = useState('')

  useEffect(() => {
    if (!subject || !grade) { setLoading(false); setFallback(true); return }
    const params = new URLSearchParams({
      subject,
      grade: String(grade),
      curriculumType,
    })
    fetch(`/api/compass/topics?${params}`)
      .then(r => r.json())
      .then(d => {
        const tree: TopicTree = d?.data?.topics ?? []
        if (tree.length === 0) setFallback(true)
        else setTopics(tree)
      })
      .catch(() => setFallback(true))
      .finally(() => setLoading(false))
  }, [subject, grade, curriculumType])

  if (loading) return (
    <div className="flex items-center gap-2 text-white/40 text-sm py-4">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading topics…
    </div>
  )

  // Fallback: text input when subject not in DB
  if (fallback) return (
    <div className="w-full max-w-md space-y-3">
      <p className="text-white/50 text-sm">
        What specific topic in <span className="capitalize text-white/70">{subject}</span> would you like help with?
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          value={freeText}
          onChange={e => setFreeText(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && freeText.trim()) {
              onSelect(subject, freeText.trim(), freeText.trim(), freeText.trim().toLowerCase().replace(/\s+/g, '_'))
            }
          }}
          placeholder={`e.g. fractions, photosynthesis, essay writing…`}
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/30 focus:outline-none focus:border-violet-500/50"
        />
        <button
          onClick={() => {
            if (freeText.trim()) {
              onSelect(subject, freeText.trim(), freeText.trim(), freeText.trim().toLowerCase().replace(/\s+/g, '_'))
            }
          }}
          disabled={!freeText.trim()}
          className="px-4 py-2.5 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-500 disabled:opacity-40 transition-colors"
        >
          Start →
        </button>
      </div>
    </div>
  )

  return (
    <div className="w-full max-w-2xl space-y-5 text-left">
      <p className="text-white/50 text-sm text-center">
        Choose a topic in <span className="text-white/80 font-semibold capitalize">{subject}</span> to start with:
      </p>

      {topics.map(group => (
        <div key={group.strandId}>
          {/* Strand header */}
          <div className="flex items-center gap-2 mb-2">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-white/40 text-xs font-bold uppercase tracking-wider px-2">
              {group.displayTitle}
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          {/* Substrand chips */}
          <div className="flex flex-wrap gap-2">
            {group.substrands.map(sub => {
              const isSelected = selectedSlug === sub.slug
              return (
                <button
                  key={sub.id}
                  onClick={() => onSelect(group.strandTitle, sub.title, sub.displayName, sub.slug)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all font-medium ${
                    isSelected
                      ? 'bg-violet-500/25 border-violet-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/60 hover:bg-violet-500/15 hover:border-violet-500/30 hover:text-white/90'
                  }`}
                >
                  {sub.displayName}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* "Not sure" option */}
      <div className="text-center pt-2">
        <button
          onClick={() => onSelect(subject, 'help_me_decide', `Help me decide where to start in ${subject}`, 'help_me_decide')}
          className="flex items-center gap-2 mx-auto text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          I&apos;m not sure — help me decide
        </button>
      </div>
    </div>
  )
}
