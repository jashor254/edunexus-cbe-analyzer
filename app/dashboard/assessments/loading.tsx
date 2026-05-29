import { AssessmentListSkeleton } from '@/components/ui/skeletons'

export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <AssessmentListSkeleton />
    </div>
  )
}
