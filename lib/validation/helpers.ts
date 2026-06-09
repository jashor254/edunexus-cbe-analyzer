// ===========================================
// INPUT VALIDATION HELPERS
// ===========================================

export type ValidationError = {
  field: string
  message: string
}

export type ValidationResult = {
  isValid: boolean
  errors: ValidationError[]
}

// ===========================================
// ASSESSMENT VALIDATION
// ===========================================

export function validateAssessment(data: {
  student_id?: string
  term?: number
  year?: number
  grade?: number
  subject_scores?: Record<string, number>
  subject_marks?: Record<string, { marks: number; total: number }>
}): ValidationResult {
  const errors: ValidationError[] = []

  // Validate student ID
  if (!data.student_id) {
    errors.push({ field: 'student_id', message: 'Student is required' })
  }

  // Validate term
  if (!data.term || data.term < 1 || data.term > 3) {
    errors.push({ field: 'term', message: 'Term must be 1, 2, or 3' })
  }

  // Validate year
  const currentYear = new Date().getFullYear()
  if (!data.year || data.year < 2020 || data.year > currentYear + 2) {
    errors.push({ field: 'year', message: `Year must be between 2020 and ${currentYear + 2}` })
  }

  // Validate grade
  if (!data.grade || data.grade < 4 || data.grade > 12) {
    errors.push({ field: 'grade', message: 'Grade must be between 4 and 12' })
  }

  // Validate subject scores
  if (!data.subject_scores || Object.keys(data.subject_scores).length === 0) {
    errors.push({ field: 'subject_scores', message: 'At least one subject score is required' })
  } else {
    Object.entries(data.subject_scores).forEach(([subject, rating]) => {
      if (rating < 1 || rating > 4) {
        errors.push({ 
          field: `subject_scores.${subject}`, 
          message: `${subject}: Rating must be between 1 and 4` 
        })
      }
    })
  }

  // Validate marks (if provided)
  if (data.subject_marks) {
    Object.entries(data.subject_marks).forEach(([subject, mark]) => {
      if (mark.marks < 0 || mark.marks > mark.total) {
        errors.push({ 
          field: `subject_marks.${subject}`, 
          message: `${subject}: Marks (${mark.marks}) cannot exceed total (${mark.total})` 
        })
      }

      if (mark.total <= 0) {
        errors.push({ 
          field: `subject_marks.${subject}`, 
          message: `${subject}: Total marks must be greater than 0` 
        })
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ===========================================
// STUDENT VALIDATION
// ===========================================

export function validateStudent(data: {
  name?: string
  grade?: number
  date_of_birth?: string
  current_pathway?: string
}): ValidationResult {
  const errors: ValidationError[] = []

  // Validate name
  if (!data.name || data.name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters' })
  }

  if (data.name && data.name.length > 100) {
    errors.push({ field: 'name', message: 'Name must be less than 100 characters' })
  }

  // Validate grade
  if (!data.grade || data.grade < 4 || data.grade > 12) {
    errors.push({ field: 'grade', message: 'Grade must be between 4 and 12' })
  }

  // Validate date of birth
  if (!data.date_of_birth) {
    errors.push({ field: 'date_of_birth', message: 'Date of birth is required' })
  } else {
    const dob = new Date(data.date_of_birth)
    const today = new Date()
    const age = today.getFullYear() - dob.getFullYear()

    if (age < 5 || age > 25) {
      errors.push({ field: 'date_of_birth', message: 'Student age must be between 5 and 25 years' })
    }
  }

  // Validate pathway (required for Grade 10-12)
  if (data.grade && data.grade >= 10) {
    const validPathways = ['STEM', 'Arts & Sports', 'Social Sciences']
    if (!data.current_pathway || !validPathways.includes(data.current_pathway)) {
      errors.push({ 
        field: 'current_pathway', 
        message: 'Pathway is required for Grade 10-12 (STEM, Arts & Sports, or Social Sciences)' 
      })
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ===========================================
// TOPIC/STRAND VALIDATION
// ===========================================

export function validateStrandAssessment(data: {
  subject?: string
  strand?: string
  topic?: string
  rating?: number
  marks?: number
  total_marks?: number
}): ValidationResult {
  const errors: ValidationError[] = []

  if (!data.subject || data.subject.trim().length === 0) {
    errors.push({ field: 'subject', message: 'Subject is required' })
  }

  if (!data.strand || data.strand.trim().length === 0) {
    errors.push({ field: 'strand', message: 'Strand is required' })
  }

  if (!data.topic || data.topic.trim().length === 0) {
    errors.push({ field: 'topic', message: 'Topic is required' })
  }

  if (!data.rating || data.rating < 1 || data.rating > 4) {
    errors.push({ field: 'rating', message: 'Rating must be between 1 and 4' })
  }

  if (data.marks !== undefined && data.total_marks !== undefined) {
    if (data.marks < 0 || data.marks > data.total_marks) {
      errors.push({ field: 'marks', message: 'Marks cannot exceed total marks' })
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

// ===========================================
// DUPLICATE CHECK
// ===========================================

export async function checkDuplicateAssessment(
  supabase: Pick<import('@supabase/supabase-js').SupabaseClient, 'from'>,
  studentId: string,
  term: number,
  year: number
): Promise<{ exists: boolean; assessmentId?: string }> {
  const { data, error } = await supabase
    .from('assessments')
    .select('id')
    .eq('student_id', studentId)
    .eq('term', term)
    .eq('year', year)
    .maybeSingle()

  if (error) {
    console.error('Error checking duplicate:', error)
    return { exists: false }
  }

  return {
    exists: !!data,
    assessmentId: data?.id
  }
}

// ===========================================
// SANITIZATION
// ===========================================

export function sanitizeInput(input: string): string {
  return input
    .trim()
    .replace(/<script.*?>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<.*?>/g, '') // Remove HTML tags
    .slice(0, 1000) // Limit length
}

export function sanitizeNumber(input: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, input))
}

// ===========================================
// FORM ERROR DISPLAY HELPER
// ===========================================

export function getFirstError(errors: ValidationError[], field?: string): string | null {
  if (field) {
    const error = errors.find(e => e.field === field)
    return error?.message || null
  }
  return errors[0]?.message || null
}

export function hasFieldError(errors: ValidationError[], field: string): boolean {
  return errors.some(e => e.field === field)
}

// ===========================================
// USAGE EXAMPLE
// ===========================================

/*
import { validateAssessment, checkDuplicateAssessment } from '@/lib/validation-helpers'
import { showToast } from '@/components/toast-system'

const handleSubmit = async () => {
  // 1. Validate input
  const validation = validateAssessment({
    student_id: studentId,
    term,
    year,
    grade: student.grade,
    subject_scores: scores,
    subject_marks: marks
  })

  if (!validation.isValid) {
    showToast.error('Validation Failed', validation.errors.map(e => e.message).join(', '))
    return
  }

  // 2. Check for duplicates
  const duplicate = await checkDuplicateAssessment(supabase, studentId, term, year)
  
  if (duplicate.exists) {
    showToast.duplicateWarning(term, year, async () => {
      // Overwrite existing
      await supabase
        .from('assessments')
        .update({ subject_scores: scores })
        .eq('id', duplicate.assessmentId)
    })
    return
  }

  // 3. Save data
  const { error } = await supabase
    .from('assessments')
    .insert({ ...data })

  if (error) {
    showToast.error('Failed to save', error.message)
  } else {
    showToast.assessmentSaved(student.name, term, year)
  }
}
*/