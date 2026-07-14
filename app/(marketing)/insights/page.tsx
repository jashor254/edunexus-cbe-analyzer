import { Suspense } from 'react'
import type { Metadata } from 'next'
import { ArrowRight, BookOpen, Users, Zap } from 'lucide-react'
import { getFeaturedArticles, getLatestArticles } from '@/lib/insights/articles'
import { getCategoriesWithCount } from '@/lib/insights/categories'
import { FeaturedArticle }     from '@/components/insights/FeaturedArticle'
import { ArticleCard }         from '@/components/insights/ArticleCard'
import { TopicsGrid }          from '@/components/insights/TopicsGrid'
import { NewsletterSignup }    from '@/components/insights/NewsletterSignup'
import { InsightsSearchBar }   from '@/components/insights/InsightsSearchBar'
import { CategoryFilterBar }   from '@/components/insights/CategoryFilterBar'

export const metadata: Metadata = {
  title:       'EduNexus Insights — Ideas shaping the future of education',
  description: 'Original research, frameworks, and thinking on Learning Intelligence, AI in Education, and the future of learning in Kenya and beyond.',
  openGraph: {
    title:       'EduNexus Insights',
    description: 'Original thinking on Learning Intelligence, AI in Education, and the future of learning.',
    url:         'https://edunexus.co.ke/insights',
    type:        'website',
  },
  alternates: { canonical: 'https://edunexus.co.ke/insights' },
}

type PageProps = {
  searchParams: Promise<{ category?: string; page?: string }>
}

export default async function InsightsPage({ searchParams }: PageProps) {
  const params      = await searchParams
  const page        = Math.max(1, parseInt(params.page ?? '1', 10))
  const categorySlug = params.category && params.category !== 'featured'
    ? params.category
    : undefined
  const showFeaturedOnly = params.category === 'featured'

  const [featured, latest, categories] = await Promise.all([
    getFeaturedArticles(),
    getLatestArticles(page, 9, categorySlug),
    getCategoriesWithCount(),
  ])

  const showFeaturedHero = !params.category && page === 1
  const heroArticle      = featured[0]

  return (
    <div className="min-h-screen">
      {/* ── HERO ──────────────────────────────────────────────────────────────── */}
      <section className="pt-20 pb-14 border-b border-white/8">
        <div className="max-w-[1100px] mx-auto px-6">

          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6">
              ✦ EduNexus Insights
            </div>

            <h1
              className="font-extrabold text-white leading-[1.05] tracking-tight mb-4"
              style={{ fontSize: 'clamp(36px, 5vw, 58px)', letterSpacing: '-0.025em' }}
            >
              Ideas shaping the
              <span className="block bg-gradient-to-r from-violet-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
                future of education.
              </span>
            </h1>

            <p className="text-lg text-white/50 max-w-xl mx-auto leading-relaxed">
              Original research, frameworks, and thinking on Learning Intelligence,
              AI in Education, and the future of learning in Kenya and beyond.
            </p>
          </div>

          {/* Search */}
          <Suspense>
            <InsightsSearchBar />
          </Suspense>

          {/* Quick stats */}
          <div className="flex items-center justify-center gap-8 mt-10">
            {[
              { icon: <BookOpen className="w-4 h-4" />, label: `${latest.total} articles` },
              { icon: <Users className="w-4 h-4" />,    label: 'Research & Founder Notes' },
              { icon: <Zap className="w-4 h-4" />,      label: 'Weekly insights' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 text-xs text-white/30">
                <span className="text-white/20">{stat.icon}</span>
                {stat.label}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1100px] mx-auto px-6">

        {/* ── FEATURED ────────────────────────────────────────────────────────── */}
        {showFeaturedHero && heroArticle && (
          <section className="pt-12 pb-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-1 h-4 bg-violet-500 rounded-full" />
              <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">Featured</h2>
            </div>
            <FeaturedArticle article={heroArticle} />
          </section>
        )}

        {/* ── FILTERS ─────────────────────────────────────────────────────────── */}
        <div className="pt-8 pb-6 border-b border-white/8">
          <Suspense>
            <CategoryFilterBar categories={categories} />
          </Suspense>
        </div>

        {/* ── ARTICLES GRID ───────────────────────────────────────────────────── */}
        <section className="py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-extrabold text-white">
                {showFeaturedOnly ? 'Featured Insights' :
                 categorySlug
                   ? categories.find((c) => c.slug === categorySlug)?.name ?? 'Insights'
                   : 'Latest Insights'}
              </h2>
              {latest.total > 0 && (
                <p className="text-xs text-white/30 mt-1">{latest.total} article{latest.total !== 1 ? 's' : ''}</p>
              )}
            </div>
          </div>

          {latest.articles.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {latest.articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-white/30 text-lg">No articles yet in this category.</p>
              <p className="text-white/20 text-sm mt-2">Check back soon — we publish regularly.</p>
            </div>
          )}

          {/* Pagination */}
          {latest.total > latest.perPage && (
            <div className="flex items-center justify-center gap-3 mt-12">
              {page > 1 && (
                <a
                  href={`/insights?page=${page - 1}${categorySlug ? `&category=${categorySlug}` : ''}`}
                  className="px-5 py-2.5 text-sm font-semibold bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                >
                  ← Previous
                </a>
              )}
              <span className="text-sm text-white/30">
                Page {page} of {Math.ceil(latest.total / latest.perPage)}
              </span>
              {page < Math.ceil(latest.total / latest.perPage) && (
                <a
                  href={`/insights?page=${page + 1}${categorySlug ? `&category=${categorySlug}` : ''}`}
                  className="px-5 py-2.5 text-sm font-semibold bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                >
                  Next →
                </a>
              )}
            </div>
          )}
        </section>

        {/* ── TOPICS ──────────────────────────────────────────────────────────── */}
        <section className="py-10 border-t border-white/8">
          <div className="flex items-center gap-2 mb-6">
            <span className="w-1 h-4 bg-violet-500 rounded-full" />
            <h2 className="text-xs font-bold text-white/40 uppercase tracking-widest">Explore by Topic</h2>
          </div>
          <TopicsGrid categories={categories} />
        </section>

        {/* ── NEWSLETTER ──────────────────────────────────────────────────────── */}
        <section className="py-12 border-t border-white/8 mb-8">
          <div className="bg-white/3 border border-white/8 rounded-3xl px-8 py-10 md:px-12">
            <div className="max-w-lg">
              <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest block mb-3">
                EduNexus Insights Newsletter
              </span>
              <h2 className="text-2xl font-extrabold text-white mb-2 leading-snug" style={{ letterSpacing: '-0.02em' }}>
                Original thinking, delivered.
              </h2>
              <p className="text-white/45 text-sm leading-relaxed mb-6">
                We publish when we have something worth saying. No filler, no noise.
                Just original ideas on Learning Intelligence and the future of education in Kenya.
              </p>
              <NewsletterSignup />
            </div>
          </div>
        </section>

        {/* ── ABOUT + CTA ─────────────────────────────────────────────────────── */}
        <section className="py-10 border-t border-white/8 mb-12">
          <div className="grid md:grid-cols-2 gap-10">
            <div>
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-4">About EduNexus Insights</p>
              <p className="text-sm text-white/50 leading-relaxed mb-3">
                EduNexus Insights is the public knowledge hub of EduNexus — Kenya&apos;s Learning Intelligence Platform.
                We publish original thinking on the systems, architectures, and ideas shaping the future of education.
              </p>
              <p className="text-sm text-white/40 leading-relaxed">
                Our work spans learning intelligence, AI in education, curriculum architecture, career development systems,
                and the practical engineering of intelligent educational platforms.
              </p>
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-4">Explore EduNexus</p>
              <div className="space-y-3">
                {[
                  { label: 'Learner Blueprint',                  href: '/#evidence',     desc: 'See how EduNexus notices a learning problem early' },
                  { label: 'For Schools',                        href: '/#school',       desc: 'Whole-school learning intelligence' },
                  { label: 'For Teachers',                       href: '/#teachers',     desc: 'Plans, insights, and class intelligence' },
                  { label: 'Career Intelligence',                href: '/#career',       desc: 'Where a learner is heading if we keep acting early' },
                ].map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="group flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0 hover:border-white/15 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white/70 group-hover:text-white transition-colors">{link.label}</p>
                      <p className="text-xs text-white/30">{link.desc}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-white/20 group-hover:text-white/50 mt-0.5 shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
