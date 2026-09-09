import { NextResponse } from 'next/server';
import { isRegistrationEnabled } from '@/lib/settings';

export const dynamic = 'force-dynamic';

// 公开接口：注册通道是否开放（供登录页/注册页联动展示）
export async function GET() {
  try {
    const enabled = await isRegistrationEnabled();
    return NextResponse.json({ enabled });
  } catch (error) {
    console.error('获取注册开关错误:', error);
    // 查询失败时默认开放，避免误伤
    return NextResponse.json({ enabled: true });
  }
}
