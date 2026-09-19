import { NextRequest, NextResponse } from 'next/server';
import { updateStar } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { domain, is_starred } = body;

    if (!domain || typeof is_starred !== 'boolean') {
      return NextResponse.json(
        { success: false, error: 'Invalid payload: domain and is_starred required' },
        { status: 400 }
      );
    }

    const updated = await updateStar(domain, is_starred);
    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Domain not found or update failed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      domain,
      is_starred,
    });
  } catch (error: unknown) {
    console.error('Error in /api/star:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to update star status' },
      { status: 500 }
    );
  }
}
