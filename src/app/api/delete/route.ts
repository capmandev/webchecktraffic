import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawDomains = body.domains;

    let domainsToDelete: string[] = [];
    if (Array.isArray(rawDomains)) {
      domainsToDelete = rawDomains.filter((d) => typeof d === 'string' && d.trim().length > 0);
    } else if (typeof rawDomains === 'string' && rawDomains.trim()) {
      domainsToDelete = [rawDomains.trim()];
    }

    if (domainsToDelete.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No domains specified for deletion' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase client not initialized' }, { status: 500 });
    }

    const { data, error, count } = await supabase
      .from('traffic_checks')
      .delete({ count: 'exact' })
      .in('domain', domainsToDelete)
      .select();

    return NextResponse.json({
      success: !error,
      deletedCount: data ? data.length : count,
      error,
      deletedDomains: domainsToDelete,
    });
  } catch (error: unknown) {
    console.error('Error in /api/delete:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to delete domain(s)' },
      { status: 500 }
    );
  }
}
