'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@rosovia/integrations/browser';
import { signupSchema, type SignupInput } from '@rosovia/core';
import { signUpWithEmail } from '@rosovia/api/client';
import { ensureUserProfile, getDashboardRedirectPath } from '@rosovia/api/client';
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from '@rosovia/ui';

export default function SignupPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { role: 'buyer' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (values: SignupInput) => {
  setServerError(null);

  try {
    const supabase = createSupabaseBrowserClient();

    const { data, error } = await signUpWithEmail(supabase, {
      email: values.email,
      password: values.password,
      fullName: values.fullName,
      role: values.role,
      username: values.username || undefined,
    });

    if (error) {
      setServerError(error.message);
      return;
    }

    if (data.user && !data.session) {
      setEmailSent(true);
      return;
    }

    if (data.user && data.session) {
      const profile = await ensureUserProfile(supabase);

      if (profile) {
        router.push(getDashboardRedirectPath(profile.role));
        return;
      }

      router.push('/select-role');
      return;
    }

    setServerError(
      'Signup did not return a valid user session. Please check your email or try logging in.'
    );
  } catch (error) {
    console.error('Signup failed:', error);

    setServerError(
      error instanceof Error
        ? error.message
        : 'Signup failed because of an unexpected error. Please try again.'
    );
  }
};

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              We&apos;ve sent a confirmation link to your email address. Click it to activate your account and complete signup.
            </p>
            <p className="text-xs text-gray-400">Didn&apos;t receive it? Check your spam folder.</p>
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
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <p className="text-sm text-gray-500">Join Rosovia as a buyer or creator.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            {/* Role Selection */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-700">I am a</label>
              <div className="grid grid-cols-2 gap-3">
                {(['buyer', 'creator'] as const).map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setValue('role', role)}
                    className={`py-2.5 rounded-md border text-sm font-medium capitalize transition-colors ${
                      selectedRole === role
                        ? 'border-gray-900 bg-gray-900 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
              {errors.role && <p className="text-xs text-red-500">{errors.role.message}</p>}
            </div>

            {/* Full Name */}
            <div className="space-y-1">
              <label htmlFor="fullName" className="text-sm font-medium text-gray-700">Full name</label>
              <Input id="fullName" placeholder="Your full name" {...register('fullName')} />
              {errors.fullName && <p className="text-xs text-red-500">{errors.fullName.message}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium text-gray-700">Email</label>
              <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
              {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-gray-700">Password</label>
              <Input id="password" type="password" placeholder="Min. 8 characters" {...register('password')} />
              {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
            </div>

            {serverError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{serverError}</p>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </Button>

            <p className="text-center text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-gray-900 hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
