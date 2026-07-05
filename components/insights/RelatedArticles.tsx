import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import type { InsightArticleCard } from '@/lib/insights/types'
import { ArticleCard } from './ArticleCard'

type Props = { articles: InsightArticleCard[] }

export function RelatedArticles({ articles }: Props) {
  if (articles.length === 0) return null

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-extrabold text-white">Related Insights</h2>
        <Link href="/insights" className="flex items-center gap-1 text-sm text-violet-400 hover:text-violet-300 font-semibold transition-colors">
          All insights <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {articles.map((a) => (
          <ArticleCard key={a.id} article={a} />
        ))}
      </div>
    </section>
  )
}
