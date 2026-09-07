
import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth'; // 确保这里能正确导入
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validation = registerSchema.safeParse(body);

if (!validation.success) {
  // ✅ 修复：返回所有错误详情
  return NextResponse.json(
    { 
      success: false, 
      message: 'Validation failed',
      errors: validation.error.errors.map(err => ({
        path: err.path.join('.'), // 例如 "email" 或 "password"
        message: err.message
      }))
    },
    { status: 400 }
  );
}

    const { email, password, name } = validation.data;

    // 调用导出的 registerUser
    const result = await registerUser(email, password, name);

    if (result.success) {
      return NextResponse.json({ success: true, message: result.message }, { status: 201 });
    } else {
      return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }
  } catch (error) {
    console.error('Register API error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

