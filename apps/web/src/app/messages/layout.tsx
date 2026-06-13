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
  return <>{children}</>;
}
