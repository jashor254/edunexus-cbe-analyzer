import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { buildPageMetadata } from '@/lib/schoolConcepts/pageMetadata'
import { PageIntro } from '@/components/school-concept/PageIntro'

type PageParams = { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  return config ? buildPageMetadata(config, 'Admissions') : { title: 'School concept' }
}

export default async function AdmissionsPage({ params }: PageParams) {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  if (!config) notFound()

  return (
    <>
      <PageIntro
        title="Admissions"
        description="Sample structure — official requirements will be confirmed by the school."
      />
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--concept-clay)]">Admissions Office</p>

        <section className="mb-10 mt-2">
          <h2 className="font-[family-name:var(--font-institutional)] text-lg font-bold text-[var(--concept-primary-dark)]">
            Admission levels
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

        <section className="mb-10">
          <h2 className="font-[family-name:var(--font-institutional)] text-lg font-bold text-[var(--concept-primary-dark)]">
            Documents normally requested
          </h2>
          <ul className="mt-3 space-y-2">
            {config.admissions.documents.map((doc) => (
              <li key={doc} className="text-sm leading-relaxed text-[var(--concept-charcoal)]/80">
                • {doc}
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-10">
          <h2 className="font-[family-name:var(--font-institutional)] text-lg font-bold text-[var(--concept-primary-dark)]">
            Admission enquiry process
          </h2>
          <ol className="mt-3 space-y-2">
            {config.admissions.enquiryProcessSteps.map((step, index) => (
              <li key={step} className="text-sm leading-relaxed text-[var(--concept-charcoal)]/80">
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </section>

        <section>
          <h2 className="font-[family-name:var(--font-institutional)] text-lg font-bold text-[var(--concept-primary-dark)]">
            Frequently asked questions
          </h2>
          <div className="mt-3 divide-y divide-[var(--concept-charcoal)]/10 border-t border-[var(--concept-charcoal)]/10">
            {config.admissions.faqs.map((faq) => (
              <div key={faq.question} className="border-l-2 border-[var(--concept-clay)]/50 py-4 pl-4">
                <p className="text-sm font-semibold text-[var(--concept-charcoal)]">{faq.question}</p>
                <p className="mt-1 text-sm leading-relaxed text-[var(--concept-charcoal)]/75">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
