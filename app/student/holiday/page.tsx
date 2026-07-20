import StudentHolidayPlan from '@/components/student/StudentHolidayPlan'
import JourneyLinks from '@/components/student/JourneyLinks'

export default function StudentHolidayPage() {
  return (
    <>
      <StudentHolidayPlan />
      <JourneyLinks current="holiday" />
    </>
  )
}
