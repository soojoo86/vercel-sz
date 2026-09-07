
import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    const result = await loginUser(email, password);

    if (result.success) {
      // 【关键修复】显式检查 token 是否存在，消除 TS 报错
      if (!result.token) {
        return NextResponse.json(
          { success: false, message: 'Server error: Token generation failed' },
          { status: 500 }
        );
      }

      const response = NextResponse.json({
        success: true,
        message: result.message,
        user: result.user
      });

      // 现在 TypeScript 知道 result.token 肯定是一个字符串
      response.cookies.set('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });

      return response;
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

