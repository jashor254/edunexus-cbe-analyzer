import LearnerBlueprint from '@/components/teacher/LearnerBlueprint'

export default async function LearnerBlueprintPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const { studentId } = await params
  return <LearnerBlueprint studentId={studentId} />
}
