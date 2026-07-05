import Link from 'next/link'
import { Clock, Eye } from 'lucide-react'
import type { InsightArticleCard } from '@/lib/insights/types'
import { CategoryBadge } from './CategoryBadge'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

type Props = {
  article: InsightArticleCard
  variant?: 'default' | 'compact'
}

export function ArticleCard({ article, variant = 'default' }: Props) {
  const href = `/insights/${article.slug}`

  if (variant === 'compact') {
    return (
      <Link href={href} className="group flex items-start gap-4 py-4 border-b border-white/8 last:border-0 hover:bg-white/2 -mx-4 px-4 rounded-xl transition-colors">
        <div className="flex-1 min-w-0">
          <CategoryBadge name={article.category.name} color={article.category.color} />
          <h3 className="text-sm font-bold text-white/90 group-hover:text-white mt-1.5 leading-snug line-clamp-2 transition-colors">
            {article.title}
          </h3>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[11px] text-white/35">{formatDate(article.publish_date)}</span>
            <span className="flex items-center gap-1 text-[11px] text-white/35">
              <Clock className="w-3 h-3" />
              {article.reading_time} min
            </span>
          </div>
        </div>
      </Link>
    )
  }

  return (
    <Link href={href} className="group flex flex-col bg-white/3 border border-white/8 rounded-2xl overflow-hidden hover:bg-white/5 hover:border-white/15 transition-all">
      {/* Cover placeholder */}
      <div className="aspect-[16/9] bg-gradient-to-br from-white/5 to-white/2 border-b border-white/8 relative overflow-hidden flex items-center justify-center">
        <div className="text-4xl opacity-20 select-none">
          {article.content_type === 'founder_notes' ? '✍️' :
           article.content_type === 'research' ? '🔬' :
           article.content_type === 'architecture' ? '🏗️' :
           article.content_type === 'framework' ? '📐' : '📖'}
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30" />
      </div>

      <div className="flex flex-col flex-1 p-5">
        <div className="flex items-center justify-between mb-3">
          <CategoryBadge name={article.category.name} color={article.category.color} />
          <span className="flex items-center gap-1 text-[11px] text-white/30">
            <Clock className="w-3 h-3" />
            {article.reading_time} min
          </span>
        </div>

        <h3 className="text-base font-bold text-white/90 group-hover:text-white leading-snug mb-2 line-clamp-2 transition-colors">
          {article.title}
        </h3>

        {article.excerpt && (
          <p className="text-sm text-white/45 leading-relaxed line-clamp-2 mb-4 flex-1">
            {article.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-[10px] font-bold text-violet-300">
              {article.author.name.charAt(0)}
            </div>
            <span className="text-xs text-white/45 font-medium">{article.author.name}</span>
          </div>

          <div className="flex items-center gap-2">
            {article.view_count > 0 && (
              <span className="flex items-center gap-1 text-[11px] text-white/25">
                <Eye className="w-3 h-3" />
                {article.view_count > 999
                  ? `${(article.view_count / 1000).toFixed(1)}k`
                  : article.view_count}
              </span>
            )}
            <span className="text-[11px] text-white/30">{formatDate(article.publish_date)}</span>
          </div>
        </div>
      </div>
    </Link>
  )
}
