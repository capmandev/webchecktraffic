import { NextRequest, NextResponse } from 'next/server';
import { getTeamApiKeys } from '@/lib/keys';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export interface KeyCreditInfo {
  key: string;
  maskedKey: string;
  slotIndex?: number;
  valid: boolean;
  isExhausted: boolean;
  balance: number;
  usable: number;
  freeRemaining: number;
  error?: string;
}

async function checkSingleKeyCredit(key: string, slotIndex?: number): Promise<KeyCreditInfo> {
  const cleanKey = key.trim();
  const maskedKey =
    cleanKey.length > 8
      ? `${cleanKey.substring(0, 4)}...${cleanKey.substring(cleanKey.length - 4)}`
      : cleanKey;

  try {
    const response = await fetch('https://scrappa.co/api/account/usage', {
      method: 'GET',
      headers: {
        'X-API-KEY': cleanKey,
        'Authorization': `Bearer ${cleanKey}`,
        'Accept': 'application/json',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    });

    if (response.ok) {
      const data = await response.json();
      const balance = Number(data.balance ?? 0);
      const usable = Number(data.credits?.usable ?? balance);
      const freeRemaining = Number(data.credits?.free_remaining ?? 0);
      const isExhausted = usable <= 0;

      return {
        key: cleanKey,
        maskedKey,
        slotIndex,
        valid: true,
        isExhausted,
        balance,
        usable,
        freeRemaining,
        error: isExhausted ? '0 credits (Đã hết lượt - Cần thay key)' : undefined,
      };
    } else if (response.status === 401) {
      return {
        key: cleanKey,
        maskedKey,
        slotIndex,
        valid: false,
        isExhausted: true,
        balance: 0,
        usable: 0,
        freeRemaining: 0,
        error: 'Key không hợp lệ hoặc đã bị thu hồi',
      };
    } else if (response.status === 402 || response.status === 429) {
      return {
        key: cleanKey,
        maskedKey,
        slotIndex,
        valid: false,
        isExhausted: true,
        balance: 0,
        usable: 0,
        freeRemaining: 0,
        error: 'Hết hạn mức credits (Cần thay key mới)',
      };
    } else {
      return {
        key: cleanKey,
        maskedKey,
        slotIndex,
        valid: false,
        isExhausted: false,
        balance: 0,
        usable: 0,
        freeRemaining: 0,
        error: `Lỗi kết nối HTTP ${response.status}`,
      };
    }
  } catch (err: unknown) {
    return {
      key: cleanKey,
      maskedKey,
      slotIndex,
      valid: false,
      isExhausted: false,
      balance: 0,
      usable: 0,
      freeRemaining: 0,
      error: 'Timeout kết nối đến Scrappa',
    };
  }
}

async function processKeysCredits(keys: string[]) {
  if (keys.length === 0) {
    return {
      success: true,
      results: [] as KeyCreditInfo[],
      totalCredits: 0,
      validCount: 0,
      exhaustedCount: 0,
    };
  }

  // Check all keys in parallel
  const checks = keys.map((k, idx) => checkSingleKeyCredit(k, idx));
  const results = await Promise.all(checks);

  let totalCredits = 0;
  let validCount = 0;
  let exhaustedCount = 0;

  for (const r of results) {
    if (r.valid) {
      validCount++;
      totalCredits += r.usable;
      if (r.isExhausted) {
        exhaustedCount++;
      }
    } else if (r.isExhausted) {
      exhaustedCount++;
    }
  }

  return {
    success: true,
    results,
    totalCredits,
    validCount,
    exhaustedCount,
  };
}

export async function GET() {
  try {
    const teamConfig = await getTeamApiKeys();
    const activeKeys = teamConfig.keys.filter((k) => k && k.trim());
    const data = await processKeysCredits(activeKeys);
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error('Error in GET /api/credits:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể kiểm tra credits team' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let keys: string[] = [];

    if (Array.isArray(body.apiKeys)) {
      keys = body.apiKeys.filter((k: any) => typeof k === 'string' && k.trim());
    } else if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      keys = [body.apiKey.trim()];
    }

    // If client didn't provide keys, check team keys from Supabase
    if (keys.length === 0) {
      const teamConfig = await getTeamApiKeys();
      keys = teamConfig.keys.filter((k) => k && k.trim());
    }

    const data = await processKeysCredits(keys);
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in POST /api/credits:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể kiểm tra credits' },
      { status: 500 }
    );
  }
}
