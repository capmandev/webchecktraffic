import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { getSupabaseClient } = await import('@/lib/supabase');
    const supabase = getSupabaseClient();
    const records = await getAllRecords();
    return NextResponse.json({
      success: true,
      records,
      actualClientUrl: (supabase as any)?.supabaseUrl,
      rawEnvUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
  } catch (error: unknown) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải dữ liệu lịch sử' },
      { status: 500 }
    );
  }
}
