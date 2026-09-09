import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin';
import { isRegistrationEnabled, setRegistrationEnabled } from '@/lib/settings';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// 获取当前注册开关状态（仅 admin）
export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const registrationEnabled = await isRegistrationEnabled();
    return NextResponse.json({ registrationEnabled });
  } catch (error) {
    console.error('获取设置错误:', error);
    return NextResponse.json({ error: '获取设置失败' }, { status: 500 });
  }
}

// 修改注册开关（仅 admin）
export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = z
      .object({ registrationEnabled: z.boolean() })
      .safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: '参数错误，需要布尔值 registrationEnabled' },
        { status: 400 }
      );
    }

    await setRegistrationEnabled(validated.data.registrationEnabled);

    return NextResponse.json({
      success: true,
      registrationEnabled: validated.data.registrationEnabled,
      message: validated.data.registrationEnabled
        ? '注册通道已开启'
        : '注册通道已关闭',
    });
  } catch (error) {
    console.error('更新设置错误:', error);
    return NextResponse.json({ error: '更新设置失败' }, { status: 500 });
  }
}
