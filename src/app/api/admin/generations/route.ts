import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') || '';
  const type = searchParams.get('type') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 20;
  const offset = (page - 1) * limit;

  const supabase = createAdminClient();

  let query = supabase
    .from('generation_queue')
    .select('*, projects!inner(name, user_id, users!inner(email, name))', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq('status', status);
  }
  if (type) {
    query = query.eq('type', type);
  }

  const { data: generations, count, error } = await query;

  if (error) {
    console.error('Admin generations fetch error:', error);
    // Fallback: query without joins if foreign key not set up
    const fallbackQuery = supabase
      .from('generation_queue')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) fallbackQuery.eq('status', status);
    if (type) fallbackQuery.eq('type', type);

    const { data: fallbackData, count: fallbackCount, error: fallbackError } = await fallbackQuery;

    if (fallbackError) {
      return NextResponse.json({ error: 'Failed to fetch generations' }, { status: 500 });
    }

    return NextResponse.json({
      generations: fallbackData,
      total: fallbackCount || 0,
      page,
      totalPages: Math.ceil((fallbackCount || 0) / limit),
    });
  }

  return NextResponse.json({
    generations,
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit),
  });
}
