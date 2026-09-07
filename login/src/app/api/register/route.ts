
import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = registerSchema.safeParse(body);



if (!validation.success) {
  // 1. 获取第一个错误对象
  const firstError = validation.error.errors;
  // 2. 安全地提取 message，如果不存在则给默认值
  const errorMessage = firstError ? firstError.message : 'Validation failed';

  return NextResponse.json(
    { 
      success: false, 
      message: errorMessage 
    },
    { status: 400 }
  );
}





    const { email, password } = validation.data;
    const result = await registerUser(email, password);

    if (result.success) {
      const response = NextResponse.json({ success: true, message: result.message });
      response.cookies.set('token', result.token!, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      });
      return response;
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

