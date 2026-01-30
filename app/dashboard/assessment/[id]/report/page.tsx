import { generateAcademicClinicReport } from '@/lib/academicClinic/reportGenerator';
import DownloadClinicButton from '@/components/clinic/DownloadClinicButton'; // Hakikisha uliunda hii
import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';

// --- UTILITY FUNCTIONS ---
const formatSalaryRange = (min: number, max: number) => {
  return `KES ${min.toLocaleString()} - ${max.toLocaleString()}`;
};

async function getAssessment(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('assessments')
    .select('*, students(*)')
    .eq('id', id)
    .single();

  if (error || !data) redirect('/dashboard');
  return {
    studentProfile: data.students,
    scores: data.scores,
    historicalData: data.historical_metadata // optional
  };
}

async function checkPaymentStatus(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('payments')
    .select('status')
    .eq('student_id', studentId)
    .eq('item_type', 'ACADEMIC_REPORT')
    .eq('status', 'completed')
    .single();
  
  return !!data; // Itarudisha true kama amelipa
}

export default async function ReportPage({ params }: { params: { id: string } }) {
  const assessment = await getAssessment(params.id);
  const hasPaid = await checkPaymentStatus(assessment.studentProfile.id);
  
  const report = await generateAcademicClinicReport(
    assessment.studentProfile,
    assessment.scores,
    assessment.historicalData
  );
  
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-10">
      {/* 1. EXECUTIVE SUMMARY */}
      <section className="bg-white p-8 rounded-2xl shadow-sm border border-blue-50">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">🏥 Academic Clinic Report</h1>
            <p className="text-slate-500 mt-1">Diagnostic Analysis for {assessment.studentProfile.name}</p>
          </div>
          <div className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full font-bold">
            {report.overallHealthLabel} Health
          </div>
        </div>
        
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-sm text-slate-500 uppercase font-bold">Recommended Pathway</p>
            <p className="text-xl font-bold text-slate-800">{report.recommendedPathway}</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl">
            <p className="text-sm text-slate-500 uppercase font-bold">Match Confidence</p>
            <p className="text-xl font-bold text-slate-800">{report.pathwayMatch.confidence}</p>
          </div>
        </div>
      </section>

      {/* 2. CAREER PREVIEW & AI IMPACT */}
      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2">🎯 Top Career Matches</h2>
        <div className="grid grid-cols-1 gap-4 mt-6">
          {report.topCareers.map((career, idx) => (
            <div key={career.id} className="group border rounded-2xl p-6 hover:border-blue-300 transition-all bg-white">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">{idx + 1}. {career.name}</h3>
                <span className="text-green-600 font-bold">{formatSalaryRange(career.salary.entry.min, career.salary.entry.max)}</span>
              </div>
              
              {/* AI Impact - Highlighting your Differentiator */}
              <div className="mt-4 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <h4 className="flex items-center gap-2 font-bold text-blue-800">
                  <span>🤖</span> AI Impact Forecast (2025-2044)
                </h4>
                <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <p><span className="text-slate-500">Risk:</span> {career.aiImpact.disruptionPercentage}%</p>
                  <p><span className="text-slate-500">Growth:</span> +{career.aiImpact.growthPercentage}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. THE INVESTMENT & ROI SECTION (Marketing Logic) */}
      <section className="bg-amber-50 p-8 rounded-3xl border border-amber-100">
        <h2 className="text-2xl font-bold text-amber-900">📋 90-Day Success Blueprint</h2>
        
        <div className="mt-6 space-y-4">
           {/* Hapa tunaonyesha tu action 1, nyingine tunaficha kama hajalipa */}
           <div className="p-4 bg-white/60 rounded-lg">
              <p className="font-bold">Immediate Task: {report.actionPlan.immediate[0].action}</p>
              <p className="text-sm text-slate-600 italic">{report.actionPlan.immediate[0].rationale}</p>
           </div>
           
           {!hasPaid && (
             <div className="text-center py-4 bg-white/30 rounded-lg border-2 border-dashed border-amber-200">
                <p className="text-sm font-medium text-amber-800">...and {report.actionPlan.immediate.length - 1} more critical steps locked</p>
             </div>
           )}
        </div>

        <div className="mt-8 pt-6 border-t border-amber-200">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm text-amber-700">Estimated Support Investment</p>
              <p className="text-3xl font-black text-amber-900">KES {report.actionPlan.estimatedInvestment.total.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-amber-600 font-bold uppercase tracking-wider">Projected ROI</p>
              <p className="text-xl font-bold text-green-700">20,000%+ Lifetime</p>
            </div>
          </div>
        </div>

        {/* THE UTILITY BUTTON (IMPLEMENTATION) */}
        <div className="mt-8">
          <DownloadClinicButton 
            studentId={assessment.studentProfile.id}
            studentName={assessment.studentProfile.name}
            hasPaid={hasPaid}
            scores={assessment.scores}
            profile={assessment.studentProfile}
          />
        </div>
      </section>
    </div>
  );
}