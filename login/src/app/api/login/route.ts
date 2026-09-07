
import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = loginSchema.safeParse(body);



if (!validation.success) {
  // flatten() 将错误转换为 { formErrors: string[], fieldErrors: Record<string, string[]> }
  const flattened = validation.error.flatten();
  
  // 优先取字段错误中的第一条，如果没有则取全局错误
  const firstFieldError = Object.values(flattened.fieldErrors).flat();
  const errorMessage = firstFieldError || flattened.formErrors || 'Validation failed';

  return NextResponse.json(
    { 
      success: false, 
      message: errorMessage 
    },
    { status: 400 }
  );
}



    const { email, password } = validation.data;
    const result = await loginUser(email, password);

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
      return NextResponse.json({ success: false, message: result.message }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

