import { type SupabaseClient } from '@supabase/supabase-js';
import { getDatabaseClients } from '@rosovia/integrations';

export function createAdminSupabaseClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('Security Error: createAdminSupabaseClient must only be called server-side!');
  }

  const { master } = getDatabaseClients();
  if (!master) {
    throw new Error(
      'Missing Supabase admin configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set server-side.'
    );
  }
  return master;
}

export function createAdminSupabaseReadReplicaClient(): SupabaseClient {
  if (typeof window !== 'undefined') {
    throw new Error('Security Error: createAdminSupabaseReadReplicaClient must only be called server-side!');
  }

  const { replica } = getDatabaseClients();
  if (!replica) {
    throw new Error(
      'Missing Supabase admin configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set server-side.'
    );
  }
  return replica;
}