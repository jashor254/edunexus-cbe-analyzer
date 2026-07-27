import { notFound }          from 'next/navigation'
import type { Metadata }     from 'next'
import Link                  from 'next/link'
import { ArrowLeft, Clock, Calendar, Eye, Tag } from 'lucide-react'
import { FOCUS_RING } from '../../constants'
import { getArticleBySlug, getRelatedArticles } from '@/lib/insights/articles'
import { ArticleBody }        from '@/components/insights/ArticleBody'
import { TableOfContents }    from '@/components/insights/TableOfContents'
import { ReadingProgress }    from '@/components/insights/ReadingProgress'
import { AuthorCard }         from '@/components/insights/AuthorCard'
import { RelatedArticles }    from '@/components/insights/RelatedArticles'
import { NewsletterSignup }   from '@/components/insights/NewsletterSignup'
import { ShareButtons }       from '@/components/insights/ShareButtons'
import { CategoryBadge }      from '@/components/insights/CategoryBadge'

type PageProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const article  = await getArticleBySlug(slug)
  if (!article) return { title: 'Not Found | EduNexus Insights' }

  const title       = article.seo_title ?? `${article.title} | EduNexus Insights`
  const description = article.seo_description ?? article.excerpt ?? ''
  const url         = `https://edunexus.co.ke/insights/${slug}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type:      'article',
      publishedTime: article.publish_date ?? undefined,
      authors:   [article.author.name],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
    },
    alternates: { canonical: url },
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-KE', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function ArticlePage({ params }: PageProps) {
  const { slug } = await params
  const article  = await getArticleBySlug(slug)
  if (!article) notFound()

  const related = await getRelatedArticles(article.id, article.category.id, 3)
  const pageUrl = `https://edunexus.co.ke/insights/${slug}`

  // JSON-LD structured data
  const jsonLd = {
    '@context':      'https://schema.org',
    '@type':         'Article',
    headline:        article.title,
    description:     article.excerpt ?? '',
    datePublished:   article.publish_date ?? '',
    dateModified:    article.updated_at,
    author: {
      '@type': 'Person',
      name:    article.author.name,
    },
    publisher: {
      '@type': 'Organization',
      name:    'EduNexus',
      url:     'https://edunexus.co.ke',
    },
    url: pageUrl,
  }

  return (
    <>
      <ReadingProgress />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ── ARTICLE HERO ──────────────────────────────────────────────────────── */}
      <div className="border-b border-white/8">
        {/* Hero visual */}
        <div className="aspect-[21/6] bg-gradient-to-br from-violet-900/30 via-[#0a0a14] to-indigo-900/30 relative overflow-hidden flex items-center justify-center">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                'linear-gradient(rgba(139,92,246,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.25) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
            }}
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-40 bg-violet-500/10 rounded-full blur-3xl" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        </div>

        {/* Article meta + title */}
        <div className="max-w-[760px] mx-auto px-6 pt-10 pb-8">

          {/* Back link */}
          <Link
            href="/insights"
            className={`inline-flex items-center gap-2 text-sm text-white/35 hover:text-white/70 font-medium transition-colors mb-8 ${FOCUS_RING}`}
          >
            <ArrowLeft className="w-4 h-4" />
            EduNexus Insights
          </Link>

          {/* Category + content type */}
          <div className="flex items-center gap-3 mb-5">
            <CategoryBadge name={article.category.name} color={article.category.color} size="md" />
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">
              {article.content_type.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Title */}
          <h1
            className="font-extrabold text-white leading-[1.1] mb-4"
            style={{ fontSize: 'clamp(26px, 4.5vw, 42px)', letterSpacing: '-0.025em' }}
          >
            {article.title}
          </h1>

          {/* Subtitle */}
          {article.subtitle && (
            <p className="text-xl text-white/55 leading-relaxed mb-6 font-light">
              {article.subtitle}
            </p>
          )}

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-white/8">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm font-bold text-violet-300">
                {article.author.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-semibold text-white/80">{article.author.name}</p>
                {article.author.title && (
                  <p className="text-xs text-white/35">{article.author.title}</p>
                )}
              </div>
            </div>

            <div className="h-4 w-px bg-white/10" />

            <span className="flex items-center gap-1.5 text-xs text-white/35">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(article.publish_date)}
            </span>

            <span className="flex items-center gap-1.5 text-xs text-white/35">
              <Clock className="w-3.5 h-3.5" />
              {article.reading_time} min read
            </span>

            {article.view_count > 0 && (
              <span className="flex items-center gap-1.5 text-xs text-white/50">
                <Eye className="w-3.5 h-3.5" />
                {article.view_count.toLocaleString()} views
              </span>
            )}
          </div>

          {/* Tags */}
          {article.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-white/20" />
              {article.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="text-[11px] font-semibold text-white/50 bg-white/5 border border-white/8 px-2.5 py-0.5 rounded-full"
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── ARTICLE BODY + SIDEBAR ────────────────────────────────────────────── */}
      <div className="max-w-[1100px] mx-auto px-6 py-12">
        <div className="grid xl:grid-cols-[1fr_240px] gap-12">

          {/* Main content */}
          <main>
            {article.content && (
              <ArticleBody content={article.content} slug={article.slug} />
            )}

            {/* Share */}
            <div className="mt-12 pt-8 border-t border-white/8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <ShareButtons title={article.title} url={pageUrl} />

              <Link
                href="/insights"
                className={`text-sm text-violet-400 hover:text-violet-300 font-semibold transition-colors rounded ${FOCUS_RING}`}
              >
                ← All insights
              </Link>
            </div>

            {/* Author */}
            <div className="mt-10">
              <AuthorCard author={article.author} />
            </div>

            {/* Newsletter */}
            <div className="mt-8 bg-white/3 border border-white/8 rounded-2xl px-7 py-7">
              <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2">
                EduNexus Insights Newsletter
              </p>
              <p className="text-base font-bold text-white mb-1">
                Get original thinking, delivered.
              </p>
              <p className="text-sm text-white/40 mb-5">
                No filler. Just ideas worth reading on the future of education in Kenya.
              </p>
              <NewsletterSignup />
            </div>

            {/* About EduNexus */}
            <div className="mt-8 bg-violet-500/5 border border-violet-500/15 rounded-2xl px-7 py-6">
              <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-3">Try EduNexus</p>
              <p className="text-sm font-semibold text-white mb-1">
                We don&apos;t only publish ideas. We build them.
              </p>
              <p className="text-sm text-white/50 leading-relaxed mb-4">
                EduNexus is Kenya&apos;s Learning Intelligence Platform — giving schools, teachers, and
                families the intelligence to understand every learner and act on it, every day.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className={`inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold px-5 py-2.5 rounded-xl transition-colors ${FOCUS_RING}`}
                >
                  Get started free
                </Link>
                <Link
                  href="/#school"
                  className={`inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors ${FOCUS_RING}`}
                >
                  Learn more →
                </Link>
              </div>
            </div>
          </main>

          {/* Sidebar */}
          <aside className="hidden xl:block">
            <div className="sticky top-24 space-y-8">
              {/* Table of contents */}
              {article.content && (
                <TableOfContents content={article.content} />
              )}

              {/* Quick links */}
              <div>
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest mb-4">
                  Quick links
                </p>
                <div className="space-y-2">
                  {[
                    { label: 'All Insights', href: '/insights' },
                    { label: article.category.name, href: `/insights?category=${article.category.slug}` },
                    { label: 'Try EduNexus', href: '/signup' },
                  ].map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`block text-xs text-white/35 hover:text-white/70 transition-colors py-0.5 ${FOCUS_RING}`}
                    >
                      {link.label} →
                    </Link>
                  ))}
                </div>
              </div>

              {/* Series info */}
              {article.series && (
                <div className="bg-white/3 border border-white/8 rounded-xl p-4">
                  <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2">
                    Series
                  </p>
                  <p className="text-sm font-semibold text-white">{article.series.title}</p>
                  {article.series.description && (
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">
                      {article.series.description}
                    </p>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* ── RELATED ───────────────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <div className="border-t border-white/8 bg-white/2">
          <div className="max-w-[1100px] mx-auto px-6 py-12">
            <RelatedArticles articles={related} />
          </div>
        </div>
      )}
    </>
  )
}
