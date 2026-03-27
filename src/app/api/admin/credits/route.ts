import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createLogger } from '@/lib/logging';

const log = createLogger('/api/admin/credits');

export async function POST(request: NextRequest) {
  let adminInfo;
  try {
    adminInfo = await requireAdmin();
  } catch {
    log.warn('Unauthorized admin access attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const adminLog = log.withContext({ adminEmail: adminInfo.email });

  const body = await request.json();
  const { userId, amount, reason } = body as {
    userId: string;
    amount: number;
    reason: string;
  };

  if (!userId || amount === undefined || amount === 0) {
    adminLog.warn('Invalid credit adjustment request', { userId, amount });
    return NextResponse.json({ error: 'userId and non-zero amount are required' }, { status: 400 });
  }

  if (!reason?.trim()) {
    adminLog.warn('Missing reason for credit adjustment', { userId, amount });
    return NextResponse.json({ error: 'Reason is required for audit trail' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Get current credits
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('credits_remaining, email')
    .eq('id', userId)
    .single();

  if (fetchError || !user) {
    adminLog.warn('User not found for credit adjustment', { userId });
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const newCredits = Math.max(0, user.credits_remaining + amount);

  // Update credits
  const { error: updateError } = await supabase
    .from('users')
    .update({ credits_remaining: newCredits })
    .eq('id', userId);

  if (updateError) {
    adminLog.error('Credit update failed', updateError, { userId, amount });
    return NextResponse.json({ error: 'Failed to adjust credits' }, { status: 500 });
  }

  // Log the adjustment in purchases table as audit trail
  const { error: logError } = await supabase
    .from('purchases')
    .insert({
      user_id: userId,
      credits_added: amount,
      stripe_session_id: `manual:${adminInfo.email}:${reason}`,
    });

  if (logError) {
    adminLog.warn('Audit log insert failed (non-fatal)', { error: logError.message });
  }

  adminLog.info('Credit adjustment completed', {
    userId,
    userEmail: user.email,
    amount,
    reason,
    previousCredits: user.credits_remaining,
    newCredits,
  });

  return NextResponse.json({
    success: true,
    previousCredits: user.credits_remaining,
    newCredits,
    adjustment: amount,
  });
}
