import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
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

  // 推断当前生效的 baseUrl：优先显式环境变量，否则用请求 host 头
  // 钉钉回调域名配置必须跟这个保持一致
  const envBase = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  const h = headers();
  const host =
    h.get('x-forwarded-host') || h.get('host') || 'localhost:3000';
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https');
  const inferredBase = envBase || `${proto}://${host}`;

  return NextResponse.json({
    enabled,
    dingtalkLoginEnabled: isDingtalkLoginEnabled,
    // 给前端展示用，便于用户对照钉钉开放平台配置
    dingtalkCallbackUrl: isDingtalkLoginEnabled
      ? `${inferredBase.replace(/\/$/, '')}/api/auth/callback/dingtalk`
      : null,
    dingtalkCallbackHost: isDingtalkLoginEnabled
      ? (() => {
          try {
            return new URL(inferredBase).host;
          } catch {
            return host;
          }
        })()
      : null,
  });
}