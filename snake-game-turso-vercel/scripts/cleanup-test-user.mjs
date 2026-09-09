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
  await db.execute({ sql: 'DELETE FROM user_points WHERE user_id = ?', args: [uid] });
  await db.execute({ sql: 'DELETE FROM point_transactions WHERE user_id = ?', args: [uid] });
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [uid] });
  console.log('已清理测试用户', email, uid);
} else {
  console.log('测试用户不存在');
}

// 清理冒烟脚本添加的测试题目
for (const q of ['下列哪项属于强密码？', '电脑中毒后第一步应该？']) {
  await db.execute({ sql: 'DELETE FROM quiz_questions WHERE question = ?', args: [q] });
}

// 注册开关恢复默认（删除即恢复开放）
await db.execute({ sql: 'DELETE FROM app_settings WHERE key = ?', args: ['registration_enabled'] });
console.log('已清理测试题目与注册开关');

process.exit(0);
