import Link from 'next/link'
import { Clock, ArrowRight, Eye } from 'lucide-react'
import type { InsightArticleCard } from '@/lib/insights/types'
import { CategoryBadge } from './CategoryBadge'

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

type Props = { article: InsightArticleCard }

export function FeaturedArticle({ article }: Props) {
  return (
    <Link
      href={`/insights/${article.slug}`}
      className="group relative block bg-white/3 border border-white/10 rounded-3xl overflow-hidden hover:border-white/20 transition-all"
    >
      {/* Hero graphic */}
      <div className="aspect-[21/9] md:aspect-[3/1] bg-gradient-to-br from-violet-900/40 via-purple-900/20 to-indigo-900/40 relative flex items-center justify-center overflow-hidden">
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'linear-gradient(rgba(139,92,246,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.3) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />
        {/* Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-32 bg-violet-500/20 rounded-full blur-3xl" />
        <div className="relative z-10 text-6xl opacity-40 select-none">
          {article.content_type === 'founder_notes' ? '✍️' :
           article.content_type === 'research' ? '🔬' :
           article.content_type === 'architecture' ? '🏗️' : '📖'}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Featured badge */}
        <div className="absolute top-5 left-5">
          <span className="inline-flex items-center gap-1.5 bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            ✦ Featured
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 md:p-10">
        <div className="flex items-center gap-3 mb-4">
          <CategoryBadge name={article.category.name} color={article.category.color} size="md" />
          <span className="flex items-center gap-1 text-xs text-white/35">
            <Clock className="w-3.5 h-3.5" />
            {article.reading_time} min read
          </span>
          {article.view_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-white/30">
              <Eye className="w-3.5 h-3.5" />
              {article.view_count.toLocaleString()} views
            </span>
          )}
        </div>

        <h2 className="text-2xl md:text-3xl font-extrabold text-white leading-snug tracking-tight mb-3 group-hover:text-white/90 transition-colors" style={{ letterSpacing: '-0.02em' }}>
          {article.title}
        </h2>

        {article.subtitle && (
          <p className="text-base md:text-lg text-white/50 leading-relaxed mb-5 max-w-2xl">
            {article.subtitle}
          </p>
        )}

        {article.excerpt && (
          <p className="text-sm text-white/40 leading-relaxed mb-6 max-w-xl line-clamp-2">
            {article.excerpt}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-300">
              {article.author.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-semibold text-white/80">{article.author.name}</p>
              <p className="text-xs text-white/35">{formatDate(article.publish_date)}</p>
            </div>
          </div>

          <span className="flex items-center gap-2 text-sm font-semibold text-violet-400 group-hover:text-violet-300 transition-colors">
            Read article
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </span>
        </div>
      </div>
    </Link>
  )
}
