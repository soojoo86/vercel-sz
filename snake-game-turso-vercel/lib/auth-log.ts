import { getDb } from './db';
import { ensureSchema } from './db/schema';

/**
 * 钉钉 / 第三方登录失败的诊断日志。
 *
 * 背景：NextAuth v5 在 OAuth 回调阶段抛出任何异常时，前端只会看到
 * 「There is a problem with the server configuration」这一句通用文案，
 * 真实原因（token 交换失败 / userinfo 403 / 落库异常）被吞掉了。
 * 这里把每个阶段的真实错误同时写到：
 *   1. console.error —— Vercel Functions 日志可见
 *   2. auth_failure_logs 表 —— 在 /admin 页面自助查看
 */
export type AuthStage =
  | 'token_exchange' // 用 code 换 accessToken 失败
  | 'userinfo' // 用 accessToken 取用户信息失败
  | 'profile' // 钉钉返回的用户信息缺少 unionId
  | 'db_upsert' // 落库（绑定 / 新建用户）失败
  | 'registration_disabled' // 注册通道关闭导致新用户无法首登
  | 'unexpected'; // 其他未预期异常

const STAGE_LABEL: Record<AuthStage, string> = {
  token_exchange: '换取 accessToken 失败',
  userinfo: '获取钉钉用户信息失败',
  profile: '钉钉用户信息不完整（缺 unionId）',
  db_upsert: '写入用户表失败',
  registration_disabled: '注册通道已关闭',
  unexpected: '登录回调异常（NextAuth 内部错误）',
};

export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage as AuthStage] ?? stage;
}

/** 记录一次登录失败（自身异常绝不向上抛，避免干扰主流程） */
export async function recordAuthFailure(
  stage: AuthStage,
  detail: string,
  meta?: Record<string, unknown>
): Promise<void> {
  const text = String(detail ?? '').slice(0, 1000);
  console.error(`[dingtalk-auth][${stage}] ${text}`, meta ?? '');

  try {
    await ensureSchema();
    const db = getDb();

    await db.execute({
      sql: `INSERT INTO auth_failure_logs (stage, detail, meta)
            VALUES (?, ?, ?)`,
      args: [stage, text, meta ? JSON.stringify(meta).slice(0, 2000) : null],
    });

    // 只保留最近 50 条，避免表无限增长
    await db.execute(`
      DELETE FROM auth_failure_logs
      WHERE id NOT IN (
        SELECT id FROM auth_failure_logs ORDER BY id DESC LIMIT 50
      )
    `);
  } catch (error) {
    // 落库失败不影响登录流程本身
    console.error('[dingtalk-auth] 诊断日志写入失败:', error);
  }
}

export interface AuthFailureLog {
  id: number;
  stage: string;
  stageLabel: string;
  detail: string;
  meta: string | null;
  createdAt: string;
}

/** 读取最近的登录失败记录（admin 诊断用） */
export async function getRecentAuthFailures(
  limit = 20
): Promise<AuthFailureLog[]> {
  await ensureSchema();
  const db = getDb();

  const result = await db.execute({
    sql: `SELECT id, stage, detail, meta, created_at
          FROM auth_failure_logs
          ORDER BY id DESC
          LIMIT ?`,
    args: [limit],
  });

  return result.rows.map((row) => ({
    id: Number(row.id),
    stage: String(row.stage),
    stageLabel: stageLabel(String(row.stage)),
    detail: String(row.detail),
    meta: (row.meta as string | null) ?? null,
    createdAt: String(row.created_at),
  }));
}

/** 清空诊断日志 */
export async function clearAuthFailures(): Promise<void> {
  await ensureSchema();
  const db = getDb();
  await db.execute('DELETE FROM auth_failure_logs');
}
