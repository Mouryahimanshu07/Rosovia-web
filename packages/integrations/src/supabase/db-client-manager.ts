import { createClient, SupabaseClient } from '@supabase/supabase-js';

let primaryClient: SupabaseClient | null = null;
let readReplicaClient: SupabaseClient | null = null;

export function getDatabaseClients(): { master: SupabaseClient; replica: SupabaseClient } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!primaryClient && supabaseUrl && supabaseServiceKey) {
    primaryClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  // Check for replica configuration
  const replicaUrl = process.env.SUPABASE_READ_REPLICA_URL;
  if (replicaUrl && supabaseServiceKey) {
    if (!readReplicaClient) {
      readReplicaClient = createClient(replicaUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      });
    }
  } else {
    readReplicaClient = primaryClient;
  }

  return {
    master: primaryClient!,
    replica: readReplicaClient!
  };
}
