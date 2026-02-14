// components/ui/skeletons.tsx

export function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-12 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center mb-12">
        <div className="space-y-3">
          <div className="h-10 w-64 bg-slate-200 rounded-2xl"></div>
          <div className="h-4 w-40 bg-slate-100 rounded-lg"></div>
        </div>
        <div className="h-14 w-40 bg-slate-200 rounded-full"></div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-slate-50 border-2 border-slate-100 rounded-[32px]"></div>
        ))}
      </div>

      {/* Student Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div 
            key={i} 
            className="h-64 bg-white border-2 border-slate-100 rounded-[40px] p-8 space-y-4"
          >
            <div className="h-12 w-12 bg-slate-200 rounded-2xl"></div>
            <div className="h-8 w-3/4 bg-slate-200 rounded-xl"></div>
            <div className="h-4 w-1/2 bg-slate-100 rounded-lg"></div>
            <div className="pt-6 flex justify-between">
              <div className="h-6 w-24 bg-slate-100 rounded-full"></div>
              <div className="h-10 w-10 bg-slate-200 rounded-full"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// NEW: Career Analysis Skeleton
export function CareerAnalysisSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      {/* Header */}
      <div className="h-12 w-3/4 bg-slate-200 rounded-2xl"></div>
      <div className="h-6 w-1/2 bg-slate-100 rounded-lg"></div>
      
      {/* Pathway Card */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-[40px] p-8 border-2 border-slate-200">
        <div className="h-8 w-48 bg-slate-200 rounded-xl mb-4"></div>
        <div className="h-6 w-32 bg-slate-100 rounded-full mb-6"></div>
        <div className="space-y-2">
          <div className="h-4 w-full bg-slate-100 rounded"></div>
          <div className="h-4 w-5/6 bg-slate-100 rounded"></div>
        </div>
      </div>
      
      {/* Career Cards Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border-2 border-slate-100 rounded-[32px] p-6 space-y-4">
            <div className="h-6 w-2/3 bg-slate-200 rounded-xl"></div>
            <div className="flex gap-2">
              <div className="h-8 w-24 bg-slate-100 rounded-full"></div>
              <div className="h-8 w-24 bg-slate-100 rounded-full"></div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-slate-50 rounded"></div>
              <div className="h-3 w-4/5 bg-slate-50 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// NEW: Academic Clinic Report Skeleton
export function ClinicReportSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="h-10 w-3/4 bg-slate-200 rounded-2xl"></div>
        <div className="h-5 w-1/2 bg-slate-100 rounded-lg"></div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border-2 border-slate-100 rounded-[32px] p-6 space-y-3">
            <div className="h-12 w-12 bg-slate-200 rounded-2xl"></div>
            <div className="h-6 w-3/4 bg-slate-200 rounded-xl"></div>
            <div className="h-4 w-1/2 bg-slate-100 rounded"></div>
          </div>
        ))}
      </div>
      
      {/* Action Plan */}
      <div className="bg-red-50 rounded-[40px] p-8 border-2 border-slate-200 space-y-4">
        <div className="h-8 w-48 bg-slate-200 rounded-xl"></div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-4 space-y-2">
              <div className="h-5 w-2/3 bg-slate-200 rounded"></div>
              <div className="h-3 w-full bg-slate-100 rounded"></div>
              <div className="h-3 w-4/5 bg-slate-100 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// NEW: Assessment List Skeleton
export function AssessmentListSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-white border-2 border-slate-100 rounded-[32px] p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-6 w-48 bg-slate-200 rounded-xl"></div>
              <div className="h-4 w-32 bg-slate-100 rounded"></div>
            </div>
            <div className="h-10 w-24 bg-slate-100 rounded-full"></div>
          </div>
        </div>
      ))}
    </div>
  );
}