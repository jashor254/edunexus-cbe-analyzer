import Link from 'next/link'
import type { InsightCategory } from '@/lib/insights/types'
import { CategoryBadge } from './CategoryBadge'

type Props = {
  categories: (InsightCategory & { article_count?: number })[]
}

const TOPIC_ICONS: Record<string, string> = {
  'learning-intelligence':    '🧠',
  'ai-in-education':          '🤖',
  'teacher-innovation':       '👨‍🏫',
  'career-intelligence':      '🎯',
  'assessment-intelligence':  '📊',
  'educational-architecture': '🏗️',
  'founder-notes':            '✍️',
  'future-of-education':      '🔭',
  'research':                 '🔬',
  'school-leadership':        '🏫',
}

export function TopicsGrid({ categories }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {categories.map((cat) => (
        <Link
          key={cat.id}
          href={`/insights?category=${cat.slug}`}
          className="group flex flex-col items-start gap-2 bg-white/3 border border-white/8 rounded-2xl p-4 hover:bg-white/6 hover:border-white/15 transition-all"
        >
          <span className="text-2xl">{TOPIC_ICONS[cat.slug] ?? '📖'}</span>
          <div>
            <p className="text-xs font-bold text-white/80 group-hover:text-white leading-snug transition-colors">
              {cat.name}
            </p>
            {cat.article_count !== undefined && cat.article_count > 0 && (
              <p className="text-[10px] text-white/30 mt-0.5">
                {cat.article_count} article{cat.article_count !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </Link>
      ))}
    </div>
  )
}
