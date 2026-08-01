import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getSchoolConcept } from '@/data/schoolConcepts'
import { buildPageMetadata } from '@/lib/schoolConcepts/pageMetadata'
import { PRE_PRIMARY_ROUTE_SLUG } from '@/data/schoolConcepts/supportedLevelRoutes'
import { LevelPage } from '@/components/school-concept/LevelPage'

type PageParams = { params: Promise<{ schoolSlug: string }> }

export async function generateMetadata({ params }: PageParams): Promise<Metadata> {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  return config ? buildPageMetadata(config, 'Pre-Primary') : { title: 'School concept' }
}

export default async function PrePrimaryPage({ params }: PageParams) {
  const { schoolSlug } = await params
  const config = getSchoolConcept(schoolSlug)
  if (!config) notFound()

  return <LevelPage config={config} levelSlug={PRE_PRIMARY_ROUTE_SLUG} />
}
