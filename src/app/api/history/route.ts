import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { getSupabaseClient } = await import('@/lib/supabase');
    const supabase = getSupabaseClient();
    const records = await getAllRecords();
    const crypto = await import('crypto');
    const keyHash = crypto.createHash('sha256').update((process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()).digest('hex');
    const urlHash = crypto.createHash('sha256').update((process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()).digest('hex');
    return NextResponse.json({
      success: true,
      records,
      keyHash,
      urlHash,
    });
  } catch (error: unknown) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải dữ liệu lịch sử' },
      { status: 500 }
    );
  }
}
