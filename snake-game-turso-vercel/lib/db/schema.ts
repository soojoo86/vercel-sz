import { getDb } from './index';

/**
 * 懒加载建表：Vercel 等 serverless 环境无法手动执行 init 脚本，
 * 依赖此函数在首次访问相关 API 时自动补齐表结构。
 * 模块级缓存 Promise，保证每个函数实例只执行一次。
 */
let schemaPromise: Promise<void> | null = null;

async function createSchema(): Promise<void> {
  const db = getDb();

  // 用户表（钉钉登录用户也会写入此表）
  await db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      dingtalk_union_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await ensureUsersColumns();

  // admin 自定义题目表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_index INTEGER NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 每日答题机会额度表（答对一次 +1，玩一局非免费局 -1）
  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_credits (
      user_id TEXT NOT NULL,
      credit_date TEXT NOT NULL,
      credits INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, credit_date)
    )
  `);

  // 积分总账表（累计积分、连续游玩天数、当日答题积分）
  await db.execute(`
    CREATE TABLE IF NOT EXISTS user_points (
      user_id TEXT PRIMARY KEY,
      total_points INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0,
      last_play_date TEXT,
      quiz_points_date TEXT,
      quiz_points_today INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 积分流水表（每一笔积分的来源明细）
  await db.execute(`
    CREATE TABLE IF NOT EXISTS point_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      points INTEGER NOT NULL,
      reason TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 应用设置表（注册开关等）
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 登录失败诊断日志（钉钉 OAuth 各阶段异常，便于在 /admin 自助排查）
  await db.execute(`
    CREATE TABLE IF NOT EXISTS auth_failure_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stage TEXT NOT NULL,
      detail TEXT NOT NULL,
      meta TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_quiz_questions_created
    ON quiz_questions(created_at)
  `);

  await ensureQuizAttemptsColumns();
}

/**
 * 老的 users 表可能缺 dingtalk_union_id 列（钉钉扫码登录需要），
 * 此处检测并补列 + 唯一索引。
 */
async function ensureUsersColumns(): Promise<void> {
  const db = getDb();

  const result = await db.execute('PRAGMA table_info(users)');
  const columns = new Set(result.rows.map((r) => String(r.name)));

  if (!columns.has('dingtalk_union_id')) {
    await db.execute('ALTER TABLE users ADD COLUMN dingtalk_union_id TEXT');
    console.log('users 表已补充 dingtalk_union_id 列');
  }

  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_dingtalk_union_id
    ON users(dingtalk_union_id)
  `);
}

/**
 * 历史遗留：早期手工创建的 quiz_attempts 表可能缺 user_id / total_count 列，
 * 此处检测并重建（旧表重命名为 quiz_attempts_legacy 保留数据，不丢失）。
 */
async function ensureQuizAttemptsColumns(): Promise<void> {
  const db = getDb();

  await db.execute(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      correct_count INTEGER NOT NULL,
      total_count INTEGER NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const result = await db.execute('PRAGMA table_info(quiz_attempts)');
  const columns = new Set(result.rows.map((r) => String(r.name)));

  if (!columns.has('user_id') || !columns.has('total_count')) {
    // 先清理上一次遗留的备份，再把旧表重命名保留
    await db.execute('DROP TABLE IF EXISTS quiz_attempts_legacy');
    await db.execute('ALTER TABLE quiz_attempts RENAME TO quiz_attempts_legacy');
    await db.execute(`
      CREATE TABLE quiz_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        correct_count INTEGER NOT NULL,
        total_count INTEGER NOT NULL,
        passed INTEGER NOT NULL DEFAULT 0,
        attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.warn('quiz_attempts 表结构已修正（旧表备份为 quiz_attempts_legacy）');
  }
}

export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = createSchema().catch((err) => {
      // 失败时清空缓存，允许下次重试
      schemaPromise = null;
      throw err;
    });
  }
  return schemaPromise;
}
