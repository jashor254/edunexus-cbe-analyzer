import StudentProgress from '@/components/student/StudentProgress'
import JourneyLinks from '@/components/student/JourneyLinks'

export default function StudentProgressPage() {
  return (
    <>
      <StudentProgress />
      <JourneyLinks current="progress" />
    </>
  )
}
