'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@rosovia/integrations/browser';
import { createProfileForAuthUser } from '@rosovia/api/client';
import { getCurrentUser, getDashboardRedirectPath } from '@rosovia/api/client';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@rosovia/ui';

export default function SelectRolePage() {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<'buyer' | 'creator' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSelect = async () => {
    if (!selectedRole) return;
    setIsSubmitting(true);
    setServerError(null);

    const supabase = createSupabaseBrowserClient();
    const { user, error: userError } = await getCurrentUser(supabase);

    if (userError || !user) {
      router.push('/login');
      return;
    }

    try {
      const profile = await createProfileForAuthUser(supabase, {
        authUserId: user.id,
        email: user.email ?? null,
        fullName: (user.user_metadata?.['full_name'] as string | undefined) ?? null,
        role: selectedRole,
      });

      router.push(getDashboardRedirectPath(profile.role));
    } catch {
      setServerError('Could not save your role. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">How will you use Rosovia?</CardTitle>
          <p className="text-sm text-gray-500">Choose your role. You can always contact support to change it later.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(['buyer', 'creator'] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`py-4 rounded-md border text-sm font-medium capitalize transition-colors ${
                  selectedRole === role
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                <div className="font-semibold capitalize">{role}</div>
                <div className="text-xs mt-1 opacity-70">
                  {role === 'buyer' ? 'Browse & buy' : 'Sell & teach'}
                </div>
              </button>
            ))}
          </div>

          {serverError && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{serverError}</p>
            </div>
          )}

          <Button
            className="w-full"
            disabled={!selectedRole || isSubmitting}
            onClick={handleSelect}
          >
            {isSubmitting ? 'Saving…' : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
