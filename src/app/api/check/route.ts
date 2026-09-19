import { NextRequest, NextResponse } from 'next/server';
import { parseAndNormalizeBulk, isCacheValid } from '@/lib/normalize';
import { getRecordsByDomains, upsertRecord } from '@/lib/db';
import { fetchScarpaTraffic, ScarpaConfigOptions } from '@/lib/scarpa';
import { DomainCheckResult } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawDomains = body.domains;

    if (!rawDomains) {
      return NextResponse.json(
        { success: false, error: 'No domains provided' },
        { status: 400 }
      );
    }

    // Read keys and settings from request body or headers
    let apiKeys: string[] = [];
    if (Array.isArray(body.apiKeys)) {
      apiKeys = body.apiKeys.filter((k: any) => typeof k === 'string' && k.trim());
    } else if (typeof body.apiKeys === 'string') {
      apiKeys = body.apiKeys.split(',').map((k: string) => k.trim()).filter(Boolean);
    } else {
      const headerKeys = req.headers.get('x-scarpa-api-keys');
      if (headerKeys) {
        try {
          const parsed = JSON.parse(headerKeys);
          if (Array.isArray(parsed)) apiKeys = parsed;
        } catch {
          apiKeys = headerKeys.split(',').map((k) => k.trim()).filter(Boolean);
        }
      }
    }

    const singleKey = body.apiKey || req.headers.get('x-scarpa-api-key') || undefined;
    if (singleKey && !apiKeys.includes(singleKey)) {
      apiKeys.push(singleKey);
    }

    const endpoint = body.endpoint || req.headers.get('x-scarpa-endpoint') || undefined;
    const mockParam = body.enableMock !== undefined ? body.enableMock : req.headers.get('x-mock-fallback');
    const enableMock = mockParam !== undefined && mockParam !== null ? (mockParam === true || mockParam === 'true') : undefined;

    const scarpaOptions: ScarpaConfigOptions = {
      apiKeys,
      endpoint,
      enableMock,
    };

    // Step 1: Normalize, validate and deduplicate input domains
    const { validDomains, invalidEntries } = parseAndNormalizeBulk(rawDomains);

    const results: DomainCheckResult[] = [];

    // Add invalid domain results immediately
    for (const item of invalidEntries) {
      results.push({
        domain: item.raw,
        rawInput: item.raw,
        monthly_traffic: null,
        is_starred: false,
        checked_at: null,
        status: 'error',
        error: 'Invalid domain',
      });
    }

    if (validDomains.length === 0) {
      return NextResponse.json({
        success: true,
        results,
        summary: {
          total: results.length,
          cached: 0,
          fresh: 0,
          errors: results.length,
        },
      });
    }

    // Step 2: Query database for existing records
    let existingMap;
    try {
      existingMap = await getRecordsByDomains(validDomains);
    } catch (dbErr) {
      console.error('Database query error:', dbErr);
      return NextResponse.json(
        { success: false, error: 'Unable to load saved data' },
        { status: 500 }
      );
    }

    // Step 3: Process domains with strict 30-day cache rule
    let cachedCount = 0;
    let freshCount = 0;
    let errorCount = invalidEntries.length;

    for (const domain of validDomains) {
      const existing = existingMap.get(domain);

      // Check if record exists and is < 30 days old
      if (existing && isCacheValid(existing.checked_at)) {
        // HIT CACHE: DO NOT call API!
        results.push({
          domain: existing.domain,
          monthly_traffic: existing.monthly_traffic,
          is_starred: existing.is_starred,
          checked_at: existing.checked_at,
          status: 'cached',
        });
        cachedCount++;
      } else {
        // MISS OR EXPIRED (>= 30 days): Call API with key rotation
        try {
          const apiResult = await fetchScarpaTraffic(domain, scarpaOptions);

          if (apiResult.error || apiResult.monthlyTraffic === null) {
            results.push({
              domain,
              monthly_traffic: null,
              is_starred: existing ? existing.is_starred : false,
              checked_at: existing ? existing.checked_at : null,
              status: 'error',
              error: apiResult.error || 'Unable to retrieve traffic',
            });
            errorCount++;
          } else {
            // Save/Update in database, preserving is_starred
            const updated = await upsertRecord(domain, apiResult.monthlyTraffic, existing);
            results.push({
              domain: updated.domain,
              monthly_traffic: updated.monthly_traffic,
              is_starred: updated.is_starred,
              checked_at: updated.checked_at,
              status: 'fresh',
            });
            freshCount++;
          }
        } catch (apiErr: unknown) {
          console.error(`Error checking traffic for ${domain}:`, apiErr);
          results.push({
            domain,
            monthly_traffic: null,
            is_starred: existing ? existing.is_starred : false,
            checked_at: existing ? existing.checked_at : null,
            status: 'error',
            error: 'Unable to retrieve traffic',
          });
          errorCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        cached: cachedCount,
        fresh: freshCount,
        errors: errorCount,
      },
    });
  } catch (error: unknown) {
    console.error('Fatal error in /api/check:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
