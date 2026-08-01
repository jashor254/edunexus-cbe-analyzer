import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { buildPageMetadata } from '@/lib/schoolConcepts/pageMetadata'
import { PageIntro } from '@/components/school-concept/PageIntro'

type PageParams = { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  return config ? buildPageMetadata(config, 'About') : { title: 'School concept' }
}

export default async function AboutPage({ params }: PageParams) {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  if (!config) notFound()

  return (
    <>
      <PageIntro title="About the school" description={config.about.intro} />
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <section className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--concept-clay)]">School Administration</p>
          <h2 className="mt-1 font-[family-name:var(--font-institutional)] text-lg font-bold text-[var(--concept-primary-dark)]">
            Our story
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--concept-charcoal)]/75">{config.about.storyNote}</p>
        </section>
        <section className="mb-8 border-t border-[var(--concept-charcoal)]/10 pt-8">
          <h2 className="font-[family-name:var(--font-institutional)] text-lg font-bold text-[var(--concept-primary-dark)]">
            Mission &amp; vision
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--concept-charcoal)]/75">{config.about.missionNote}</p>
        </section>
        <section className="border-t border-[var(--concept-charcoal)]/10 pt-8">
          <h2 className="font-[family-name:var(--font-institutional)] text-lg font-bold text-[var(--concept-primary-dark)]">
            What the school covers
          </h2>
          <p className="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-sm text-[var(--concept-charcoal)]">
            {config.levels.map((level, index) => (
              <span key={level.id}>
                <span className="font-semibold">{level.name}</span>
                {index < config.levels.length - 1 && <span className="text-[var(--concept-charcoal)]/40"> · </span>}
              </span>
            ))}
          </p>
        </section>
      </div>
    </>
  )
}
