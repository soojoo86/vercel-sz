/* 清理冒烟测试用户数据（保留其他真实数据） */
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const email = 'smoke-test@example.com';
const u = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
const uid = u.rows[0]?.id;
if (uid) {
  await db.execute({ sql: 'DELETE FROM game_sessions WHERE user_id = ?', args: [uid] });
  await db.execute({ sql: 'DELETE FROM daily_credits WHERE user_id = ?', args: [uid] });
  await db.execute({ sql: 'DELETE FROM quiz_attempts WHERE user_id = ?', args: [uid] });
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [uid] });
  console.log('已清理测试用户', email, uid);
} else {
  console.log('测试用户不存在');
}
process.exit(0);
