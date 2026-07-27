export default function Loading() {
  return (
    <div className="max-w-5xl mx-auto py-6 px-4 space-y-4 animate-pulse" role="status" aria-label="Loading review workspace">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 h-20" />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(280px,360px)_1fr] gap-4">
        <div className="space-y-2">
          <div className="bg-white rounded-2xl border border-gray-100 h-24" />
          <div className="bg-white rounded-2xl border border-gray-100 h-24" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 h-64" />
      </div>
    </div>
  )
}
