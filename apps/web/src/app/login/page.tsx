'use client';

import { useState, Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@rosovia/integrations/browser';
import { loginSchema, type LoginInput } from '@rosovia/core';
import { signInWithEmail } from '@rosovia/api/client';
import { ensureUserProfile, getDashboardRedirectPath } from '@rosovia/api/client';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@rosovia/ui';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedFrom = searchParams.get('redirected_from');
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (values: LoginInput) => {
    setServerError(null);

    try {
      const supabase = createSupabaseBrowserClient();

      const { error } = await signInWithEmail(supabase, {
        email: values.email,
        password: values.password,
      });

      if (error) {
        setServerError('Invalid email or password. Please try again.');
        return;
      }

      const profile = await ensureUserProfile(supabase);

      if (!profile) {
        router.push('/select-role');
        return;
      }

      if (profile.status === 'suspended') {
        await supabase.auth.signOut();
        setServerError('Your account has been suspended. Please contact support.');
        return;
      }

      if (profile.status === 'deleted') {
        await supabase.auth.signOut();
        setServerError('This account no longer exists.');
        return;
      }

      if (redirectedFrom) {
        router.push(redirectedFrom);
      } else {
        router.push(getDashboardRedirectPath(profile.role));
      }
    } catch (error) {
      console.error('Login failed:', error);

      setServerError(
        error instanceof Error
          ? error.message
          : 'Login failed because of an unexpected error. Please try again.'
      );
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <p className="text-sm text-gray-500">Log in to your Rosovia account.</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
            <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
              <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-gray-900">
                Forgot password?
              </Link>
            </div>
            <Input id="password" type="password" placeholder="Your password" {...register('password')} />
            {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
          </div>

          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{serverError}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>

          <p className="text-center text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-gray-900 hover:underline">
              Sign up
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Suspense fallback={
        <Card className="w-full max-w-md p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
        </Card>
      }>
        <LoginFormContent />
      </Suspense>
    </div>
  );
}
