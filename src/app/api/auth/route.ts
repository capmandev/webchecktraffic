import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawPassword = body.password;

    const expectedPassword = (process.env.SITE_PASSWORD || '3mteam').trim();
    const inputPassword = typeof rawPassword === 'string' ? rawPassword.trim() : '';

    if (!inputPassword || inputPassword !== expectedPassword) {
      return NextResponse.json(
        { success: false, error: 'Mật khẩu không chính xác' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Đăng nhập thành công',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Lỗi xác thực' },
      { status: 500 }
    );
  }
}
