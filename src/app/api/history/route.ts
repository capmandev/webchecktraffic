import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { getSupabaseClient } = await import('@/lib/supabase');
    const supabase = getSupabaseClient();
    const records = await getAllRecords();
    const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    let jwtPayload = null;
    try {
      jwtPayload = JSON.parse(Buffer.from(rawKey.split('.')[1], 'base64').toString());
    } catch (e: any) {
      jwtPayload = { error: e.message, rawKeyStart: rawKey.substring(0, 10), isJwt: rawKey.includes('.') };
    }
    return NextResponse.json({
      success: true,
      records,
      jwtPayload,
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
