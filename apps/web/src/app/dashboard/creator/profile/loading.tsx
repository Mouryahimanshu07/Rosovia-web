export default function CreatorProfileLoading() {
  return (
    <div className="p-6 max-w-2xl space-y-5 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-52 bg-gray-200 rounded-lg" />
        <div className="h-4 w-72 bg-gray-100 rounded" />
      </div>

      {/* Profile header card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-start gap-5">
        <div className="w-16 h-16 rounded-full bg-gray-200 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-40 bg-gray-200 rounded" />
          <div className="h-4 w-32 bg-gray-100 rounded" />
          <div className="h-4 w-24 bg-gray-100 rounded" />
        </div>
      </div>

      {/* Bio card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-2">
        <div className="h-4 w-12 bg-gray-200 rounded" />
        <div className="h-3 w-full bg-gray-100 rounded" />
        <div className="h-3 w-5/6 bg-gray-100 rounded" />
      </div>

      {/* Skills/Languages/Location row */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-4 w-20 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-100 rounded" />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <div className="h-9 w-28 bg-gray-200 rounded-md" />
        <div className="h-9 w-36 bg-gray-100 rounded-md" />
      </div>
    </div>
  );
}
