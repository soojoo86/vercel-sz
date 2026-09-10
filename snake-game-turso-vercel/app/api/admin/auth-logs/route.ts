import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { isAdminRequest } from '@/lib/admin';
import { getRecentAuthFailures, clearAuthFailures } from '@/lib/auth-log';
import { isDingtalkLoginEnabled } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** 推断当前请求实际生效的站点地址（与 NextAuth 计算 redirect_uri 的口径一致） */
async function resolveBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto =
    h.get('x-forwarded-proto') ??
    (host.startsWith('localhost') || host.startsWith('127.0.0.1')
      ? 'http'
      : 'https');
  return `${proto}://${host}`;
}

// 钉钉登录诊断信息 + 最近失败日志（仅 admin）
export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const baseUrl = await resolveBaseUrl();
    const logs = await getRecentAuthFailures(20);

    return NextResponse.json({
      dingtalkLoginEnabled: isDingtalkLoginEnabled,
      dingtalkCallbackUrl: `${baseUrl}/api/auth/callback/dingtalk`,
      // 钉钉「回调域名」填纯域名（不带协议、不带路径）
      dingtalkCallbackHost: baseUrl.replace(/^https?:\/\//, ''),
      authUrl: process.env.AUTH_URL ?? null,
      authSecretConfigured: Boolean(
        process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
      ),
      debugEnabled: process.env.AUTH_DEBUG === 'true',
      logs,
    });
  } catch (error) {
    console.error('获取登录诊断信息错误:', error);
    return NextResponse.json({ error: '获取诊断信息失败' }, { status: 500 });
  }
}

// 清空失败日志（仅 admin）
export async function DELETE() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    await clearAuthFailures();
    return NextResponse.json({ success: true, message: '诊断日志已清空' });
  } catch (error) {
    console.error('清空诊断日志错误:', error);
    return NextResponse.json({ error: '清空失败' }, { status: 500 });
  }
}
