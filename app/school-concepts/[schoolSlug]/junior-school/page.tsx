import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { buildPageMetadata } from '@/lib/schoolConcepts/pageMetadata'
import { JUNIOR_SCHOOL_ROUTE_SLUG } from '@/data/schoolConcepts/supportedLevelRoutes'
import { LevelPage } from '@/components/school-concept/LevelPage'

type PageParams = { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  return config ? buildPageMetadata(config, 'Junior School') : { title: 'School concept' }
}

export default async function JuniorSchoolPage({ params }: PageParams) {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  if (!config) notFound()

  return <LevelPage config={config} levelSlug={JUNIOR_SCHOOL_ROUTE_SLUG} />
}
