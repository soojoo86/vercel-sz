import { NextResponse } from 'next/server';
import { isRegistrationEnabled } from '@/lib/settings';
import { isDingtalkLoginEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 公开接口：注册通道是否开放 + 钉钉登录是否已配置（供登录页/注册页联动展示）
export async function GET() {
  let enabled = true;
  try {
    enabled = await isRegistrationEnabled();
  } catch (error) {
    console.error('获取注册开关错误:', error);
    // 查询失败时默认开放，避免误伤
  }

  return NextResponse.json({
    enabled,
    dingtalkLoginEnabled: isDingtalkLoginEnabled,
  });
}
