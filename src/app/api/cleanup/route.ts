import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint is called by Vercel Cron every day at 3am BRT (6 UTC)
// It deletes all sales records older than 2 days to keep the database clean
// and within Supabase free tier limits.
//
// Protected by CLEANUP_SECRET to prevent unauthorized calls.

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const expectedToken = `Bearer ${process.env.CLEANUP_SECRET}`;

  if (authHeader !== expectedToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { error, count } = await supabase
    .from('sales')
    .delete({ count: 'exact' })
    .lt('created_at', twoDaysAgo);

  if (error) {
    console.error('[cleanup] Supabase delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[cleanup] Deleted ${count ?? 0} sale(s) older than 2 days.`);
  return NextResponse.json({ success: true, deleted: count ?? 0 });
}
