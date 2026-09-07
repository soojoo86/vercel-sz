
import { createClient } from '@libsql/client';

// 1. 获取环境变量，提供明确的错误提示而非静默失败
const dbUrl = process.env.TURSO_DATABASE_URL;
const dbAuthToken = process.env.TURSO_AUTH_TOKEN;

if (!dbUrl) {
  console.warn('⚠️ TURSO_DATABASE_URL is missing. Database client will not be initialized correctly.');
}

// 2. 创建客户端实例
// 注意：createClient 是同步的，但它在首次执行查询时才会真正连接网络
export const db = createClient({
  url: dbUrl || 'file:local.db', // 使用本地文件作为 fallback，防止构建时因 undefined 报错
  authToken: dbAuthToken,
});

// 3. 初始化函数（仅在需要时手动调用，例如在应用启动脚本中，而非构建过程中）
export async function initDb() {
  // 如果 URL 无效，直接返回，避免执行查询报错
  if (!dbUrl || !dbAuthToken) {
    console.error('Cannot initialize DB: Missing environment variables.');
    return;
  }

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error; // 抛出错误以便调用者知道初始化失败
  }
}

