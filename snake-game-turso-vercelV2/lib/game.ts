import { getDb } from './db';

export interface GameAccessResult {
  allowed: boolean;
  reason: 'free_play' | 'quiz_required' | 'limit_reached' | 'unlocked';
  playCount: number;
  remainingFreePlays: number;
}

// 获取用户今日已玩次数
export async function getTodayPlayCount(userId: string): Promise<number> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM game_sessions 
          WHERE user_id = ? AND date(played_at) = ?`,
    args: [userId, today],
  });

  return (result.rows[0]?.count as number) || 0;
}

// 检查用户今日是否已通过答题解锁
export async function hasUnlockedToday(userId: string): Promise<boolean> {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];

  const result = await db.execute({
    sql: `SELECT id FROM daily_unlocks 
          WHERE user_id = ? AND unlock_date = ?`,
    args: [userId, today],
  });

  return result.rows.length > 0;
}

// 检查游戏访问权限
export async function checkGameAccess(userId: string): Promise<GameAccessResult> {
  const playCount = await getTodayPlayCount(userId);
  const unlocked = await hasUnlockedToday(userId);

  // 前4次免费玩
  if (playCount < 4) {
    return {
      allowed: true,
      reason: 'free_play',
      playCount,
      remainingFreePlays: 4 - playCount,
    };
  }

  // 第5次需要答题，或已解锁
  if (unlocked) {
    return {
      allowed: true,
      reason: 'unlocked',
      playCount,
      remainingFreePlays: 0,
    };
  }

  if (playCount === 4) {
    return {
      allowed: false,
      reason: 'quiz_required',
      playCount,
      remainingFreePlays: 0,
    };
  }

  // 超过5次且未解锁
  return {
    allowed: false,
    reason: 'limit_reached',
    playCount,
    remainingFreePlays: 0,
  };
}

// 记录游戏分数
export async function recordGameScore(
  userId: string,
  score: number
): Promise<void> {
  const db = getDb();

  await db.execute({
    sql: 'INSERT INTO game_sessions (user_id, score) VALUES (?, ?)',
    args: [userId, score],
  });
}

// 获取排行榜
export async function getLeaderboard(limit: number = 10) {
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT 
        u.id,
        u.name,
        u.email,
        MAX(g.score) as high_score,
        COUNT(g.id) as total_games
      FROM game_sessions g
      JOIN users u ON g.user_id = u.id
      GROUP BY u.id
      ORDER BY high_score DESC
      LIMIT ?
    `,
    args: [limit],
  });

  return result.rows.map((row, index) => ({
    rank: index + 1,
    userId: row.id as string,
    name: (row.name as string) || (row.email as string).split('@')[0],
    highScore: row.high_score as number,
    totalGames: row.total_games as number,
  }));
}

// 获取用户最高分
export async function getUserHighScore(userId: string): Promise<number> {
  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT MAX(score) as high_score FROM game_sessions WHERE user_id = ?',
    args: [userId],
  });

  return (result.rows[0]?.high_score as number) || 0;
}

// 记录答题结果并解锁
export async function recordQuizAttempt(
  userId: string,
  correctCount: number,
  totalCount: number
): Promise<boolean> {
  const db = getDb();
  const passed = correctCount >= 3; // 答对3题及以上算通过

  await db.execute({
    sql: 'INSERT INTO quiz_attempts (user_id, correct_count, total_count, passed) VALUES (?, ?, ?, ?)',
    args: [userId, correctCount, totalCount, passed ? 1 : 0],
  });

  if (passed) {
    const today = new Date().toISOString().split('T')[0];
    // 使用 INSERT OR IGNORE 防止重复记录
    await db.execute({
      sql: 'INSERT OR IGNORE INTO daily_unlocks (user_id, unlock_date) VALUES (?, ?)',
      args: [userId, today],
    });
  }

  return passed;
}
