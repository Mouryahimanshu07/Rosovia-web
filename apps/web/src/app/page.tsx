import { TOP_CATEGORIES } from '@rosovia/core';
import { Button, Card, CardContent, CardHeader, CardTitle, Badge } from '@rosovia/ui';
import Link from 'next/link';
import { ShieldCheck, TrendingUp, Sparkles, UserCheck } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="w-full py-20 md:py-32 lg:py-40 bg-gray-50 text-center px-4">
        <div className="container mx-auto max-w-5xl space-y-6">
          <Badge className="mb-4" variant="secondary">Verified Talent-Commerce Marketplace</Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Showcase your talent. <br className="hidden sm:block" /> Connect with buyers.
          </h1>
          <p className="mx-auto max-w-[700px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
            Rosovia is not a social media app. It&apos;s a secure marketplace for artists, artisans, coders, and skilled people to sell products, offer services, and teach skills.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <Button size="lg" asChild>
              <Link href="/explore">Explore Categories</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/signup">Become a Creator</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Top Categories */}
      <section className="w-full py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight">Explore Categories</h2>
            <p className="text-gray-500 mt-2">Discover verified talent across products, services, and learning.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {TOP_CATEGORIES.map((category) => (
              <Card key={category.slug} className="group hover:border-gray-900 transition-colors">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {category.name}
                  </CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="outline">{category.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">{category.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Verification */}
      <section className="w-full py-20 bg-gray-50 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-12">Built on Trust</h2>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-white border">
                <ShieldCheck className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="font-semibold text-lg">Verified Creators</h3>
              <p className="text-sm text-gray-500">Every seller and creator goes through our verification process.</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-white border">
                <UserCheck className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="font-semibold text-lg">Secure Transactions</h3>
              <p className="text-sm text-gray-500">Safe payments and communication managed within the platform.</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 rounded-full bg-white border">
                <Sparkles className="h-6 w-6 text-gray-900" />
              </div>
              <h3 className="font-semibold text-lg">Quality Guaranteed</h3>
              <p className="text-sm text-gray-500">A community dedicated to high-quality products and services.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
