import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
// @ts-ignore: CSS imports may not have type declarations in this environment
import './globals.css';
import { PostHogProvider } from '~/components/providers/posthog-provider';
import { AppHeader } from '~/components/layout/app-header';
import { AuthProvider } from '~/components/providers/auth-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Rosovia - Verified Talent-Commerce Marketplace',
  description:
    'A verified talent-commerce marketplace for creators, artisans, coders, and skilled people.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Rosovia',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1a1a2e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex min-h-screen flex-col`}>
        <AuthProvider>
          <PostHogProvider>
            <AppHeader />

            <main className="flex-1">{children}</main>


          <footer className="border-t py-6 md:py-0">
            <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:h-16 md:flex-row">
              <p className="text-sm leading-loose text-gray-500">
                © {new Date().getFullYear()} Rosovia. All rights reserved.
              </p>
            </div>
          </footer>
          </PostHogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}