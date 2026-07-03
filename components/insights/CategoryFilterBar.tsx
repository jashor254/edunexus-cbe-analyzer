'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { InsightCategory } from '@/lib/insights/types'

const QUICK_FILTERS = [
  { label: 'Latest',              value: ''                    },
  { label: 'Featured',            value: 'featured'            },
  { label: 'AI',                  value: 'ai-in-education'     },
  { label: 'Learning Intel',      value: 'learning-intelligence' },
  { label: 'Career Intelligence', value: 'career-intelligence' },
  { label: 'Teacher Innovation',  value: 'teacher-innovation'  },
  { label: 'Assessment',          value: 'assessment-intelligence' },
  { label: 'Architecture',        value: 'educational-architecture' },
  { label: 'Founder Notes',       value: 'founder-notes'       },
  { label: 'Research',            value: 'research'            },
]

type Props = { categories: InsightCategory[] }

export function CategoryFilterBar({ categories: _ }: Props) {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const active       = searchParams.get('category') ?? ''

  function select(value: string) {
    const params = new URLSearchParams(searchParams)
    if (value) params.set('category', value)
    else params.delete('category')
    params.delete('page')
    router.push(`/insights?${params.toString()}`)
  }

  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden"
      style={{ scrollbarWidth: 'none' }}
      role="tablist"
      aria-label="Filter articles by category"
    >
      {QUICK_FILTERS.map((f) => (
        <button
          key={f.value}
          role="tab"
          aria-selected={active === f.value}
          onClick={() => select(f.value)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap ${
            active === f.value
              ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
              : 'bg-white/5 border-white/10 text-white/45 hover:border-white/20 hover:text-white/70'
          }`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}
