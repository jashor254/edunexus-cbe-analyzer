import { createServiceClient } from '@/utils/supabase/service'

export async function getGradeTopics(
  grade: number,
  subject: string,
  _weakestFirst: boolean = true
): Promise<string[]> {
  try {
    const db = createServiceClient()

    // 1. Grade IDs matching numeric_grade
    const { data: gradeRows } = await db
      .from('sow_grades')
      .select('id')
      .eq('numeric_grade', grade)

    if (!gradeRows?.length) return []
    const gradeIds = gradeRows.map((g: { id: string }) => g.id)

    // 2. Learning areas matching subject name for those grades
    const { data: areas } = await db
      .from('sow_learning_areas')
      .select('id')
      .in('grade_id', gradeIds)
      .ilike('name', `%${subject}%`)

    if (!areas?.length) return []
    const areaIds = areas.map((a: { id: string }) => a.id)

    // 3. Strands for those learning areas
    const { data: strands } = await db
      .from('sow_strands')
      .select('id')
      .in('learning_area_id', areaIds)
      .order('order_index')

    if (!strands?.length) return []
    const strandIds = strands.map((s: { id: string }) => s.id)

    // 4. Top 5 substrands in curriculum order
    const { data: substrands } = await db
      .from('sow_substrands')
      .select('title')
      .in('strand_id', strandIds)
      .order('order_index')
      .limit(5)

    return (substrands ?? [])
      .map((s: { title: string }) => s.title)
      .filter(Boolean)
  } catch {
    return []
  }
}
