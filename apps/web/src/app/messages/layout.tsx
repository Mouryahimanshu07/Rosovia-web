import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inbox — Rosovia',
  description: 'Manage your messages and conversations.',
};

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Flush full-bleed wrapper — MessagesClient handles its own sizing
  return (
    <div className="w-full bg-slate-100 px-0 md:px-6 py-0 md:py-6">
      {children}
    </div>
  );
}

