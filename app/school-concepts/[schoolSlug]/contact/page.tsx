import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { buildPageMetadata } from '@/lib/schoolConcepts/pageMetadata'
import { PageIntro } from '@/components/school-concept/PageIntro'
import { DemoEnquiryForm } from '@/components/school-concept/DemoEnquiryForm'

type PageParams = { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  return config ? buildPageMetadata(config, 'Contact') : { title: 'School concept' }
}

export default async function ContactPage({ params }: PageParams) {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  if (!config) notFound()

  const fields = [config.contact.phone, config.contact.email, config.contact.postalAddress, config.contact.physicalLocation]

  return (
    <>
      <PageIntro title="Contact" description="Official contact details will be added after approval by the school." />
      <div className="mx-auto grid max-w-4xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2">
        <section>
          <h2 className="text-lg font-bold text-[var(--concept-primary-dark)]">Contact details</h2>
          <dl className="mt-4 space-y-4">
            {fields.map((field) => (
              <div key={field.label} className="rounded-lg border border-[var(--concept-charcoal)]/10 bg-white p-4">
                <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--concept-charcoal)]/60">
                  {field.label}
                </dt>
                <dd className="mt-1 text-sm font-medium text-[var(--concept-charcoal)]">{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2 className="text-lg font-bold text-[var(--concept-primary-dark)]">Send a demonstration enquiry</h2>
          <p className="mt-2 text-sm text-[var(--concept-charcoal)]/70">
            This form is for demonstration only. It is not connected to any email, WhatsApp, or database — nothing
            you type here is sent anywhere.
          </p>
          <div className="mt-4">
            <DemoEnquiryForm />
          </div>
        </section>
      </div>
    </>
  )
}
