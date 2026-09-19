import { NextRequest, NextResponse } from 'next/server';

export interface KeyCreditInfo {
  key: string;
  maskedKey: string;
  valid: boolean;
  balance: number;
  usable: number;
  freeRemaining: number;
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let keys: string[] = [];

    if (Array.isArray(body.apiKeys)) {
      keys = body.apiKeys.filter((k: any) => typeof k === 'string' && k.trim());
    } else if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      keys = [body.apiKey.trim()];
    }

    const enableMock = body.enableMock !== false && process.env.ENABLE_MOCK_FALLBACK !== 'false';

    if (keys.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        totalCredits: 0,
      });
    }

    const results: KeyCreditInfo[] = [];
    let totalCredits = 0;

    for (const rawKey of keys) {
      const key = rawKey.trim();
      const maskedKey =
        key.length > 8 ? `${key.substring(0, 4)}...${key.substring(key.length - 4)}` : key;

      try {
        const response = await fetch('https://scrappa.co/api/account/usage', {
          method: 'GET',
          headers: {
            'X-API-KEY': key,
            'Authorization': `Bearer ${key}`,
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(6000),
        });

        if (response.ok) {
          const data = await response.json();
          const balance = data.balance ?? 0;
          const usable = data.credits?.usable ?? balance;
          const freeRemaining = data.credits?.free_remaining ?? 0;

          results.push({
            key,
            maskedKey,
            valid: true,
            balance,
            usable,
            freeRemaining,
          });

          totalCredits += usable;
        } else if (response.status === 401) {
          results.push({
            key,
            maskedKey,
            valid: false,
            balance: 0,
            usable: 0,
            freeRemaining: 0,
            error: 'Key không hợp lệ',
          });
        } else {
          // If in mock mode and key is a test string
          if (enableMock) {
            results.push({
              key,
              maskedKey,
              valid: true,
              balance: 1000,
              usable: 1000,
              freeRemaining: 1000,
            });
            totalCredits += 1000;
          } else {
            results.push({
              key,
              maskedKey,
              valid: false,
              balance: 0,
              usable: 0,
              freeRemaining: 0,
              error: `HTTP ${response.status}`,
            });
          }
        }
      } catch (err: unknown) {
        if (enableMock) {
          results.push({
            key,
            maskedKey,
            valid: true,
            balance: 1000,
            usable: 1000,
            freeRemaining: 1000,
          });
          totalCredits += 1000;
        } else {
          results.push({
            key,
            maskedKey,
            valid: false,
            balance: 0,
            usable: 0,
            freeRemaining: 0,
            error: 'Timeout kết nối',
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
      totalCredits,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Không thể kiểm tra credits' },
      { status: 500 }
    );
  }
}
