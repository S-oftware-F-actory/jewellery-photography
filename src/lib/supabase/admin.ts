import { createClient } from '@supabase/supabase-js';

// Service role client for webhook handlers and admin operations.
// NEVER expose this to the browser — server-side only.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}
