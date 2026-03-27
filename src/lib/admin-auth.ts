import { createClient } from '@/lib/supabase/server';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean);

export async function isAdmin(): Promise<{ isAdmin: boolean; userId: string | null; email: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { isAdmin: false, userId: null, email: null };

  const email = user.email?.toLowerCase() || '';
  return {
    isAdmin: ADMIN_EMAILS.includes(email),
    userId: user.id,
    email,
  };
}

export async function requireAdmin() {
  const result = await isAdmin();
  if (!result.isAdmin) {
    throw new Error('Unauthorized: Admin access required');
  }
  return result;
}
