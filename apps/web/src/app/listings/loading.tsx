export default function ListingsLoading() {
  return (
    <div className="min-h-screen bg-gray-50 animate-pulse">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 py-8 space-y-4">
          <div className="h-9 w-52 bg-gray-200 rounded-lg" />
          <div className="h-4 w-96 bg-gray-100 rounded" />
          <div className="h-10 w-full max-w-lg bg-gray-100 rounded-xl" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 flex gap-8">
        {/* Sidebar skeleton */}
        <aside className="w-64 flex-shrink-0 space-y-3">
          <div className="h-5 w-24 bg-gray-200 rounded" />
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-9 bg-gray-100 rounded-lg" />
          ))}
        </aside>

        {/* Grid skeleton */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="h-44 bg-gray-200" />
              <div className="p-4 space-y-2">
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
                <div className="h-3 w-full bg-gray-100 rounded" />
                <div className="h-3 w-2/3 bg-gray-100 rounded" />
                <div className="flex justify-between items-center mt-3">
                  <div className="h-5 w-16 bg-gray-200 rounded" />
                  <div className="h-8 w-20 bg-gray-200 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
