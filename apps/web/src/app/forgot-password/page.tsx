'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
// FIX (RC-3): Use the singleton browser client instead of creating a new instance.
import { getSupabaseBrowserClient } from '~/lib/supabase/client';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@rosovia/core';
import { sendPasswordResetEmail } from '@rosovia/api/client';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@rosovia/ui';

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
  });

  const onSubmit = async (values: ForgotPasswordInput) => {
    // FIX (RC-3): Use singleton client so auth events propagate to AuthProvider.
    const supabase = getSupabaseBrowserClient();
    const origin = window.location.origin;

    await sendPasswordResetEmail(
      supabase,
      values.email,
      `${origin}/auth/callback?redirect_to=/reset-password`
    );

    // Always show success — do not leak whether email exists.
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              If an account exists for that email address, we&apos;ve sent a password reset link. Please check your inbox and spam folder.
            </p>
            <Link href="/login" className="text-sm text-gray-900 underline">
              Back to login
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <p className="text-sm text-gray-500">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
              <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>

            <p className="text-center text-sm text-gray-500">
              <Link href="/login" className="text-gray-900 hover:underline">
                Back to login
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
