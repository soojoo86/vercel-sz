import { NextResponse } from 'next/server';
import { isValidAdminPassword, getAdminToken, ADMIN_COOKIE_NAME } from '@/lib/admin';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: '请输入密码' }, { status: 400 });
    }

    if (!isValidAdminPassword(validated.data.password)) {
      return NextResponse.json({ error: '密码错误' }, { status: 401 });
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(ADMIN_COOKIE_NAME, getAdminToken(), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8, // 8 小时
      secure: process.env.NODE_ENV === 'production',
    });
    return res;
  } catch (error) {
    console.error('admin 登录错误:', error);
    return NextResponse.json({ error: '登录失败，请重试' }, { status: 500 });
  }
}
