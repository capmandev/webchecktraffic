import { NextRequest, NextResponse } from 'next/server';
import { deleteRecords } from '@/lib/db';

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

    const count = await deleteRecords(domainsToDelete);

    return NextResponse.json({
      success: true,
      deletedCount: count,
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
