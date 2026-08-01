import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { buildHomeMetadata } from '@/lib/schoolConcepts/pageMetadata'
import { Hero } from '@/components/school-concept/Hero'
import { EducationJourneyCards } from '@/components/school-concept/EducationJourneyCards'
import { WebsiteFunctionsSection } from '@/components/school-concept/WebsiteFunctionsSection'
import { NewsPreview } from '@/components/school-concept/NewsPreview'
import { ParentInfoSection } from '@/components/school-concept/ParentInfoSection'
import { BeyondWebsiteSection } from '@/components/school-concept/BeyondWebsiteSection'

type PageParams = { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  return config ? buildHomeMetadata(config) : { title: 'School concept' }
}

export default async function SchoolConceptHomePage({ params }: PageParams) {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  if (!config) notFound()

  return (
    <>
      <Hero config={config} />
      <EducationJourneyCards config={config} />
      <NewsPreview config={config} />
      <ParentInfoSection config={config} />
      <WebsiteFunctionsSection config={config} />
      <BeyondWebsiteSection />
    </>
  )
}
