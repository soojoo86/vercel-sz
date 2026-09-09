import { createHash } from 'crypto';
import { cookies } from 'next/headers';

// 管理员密码：可通过环境变量 ADMIN_PASSWORD 覆盖
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin112233sz';

export const ADMIN_COOKIE_NAME = 'admin_token';

/** 由密码派生 token（不落明文） */
function deriveToken(password: string): string {
  return createHash('sha256').update(`snake-admin:${password}`).digest('hex');
}

/** 校验密码是否正确 */
export function isValidAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

/** 校验请求携带的 admin cookie 是否有效 */
export async function isAdminRequest(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return !!token && token === deriveToken(ADMIN_PASSWORD);
}

/** 生成登录成功后应写入的 cookie 值 */
export function getAdminToken(): string {
  return deriveToken(ADMIN_PASSWORD);
}
