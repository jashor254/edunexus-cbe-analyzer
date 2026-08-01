import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { buildPageMetadata } from '@/lib/schoolConcepts/pageMetadata'
import { PageIntro } from '@/components/school-concept/PageIntro'

type PageParams = { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  return config ? buildPageMetadata(config, 'News & Events') : { title: 'School concept' }
}

export default async function NewsEventsPage({ params }: PageParams) {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  if (!config) notFound()

  return (
    <>
      <PageIntro
        title="News & Events"
        description="These items are sample content showing how announcements and events could appear."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <ul className="divide-y divide-[var(--concept-charcoal)]/10 border-y border-[var(--concept-charcoal)]/10">
          {config.sampleNews.map((item) => (
            <li key={item.title} className="border-l-2 border-[var(--concept-clay)]/50 py-5 pl-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--concept-clay)]">{item.category}</span>
              <h2 className="mt-1 font-[family-name:var(--font-institutional)] text-base font-bold text-[var(--concept-primary-dark)]">
                {item.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--concept-charcoal)]/75">{item.summary}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
