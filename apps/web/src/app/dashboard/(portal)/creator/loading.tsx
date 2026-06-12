export default function CreatorDashboardLoading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2 pb-2">
        <div className="h-7 w-48 bg-slate-200 rounded-lg" />
        <div className="h-4 w-96 bg-slate-100 rounded" />
      </div>

      {/* Completion Banner Skeleton */}
      <div className="h-24 w-full bg-slate-100 rounded-2xl border border-slate-200/50" />

      {/* Top Cards Skeleton (4 cols) */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3 w-24 bg-slate-200 rounded" />
              <div className="h-8 w-8 bg-slate-200 rounded-xl" />
            </div>
            <div className="h-8 w-32 bg-slate-200 rounded-lg mt-2" />
            <div className="h-3.5 w-40 bg-slate-100 rounded" />
          </div>
        ))}
      </div>

      {/* Growths Grid Skeleton (4 cols) */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 bg-slate-50/40 p-4 rounded-2xl border border-slate-200/50">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-xl shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-2.5 w-16 bg-slate-200 rounded" />
              <div className="h-4 w-12 bg-slate-205 rounded" />
              <div className="h-2.5 w-24 bg-slate-100 rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Performance Analytics Skeleton */}
      <div className="h-56 bg-slate-50 border border-slate-200/60 rounded-2xl p-5 space-y-4">
        <div className="h-4.5 w-48 bg-slate-200 rounded" />
        <div className="grid gap-5 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 bg-white border border-slate-150 rounded-xl p-4 space-y-3" />
          ))}
        </div>
      </div>

      {/* Bottom Split Feeds Skeleton */}
      <div className="grid gap-6 md:grid-cols-12">
        <div className="md:col-span-8 space-y-6">
          <div className="h-64 bg-slate-50 border border-slate-200/65 rounded-2xl p-5" />
          <div className="h-64 bg-slate-50 border border-slate-200/65 rounded-2xl p-5" />
        </div>
        <div className="md:col-span-4 space-y-6">
          <div className="h-64 bg-slate-50 border border-slate-200/65 rounded-2xl p-5" />
          <div className="h-44 bg-slate-50 border border-slate-200/65 rounded-2xl p-5" />
        </div>
      </div>
    </div>
  );
}
