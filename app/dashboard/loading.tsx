export default function Loading() {
  return (
    <div className="p-6 space-y-6 w-full animate-pulse">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div className="h-8 w-48 bg-gray-200 rounded-md" />
        <div className="h-10 w-32 bg-gray-200 rounded-lg" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 rounded-xl border border-gray-200" />
        ))}
      </div>

      {/* Main Content Skeleton */}
      <div className="space-y-4">
        <div className="h-6 w-1/4 bg-gray-200 rounded" />
        <div className="h-64 bg-gray-50 rounded-xl border border-dashed border-gray-300" />
      </div>
    </div>
  );
}