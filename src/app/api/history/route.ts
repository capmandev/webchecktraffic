import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const records = await getAllRecords();
    return NextResponse.json(
      {
        success: true,
        records,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: unknown) {
    console.error('Error fetching history:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải dữ liệu lịch sử' },
      { status: 500 }
    );
  }
}
