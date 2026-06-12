export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-8 animate-pulse text-slate-800">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="h-8 w-48 bg-slate-200 rounded-xl" />
        <div className="h-4 w-96 bg-slate-200 rounded-lg" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-8 w-8 bg-slate-200 rounded-xl" />
            </div>
            <div className="space-y-2">
              <div className="h-6 w-16 bg-slate-200 rounded-lg" />
              <div className="h-3 w-32 bg-slate-200 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Performance & Charts skeleton */}
      <div className="space-y-4">
        <div className="h-4 w-36 bg-slate-200 rounded-md" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
              <div className="h-4 w-28 bg-slate-200 rounded" />
              <div className="h-8 w-full bg-slate-200/60 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
