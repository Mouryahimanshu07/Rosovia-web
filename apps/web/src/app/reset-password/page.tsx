'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@rosovia/integrations/browser';
import { resetPasswordSchema, type ResetPasswordInput } from '@rosovia/core';
import { updatePassword } from '@rosovia/api/client';
import { getCurrentProfile } from '@rosovia/api/client';
import { getDashboardRedirectPath } from '@rosovia/api/client';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@rosovia/ui';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const onSubmit = async (values: ResetPasswordInput) => {
    setServerError(null);
    const supabase = createSupabaseBrowserClient();

    const { error } = await updatePassword(supabase, values.password);

    if (error) {
      setServerError(error.message);
      return;
    }

    const profile = await getCurrentProfile(supabase);
    const redirect = profile ? getDashboardRedirectPath(profile.role) : '/login';
    router.push(redirect);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Set a new password</CardTitle>
          <p className="text-sm text-gray-500">Choose a strong password for your account.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">New password</label>
              <Input id="password" type="password" placeholder="Min. 8 characters" {...register('password')} />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm password</label>
              <Input id="confirmPassword" type="password" placeholder="Repeat password" {...register('confirmPassword')} />
              {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{serverError}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Updating…' : 'Update password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
