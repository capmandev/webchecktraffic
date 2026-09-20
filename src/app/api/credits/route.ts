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
            error: 'Key không hợp lệ hoặc sai key',
          });
        } else if (response.status === 402 || response.status === 429) {
          results.push({
            key,
            maskedKey,
            valid: false,
            balance: 0,
            usable: 0,
            freeRemaining: 0,
            error: 'Hết lượt credits / Quota',
          });
        } else {
          results.push({
            key,
            maskedKey,
            valid: false,
            balance: 0,
            usable: 0,
            freeRemaining: 0,
            error: `Lỗi kết nối HTTP ${response.status}`,
          });
        }
      } catch (err: unknown) {
        results.push({
          key,
          maskedKey,
          valid: false,
          balance: 0,
          usable: 0,
          freeRemaining: 0,
          error: 'Timeout kết nối đến Scrappa',
        });
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
