// app/api/clinic/download/route.ts
//
// Thin delegate — all security/commercial logic lives in the single shared
// handler at lib/academicClinic/clinicPdfHandler.ts, also used by
// /api/academic-clinic/pdf. Do not re-add ownership/entitlement/token logic
// here.
import { handleClinicPdfDownload } from '@/lib/academicClinic/clinicPdfHandler'

export async function POST(req: Request) {
  return handleClinicPdfDownload(req)
}
