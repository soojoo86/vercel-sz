/* 查看远程 Turso 库的真实表结构 */
import { createClient } from '@libsql/client';
import { config } from 'dotenv';

config({ path: '.env.local' });

const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const tables = await db.execute(
  "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name"
);
for (const row of tables.rows) {
  console.log('=====', row.name, '=====');
  console.log(row.sql);
}
process.exit(0);
