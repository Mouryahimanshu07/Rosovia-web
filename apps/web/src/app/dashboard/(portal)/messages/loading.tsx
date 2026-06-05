export default function MessagesLoading() {
  return (
    <div className="h-[calc(100vh-64px)] flex animate-pulse">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="h-9 bg-gray-100 rounded-lg" />
        </div>
        <div className="flex-1 divide-y divide-gray-100">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-28 bg-gray-200 rounded" />
                <div className="h-3 w-40 bg-gray-100 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col bg-gray-50">
        {/* Top bar */}
        <div className="h-16 border-b border-gray-200 bg-white px-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gray-200" />
          <div className="h-5 w-36 bg-gray-200 rounded" />
        </div>

        {/* Messages area */}
        <div className="flex-1 p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`rounded-2xl px-4 py-3 space-y-1 ${
                  i % 2 === 0 ? 'bg-white border border-gray-200' : 'bg-gray-200'
                }`}
                style={{ width: `${30 + Math.random() * 30}%` }}
              >
                <div className="h-3 bg-gray-300 rounded w-full" />
                <div className="h-3 bg-gray-300 rounded w-3/4" />
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div className="border-t border-gray-200 bg-white p-4">
          <div className="h-12 bg-gray-100 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
