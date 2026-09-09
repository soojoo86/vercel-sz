import { getDb } from './db';

export interface GameAccessResult {
  allowed: boolean;
  reason: 'free_play' | 'quiz_required' | 'limit_reached' | 'unlocked';
  playCount: number;
  remainingFreePlays: number;
}

export const FREE_PLAYS_PER_DAY = 4;
export const QUIZ_PASS_REQUIRED = 3;

// 服务端校验用：20x20 棋盘，最多可吃 399 个食物（每格 10 分），留少量余量防止网络重放
export const MAX_GAME_SCORE = 4000;

const DAY_MS = 86_400_000;

// 每日次数按哪个时区重置（默认北京时间）
export const GAME_TIMEZONE = process.env.GAME_TIMEZONE || 'Asia/Shanghai';

/** 将 UTC 毫秒时间转成指定时区的 YYYY-MM-DD 字符串 */
function formatDateInTz(ms: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** 返回“今天”在 GAME_TIMEZONE 时区下的 YYYY-MM-DD */
export function getTodayDateString(now: number = Date.now()): string {
  return formatDateInTz(now, GAME_TIMEZONE);
}

/**
 * 计算某个日期字符串（时区 TZ 中的自然日）对应的 UTC 毫秒起始时刻。
 * 通过对可能偏移做小时级扫描，适用于任意时区（含夏令时）。
 */
function getDayStartUtcMs(dateStr: string, timeZone: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0);
  for (let offsetHours = -15; offsetHours <= 15; offsetHours++) {
    const t = guess + offsetHours * 3_600_000;
    const isTargetDay = formatDateInTz(t, timeZone) === dateStr;
    const wasPrevDay = formatDateInTz(t - 3_600_000, timeZone) !== dateStr;
    if (isTargetDay && wasPrevDay) {
      return t;
    }
  }
  // 兜底：极罕见情况按猜测值计算
  return guess;
}

/** 返回今日在游戏时区下的 [起始UTC秒, 结束UTC秒) 窗口 */
function getTodayWindowSec(): { start: number; end: number } {
  const startMs = getDayStartUtcMs(getTodayDateString(), GAME_TIMEZONE);
  return { start: startMs / 1000, end: (startMs + DAY_MS) / 1000 };
}

// 获取用户今日已玩次数
export async function getTodayPlayCount(userId: string): Promise<number> {
  const db = getDb();
  const { start, end } = getTodayWindowSec();

  // played_at 兼容两种存储：datetime 文本 或 unix 秒（strftime('%s', x) 均可解析）
  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM game_sessions
          WHERE user_id = ? AND CAST(strftime('%s', played_at) AS INTEGER) >= ?
            AND CAST(strftime('%s', played_at) AS INTEGER) < ?`,
    args: [userId, start, end],
  });

  return Number(result.rows[0]?.count) || 0;
}

// 检查用户今日是否已通过答题解锁
export async function hasUnlockedToday(userId: string): Promise<boolean> {
  const db = getDb();
  const today = getTodayDateString();

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
  if (playCount < FREE_PLAYS_PER_DAY) {
    return {
      allowed: true,
      reason: 'free_play',
      playCount,
      remainingFreePlays: FREE_PLAYS_PER_DAY - playCount,
    };
  }

  // 已通过答题解锁：当日不再限制
  if (unlocked) {
    return {
      allowed: true,
      reason: 'unlocked',
      playCount,
      remainingFreePlays: 0,
    };
  }

  // 第5次起需要先答题解锁
  if (playCount === FREE_PLAYS_PER_DAY) {
    return {
      allowed: false,
      reason: 'quiz_required',
      playCount,
      remainingFreePlays: 0,
    };
  }

  // 兜底分支：超过免费次数且未解锁
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
  const nowSec = Math.floor(Date.now() / 1000);

  await db.execute({
    sql: 'INSERT INTO game_sessions (user_id, score, played_at) VALUES (?, ?, ?)',
    args: [userId, score, nowSec],
  });
}

// 获取排行榜 Top N
export async function getLeaderboard(limit: number = 10) {
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT
        u.id,
        u.name,
        u.email,
        MAX(g.score) as high_score,
        COUNT(*) as total_games
      FROM game_sessions g
      JOIN users u ON g.user_id = u.id
      GROUP BY u.id
      ORDER BY high_score DESC, total_games ASC, u.created_at ASC
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

// 获取用户历史最高分（无记录返回 0）
export async function getUserHighScore(userId: string): Promise<number> {
  const db = getDb();

  const result = await db.execute({
    sql: 'SELECT MAX(score) as high_score FROM game_sessions WHERE user_id = ?',
    args: [userId],
  });

  return Number(result.rows[0]?.high_score) || 0;
}

/**
 * 获取用户在排行榜中的名次（并列时采用标准名次：比 ta 分数高的人数 + 1）。
 * 没有任何游戏记录时返回 null。
 */
export async function getUserLeaderboardRank(
  userId: string
): Promise<number | null> {
  const db = getDb();

  const me = await db.execute({
    sql: 'SELECT MAX(score) as high_score FROM game_sessions WHERE user_id = ?',
    args: [userId],
  });
  const high = me.rows[0]?.high_score;
  if (high === undefined || high === null) {
    return null;
  }

  const result = await db.execute({
    sql: `
      SELECT COUNT(*) as cnt FROM (
        SELECT u.id
        FROM game_sessions g
        JOIN users u ON g.user_id = u.id
        GROUP BY u.id
        HAVING MAX(g.score) > ?
      )
    `,
    args: [high],
  });

  return Number(result.rows[0]?.cnt) + 1;
}

// 记录答题结果并解锁
export async function recordQuizAttempt(
  userId: string,
  correctCount: number,
  totalCount: number
): Promise<boolean> {
  const db = getDb();
  const passed = correctCount >= QUIZ_PASS_REQUIRED;

  await db.execute({
    sql: 'INSERT INTO quiz_attempts (user_id, correct_count, total_count, passed) VALUES (?, ?, ?, ?)',
    args: [userId, correctCount, totalCount, passed ? 1 : 0],
  });

  if (passed) {
    const today = getTodayDateString();
    // 使用 INSERT OR IGNORE 防止重复记录
    await db.execute({
      sql: 'INSERT OR IGNORE INTO daily_unlocks (user_id, unlock_date) VALUES (?, ?)',
      args: [userId, today],
    });
  }

  return passed;
}
