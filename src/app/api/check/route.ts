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
        { success: false, error: 'Chưa cung cấp danh sách tên miền' },
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
    const forceRefresh = body.forceRefresh === true || req.headers.get('x-force-refresh') === 'true';

    const scarpaOptions: ScarpaConfigOptions = {
      apiKeys,
      endpoint,
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
        error: 'Tên miền không hợp lệ',
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
        { success: false, error: 'Không thể tải dữ liệu từ database' },
        { status: 500 }
      );
    }

    // Step 3: Process domains with strict 30-day cache rule (unless forceRefresh is true)
    let cachedCount = 0;
    let freshCount = 0;
    let errorCount = invalidEntries.length;

    for (const domain of validDomains) {
      const existing = existingMap.get(domain);

      // Check if record exists and is < 30 days old, AND forceRefresh is false
      if (!forceRefresh && existing && isCacheValid(existing.checked_at)) {
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
        // MISS, EXPIRED (>= 30 days) OR FORCE REFRESH: Call API with key rotation
        try {
          const apiResult = await fetchScarpaTraffic(domain, scarpaOptions);

          if (apiResult.error || apiResult.monthlyTraffic === null) {
            results.push({
              domain,
              monthly_traffic: null,
              is_starred: existing ? existing.is_starred : false,
              checked_at: existing ? existing.checked_at : null,
              status: 'error',
              error: apiResult.error || 'Không có dữ liệu Similarweb',
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
            error: 'Lỗi trong quá trình gọi API Scrappa',
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
      { success: false, error: 'Lỗi hệ thống máy chủ' },
      { status: 500 }
    );
  }
}
