import type { SupabaseClient } from '@supabase/supabase-js';

export interface SignUpParams {
  email: string;
  password: string;
  fullName: string;
  role: 'buyer' | 'creator';
  username?: string;
}

export interface SignInParams {
  email: string;
  password: string;
}

/**
 * Signs up a new user with email/password.
 * Stores safe metadata (fullName, role, username) so ensureUserProfile()
 * can create the profile after email confirmation/callback.
 *
 * NOTE: Admin role is never accepted here.
 */
export async function signUpWithEmail(supabase: SupabaseClient, params: SignUpParams) {
  const safeRole: 'buyer' | 'creator' = params.role === 'creator' ? 'creator' : 'buyer';

  const { data, error } = await supabase.auth.signUp({
    email: params.email,
    password: params.password,
    options: {
      data: {
        full_name: params.fullName,
        role: safeRole,
        username: params.username ?? null,
      },
    },
  });

  return { data, error };
}

/**
 * Signs in a user with email/password.
 */
export async function signInWithEmail(supabase: SupabaseClient, params: SignInParams) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: params.email,
    password: params.password,
  });

  return { data, error };
}

/**
 * Signs out the current user.
 */
export async function signOut(supabase: SupabaseClient) {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Sends a password reset email.
 * Deliberately does not reveal whether the email exists.
 */
export async function sendPasswordResetEmail(
  supabase: SupabaseClient,
  email: string,
  redirectTo: string
) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  return { error };
}

/**
 * Updates the authenticated user's password.
 */
export async function updatePassword(supabase: SupabaseClient, newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  return { data, error };
}

/**
 * Returns the currently authenticated Supabase Auth user.
 */
export async function getCurrentUser(supabase: SupabaseClient) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  return { user, error };
}
