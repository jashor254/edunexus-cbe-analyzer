// app/api/academic-clinic/pdf/route.ts
//
// P0 CLOSED (Learner Report Architecture audit, Phase 1): this route used to
// accept a client-supplied, pre-built AcademicClinicReport and PDF it with no
// ownership check, no checkFeatureAccess('clinic_report') entitlement check,
// and no token deduction — a complete bypass of the paid clinic_report
// feature. It now delegates to the same trusted handler as
// /api/clinic/download, which resolves the report server-side from a
// database-verified, user-owned student row and only ever trusts the
// client for studentId + raw assessment rows, never for computed report
// content. Do not re-add ownership/entitlement/token logic here.
import { handleClinicPdfDownload } from '@/lib/academicClinic/clinicPdfHandler'

export async function POST(req: Request) {
  return handleClinicPdfDownload(req)
}
