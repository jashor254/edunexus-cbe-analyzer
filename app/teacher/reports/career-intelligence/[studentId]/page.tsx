import CareerIntelligence from '@/components/teacher/CareerIntelligence'

export default async function CareerIntelligencePage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  return <CareerIntelligence studentId={studentId} />
}
