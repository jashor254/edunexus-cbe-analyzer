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

// Unaweza kuongeza zingine hapa baadaye (e.g. TableSkeleton)