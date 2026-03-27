import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  let adminInfo;
  try {
    adminInfo = await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = await request.json();
  const { userId, amount, reason } = body as {
    userId: string;
    amount: number;
    reason: string;
  };

  if (!userId || amount === undefined || amount === 0) {
    return NextResponse.json({ error: 'userId and non-zero amount are required' }, { status: 400 });
  }

  if (!reason?.trim()) {
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
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const newCredits = Math.max(0, user.credits_remaining + amount);

  // Update credits
  const { error: updateError } = await supabase
    .from('users')
    .update({ credits_remaining: newCredits })
    .eq('id', userId);

  if (updateError) {
    console.error('Credit adjustment error:', updateError);
    return NextResponse.json({ error: 'Failed to adjust credits' }, { status: 500 });
  }

  // Log the adjustment in purchases table as audit trail
  const { error: logError } = await supabase
    .from('purchases')
    .insert({
      user_id: userId,
      credits_added: amount,
      // Use pack_id as null for manual adjustments — stripe_session_id stores audit info
      stripe_session_id: `manual:${adminInfo.email}:${reason}`,
    });

  if (logError) {
    // Non-fatal: log but don't fail the request
    console.error('Credit audit log error:', logError);
  }

  console.log(
    `[Admin Credit Adjustment] admin=${adminInfo.email} user=${user.email} amount=${amount > 0 ? '+' : ''}${amount} reason="${reason}" new_balance=${newCredits}`
  );

  return NextResponse.json({
    success: true,
    previousCredits: user.credits_remaining,
    newCredits,
    adjustment: amount,
  });
}
