import { getDb } from './db';
import { ensureSchema } from './db/schema';

const REGISTRATION_KEY = 'registration_enabled';

/**
 * 注册通道是否开放。
 * 未设置时默认开放；admin 可在后台随时关闭/重新开启。
 */
export async function isRegistrationEnabled(): Promise<boolean> {
  await ensureSchema();
  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT value FROM app_settings WHERE key = ?',
    args: [REGISTRATION_KEY],
  });

  const value = result.rows[0]?.value as string | undefined;
  if (value === undefined || value === null) {
    return true; // 默认开放
  }
  return value === '1' || value === 'true';
}

export async function setRegistrationEnabled(enabled: boolean): Promise<void> {
  await ensureSchema();
  const db = getDb();

  await db.execute({
    sql: `INSERT INTO app_settings (key, value, updated_at)
          VALUES (?, ?, datetime('now'))
          ON CONFLICT(key)
          DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    args: [REGISTRATION_KEY, enabled ? '1' : '0'],
  });
}
