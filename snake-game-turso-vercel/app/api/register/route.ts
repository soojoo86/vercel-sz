import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { getDb } from '@/lib/db';
import { randomUUID } from 'crypto';
import { isRegistrationEnabled } from '@/lib/settings';

const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6位').max(72, '密码过长'),
  name: z
    .string()
    .trim()
    .max(30, '昵称最多30个字符')
    .optional(),
});

export async function POST(request: Request) {
  try {
    // 注册通道被 admin 关闭时，直接拒绝（前后端双重校验）
    if (!(await isRegistrationEnabled())) {
      return NextResponse.json(
        { error: '注册通道已关闭，请联系管理员' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = registerSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, name } = validated.data;
    const db = getDb();

    // 检查邮箱是否已注册
    const existing = await db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email],
    });

    if (existing.rows.length > 0) {
      return NextResponse.json(
        { error: '该邮箱已被注册' },
        { status: 400 }
      );
    }

    // 哈希密码
    const passwordHash = await bcrypt.hash(password, 10);
    const userId = randomUUID();

    // 创建用户
    await db.execute({
      sql: 'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)',
      args: [userId, email, name || null, passwordHash],
    });

    return NextResponse.json(
      { message: '注册成功', userId },
      { status: 201 }
    );
  } catch (error) {
    console.error('注册错误:', error);
    return NextResponse.json(
      { error: '注册失败，请稍后重试' },
      { status: 500 }
    );
  }
}
