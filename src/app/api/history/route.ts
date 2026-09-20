import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { getSupabaseClient } = await import('@/lib/supabase');
    const supabase = getSupabaseClient();
    let sbError: any = null;
    let sbCount: number | null = null;
    if (supabase) {
      const sbRes = await supabase.from('traffic_checks').select('*');
      sbError = sbRes.error;
      sbCount = sbRes.data?.length ?? null;
    }
    const records = await getAllRecords();
    return NextResponse.json({
      success: true,
      records,
      debug: {
        sbClientExists: !!supabase,
        sbCount,
        sbError,
        rawUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      },
    });
  } catch (error: unknown) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to load saved data' },
      { status: 500 }
    );
  }
}
