import { NextRequest, NextResponse } from 'next/server';
import {
  getAllScanSessions,
  createScanSession,
  renameScanSession,
  deleteScanSession,
  generateDefaultSessionName,
} from '@/lib/sessions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export async function GET() {
  try {
    const sessions = await getAllScanSessions();
    return NextResponse.json(
      {
        success: true,
        sessions,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: unknown) {
    console.error('Error in GET /api/sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Không thể tải danh sách lần quét đã lưu' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Lần quét không có domain nào để lưu' },
        { status: 400 }
      );
    }

    const rawName = typeof body.name === 'string' ? body.name.trim() : '';
    const name = rawName || generateDefaultSessionName();

    const session = await createScanSession(name, items);

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Không thể lưu lần quét vào cơ sở dữ liệu' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Đã lưu lần quét thành công',
      session,
    });
  } catch (error: unknown) {
    console.error('Error in POST /api/sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi trong quá trình lưu lần quét' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id;
    const name = body.name;

    if (!id || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json(
        { success: false, error: 'ID hoặc tên lần quét không hợp lệ' },
        { status: 400 }
      );
    }

    const ok = await renameScanSession(id, name.trim());

    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Không thể đổi tên lần quét' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Đã đổi tên lần quét thành công',
    });
  } catch (error: unknown) {
    console.error('Error in PUT /api/sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi đổi tên lần quét' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'ID lần quét không hợp lệ' },
        { status: 400 }
      );
    }

    const ok = await deleteScanSession(id);

    if (!ok) {
      return NextResponse.json(
        { success: false, error: 'Không thể xóa lần quét' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Đã xóa lần quét thành công',
    });
  } catch (error: unknown) {
    console.error('Error in DELETE /api/sessions:', error);
    return NextResponse.json(
      { success: false, error: 'Lỗi khi xóa lần quét' },
      { status: 500 }
    );
  }
}
