import { NextRequest, NextResponse } from 'next/server';
import { getTeamApiKeys, saveTeamApiKeys, MAX_TEAM_KEYS } from '@/lib/keys';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const config = await getTeamApiKeys();
    return NextResponse.json({
      success: true,
      keys: config.keys,
      endpoint: config.endpoint,
      maxKeys: MAX_TEAM_KEYS,
    });
  } catch (error: unknown) {
    console.error('Error in GET /api/keys:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải danh sách API keys' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawKeys = body.keys;

    if (!Array.isArray(rawKeys)) {
      return NextResponse.json(
        { success: false, error: 'Danh sách keys không hợp lệ' },
        { status: 400 }
      );
    }

    const endpoint = typeof body.endpoint === 'string' ? body.endpoint : undefined;
    const ok = await saveTeamApiKeys(rawKeys, endpoint);

    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Không thể lưu API keys lên database' },
        { status: 500 }
      );
    }

    const updated = await getTeamApiKeys();

    return NextResponse.json({
      success: true,
      message: 'Đã lưu 10 API keys dùng chung cho cả team thành công',
      keys: updated.keys,
      endpoint: updated.endpoint,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/keys:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi trong quá trình lưu API keys' },
      { status: 500 }
    );
  }
}
