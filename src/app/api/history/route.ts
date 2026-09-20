import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const records = await getAllRecords();
    return NextResponse.json({
      success: true,
      records,
      keyPreview: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 15) : 'no-service-role',
      anonPreview: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 15) : 'no-anon',
    });
  } catch (error: unknown) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải dữ liệu lịch sử' },
      { status: 500 }
    );
  }
}
