import 'dotenv/config';
import { getDb } from './index';

async function initDb() {
  const db = getDb();
  
  console.log('正在初始化数据库...');

  // 创建用户表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  console.log('✓ users 表创建成功');

  // 创建游戏记录表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      played_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  console.log('✓ game_sessions 表创建成功');

  // 创建答题记录表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      correct_count INTEGER NOT NULL,
      total_count INTEGER NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
  console.log('✓ quiz_attempts 表创建成功');

  // 创建每日解锁表（记录用户当天通过答题解锁的状态）
  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_unlocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      unlock_date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, unlock_date)
    )
  `);
  console.log('✓ daily_unlocks 表创建成功');

  // 常用查询索引
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_game_sessions_user_date
    ON game_sessions(user_id, played_at)
  `);
  console.log('✓ game_sessions(user_id, played_at) 索引创建成功');

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_daily_unlocks_user_date
    ON daily_unlocks(user_id, unlock_date)
  `);
  console.log('✓ daily_unlocks(user_id, unlock_date) 索引创建成功');

  console.log('数据库初始化完成！');
  process.exit(0);
}

initDb().catch((err) => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
