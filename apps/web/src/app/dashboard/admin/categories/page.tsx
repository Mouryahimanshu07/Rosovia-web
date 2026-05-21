import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createWebServerClient } from '~/lib/supabase/server';
import { getCurrentProfile, listCategoriesForAdmin } from '@rosovia/api';
import { CategoriesClient } from './categories-client';

export const metadata: Metadata = {
  title: 'Categories — Admin — Rosovia',
};

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: { status?: string; page?: string };
}) {
  const supabase = createWebServerClient();
  const profile = await getCurrentProfile(supabase);

  if (!profile) redirect('/login');
  if (profile.status !== 'active') redirect('/login?error=account_suspended');
  if (profile.role !== 'admin') redirect('/dashboard/' + profile.role);

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const categories = await listCategoriesForAdmin(supabase, {
    status: searchParams.status,
    page,
  });

  return <CategoriesClient categories={categories} />;
}
