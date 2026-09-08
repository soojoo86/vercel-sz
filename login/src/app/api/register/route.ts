
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { registerUser } from '@/lib/auth';

// 定义与前端一致的校验 Schema
const registerSchema = z.object({
 // name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. 执行校验
    const result = registerSchema.safeParse(body);

    // 2. 如果校验失败，返回具体错误
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Validation failed',
          errors: result.error.errors.map(err => ({
            field: err.path, // 出错的字段名，如 'email'
            message: err.message // 具体错误原因
          }))
        },
        { status: 400 }
      );
    }

    // 3. 校验通过，执行注册逻辑
    const {  email, password } = result.data;
    // const { name, email, password } = result.data;
    const response = await registerUser(email, password);
    // const response = await registerUser(email, password, name);

    if (!response.success) {
      return NextResponse.json(response, { status: 400 });
    }

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Register API error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}

