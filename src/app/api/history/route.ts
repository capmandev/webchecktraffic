import { NextResponse } from 'next/server';
import { getAllRecords } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const records = await getAllRecords();
    return NextResponse.json({
      success: true,
      records,
      debug: {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        urlPreview: process.env.NEXT_PUBLIC_SUPABASE_URL ? process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 30) : null,
        hasKey: !!(process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
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
