import { getDb } from './db';
import { ensureSchema } from './db/schema';

export interface GameAccessResult {
  allowed: boolean;
  reason: 'free_play' | 'quiz_required' | 'limit_reached' | 'unlocked';
  playCount: number;
  remainingPlays: number;
  credits: number; // 当前可用的答题机会数
}

// 每天最多可玩次数
export const MAX_PLAYS_PER_DAY = 5;
// 每次答题的题目数，全部答对才获得一次游戏机会
export const QUIZ_QUESTION_COUNT = 3;
export const QUIZ_PASS_REQUIRED = QUIZ_QUESTION_COUNT;

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

  // played_at 兼容两种存储：unix 秒（数字）或 datetime 文本（strftime 解析）
  const result = await db.execute({
    sql: `SELECT COUNT(*) as count FROM game_sessions
          WHERE user_id = ?
            AND CAST(CASE typeof(played_at)
                  WHEN 'text' THEN strftime('%s', played_at)
                  ELSE played_at END AS INTEGER) >= ?
            AND CAST(CASE typeof(played_at)
                  WHEN 'text' THEN strftime('%s', played_at)
                  ELSE played_at END AS INTEGER) < ?`,
    args: [userId, start, end],
  });

  return Number(result.rows[0]?.count) || 0;
}

// 获取用户今日剩余答题机会（credits）
export async function getTodayCredits(userId: string): Promise<number> {
  const db = getDb();
  const today = getTodayDateString();

  const result = await db.execute({
    sql: 'SELECT credits FROM daily_credits WHERE user_id = ? AND credit_date = ?',
    args: [userId, today],
  });

  return Number(result.rows[0]?.credits) || 0;
}

// 检查游戏访问权限
export async function checkGameAccess(userId: string): Promise<GameAccessResult> {
  const playCount = await getTodayPlayCount(userId);

  // 今日次数已用完（每天最多 5 次）
  if (playCount >= MAX_PLAYS_PER_DAY) {
    return {
      allowed: false,
      reason: 'limit_reached',
      playCount,
      remainingPlays: 0,
      credits: 0,
    };
  }

  // 每天第一次免费玩
  if (playCount === 0) {
    return {
      allowed: true,
      reason: 'free_play',
      playCount,
      remainingPlays: MAX_PLAYS_PER_DAY - playCount,
      credits: 0,
    };
  }

  // 第 2~5 次：需要消耗一次答题机会
  const credits = await getTodayCredits(userId);
  if (credits > 0) {
    return {
      allowed: true,
      reason: 'unlocked',
      playCount,
      remainingPlays: MAX_PLAYS_PER_DAY - playCount,
      credits,
    };
  }

  return {
    allowed: false,
    reason: 'quiz_required',
    playCount,
    remainingPlays: MAX_PLAYS_PER_DAY - playCount,
    credits: 0,
  };
}

export interface PointsBreakdownItem {
  label: string;
  points: number;
}

export interface PlayResult {
  pointsEarned: number;
  breakdown: PointsBreakdownItem[];
}

/**
 * 记录游戏分数、消耗次数并结算积分：
 * - 每天第一次免费；后续每次消耗一个答题机会（credits - 1）
 * - 积分 = 本局得分 + 每日首局奖 + 连续游玩奖 + 破纪录奖 + 通关奖
 * - 通过事务保证"校验 + 扣减 + 记录 + 积分"的原子性
 */
export async function consumePlayAndRecordScore(
  userId: string,
  score: number
): Promise<PlayResult> {
  await ensureSchema();
  const db = getDb();
  const today = getTodayDateString();
  const yesterday = getTodayDateString(Date.now() - DAY_MS);
  const nowSec = Math.floor(Date.now() / 1000);

  const tx = await db.transaction();

  try {
    const playCount = await getTodayPlayCount(userId);

    if (playCount >= MAX_PLAYS_PER_DAY) {
      throw new Error('DAILY_LIMIT_REACHED');
    }

    if (playCount > 0) {
      // 非首次游玩，需要消耗一个答题机会
      const creditResult = await tx.execute({
        sql: `UPDATE daily_credits
              SET credits = credits - 1, updated_at = datetime('now')
              WHERE user_id = ? AND credit_date = ? AND credits > 0`,
        args: [userId, today],
      });

      if (creditResult.rowsAffected === 0) {
        throw new Error('QUIZ_REQUIRED');
      }
    }

    // ---- 积分结算 ----
    const highRow = await tx.execute({
      sql: 'SELECT MAX(score) AS high_score FROM game_sessions WHERE user_id = ?',
      args: [userId],
    });
    const previousHigh = Number(highRow.rows[0]?.high_score) || 0;

    const pointsRow = await tx.execute({
      sql: 'SELECT streak, last_play_date FROM user_points WHERE user_id = ?',
      args: [userId],
    });
    const p = pointsRow.rows[0];
    let streak = 1;
    let isNewStreakDay = true;
    if (p) {
      const last = p.last_play_date as string | null;
      if (last === today) {
        streak = Number(p.streak) || 1;
        isNewStreakDay = false;
      } else if (last === yesterday) {
        streak = (Number(p.streak) || 0) + 1;
      }
    }

    const breakdown: PointsBreakdownItem[] = [
      { label: '本局得分', points: score },
    ];
    if (playCount === 0) {
      breakdown.push({ label: '每日首局奖励', points: 10 });
    }
    if (isNewStreakDay) {
      const streakBonus = 5 * Math.min(streak, 10);
      breakdown.push({
        label: `连续游玩第 ${streak} 天`,
        points: streakBonus,
      });
    }
    if (score > previousHigh && score > 0) {
      breakdown.push({ label: '刷新纪录奖励', points: 50 });
    }
    if (score >= 3990) {
      breakdown.push({ label: '通关奖励', points: 200 });
    }

    const pointsEarned = breakdown.reduce((sum, item) => sum + item.points, 0);

    await tx.execute({
      sql: `INSERT INTO user_points (user_id, total_points, streak, last_play_date)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
              total_points = total_points + excluded.total_points,
              streak = excluded.streak,
              last_play_date = excluded.last_play_date,
              updated_at = datetime('now')`,
      args: [userId, pointsEarned, streak, today],
    });

    await tx.execute({
      sql: 'INSERT INTO point_transactions (user_id, points, reason, detail) VALUES (?, ?, ?, ?)',
      args: [userId, pointsEarned, 'game', JSON.stringify(breakdown)],
    });

    await tx.execute({
      sql: 'INSERT INTO game_sessions (user_id, score, played_at) VALUES (?, ?, ?)',
      args: [userId, score, nowSec],
    });

    await tx.commit();
    return { pointsEarned, breakdown };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
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

// 记录答题结果；3 题全部答对则获得一次游戏机会（credits + 1），并奖励积分
export async function recordQuizAttempt(
  userId: string,
  correctCount: number,
  totalCount: number
): Promise<boolean> {
  await ensureSchema();
  const db = getDb();
  const passed = correctCount >= QUIZ_PASS_REQUIRED;

  await db.execute({
    sql: 'INSERT INTO quiz_attempts (user_id, correct_count, total_count, passed) VALUES (?, ?, ?, ?)',
    args: [userId, correctCount, totalCount, passed ? 1 : 0],
  });

  if (passed) {
    const today = getTodayDateString();
    await db.execute({
      sql: `INSERT INTO daily_credits (user_id, credit_date, credits)
            VALUES (?, ?, 1)
            ON CONFLICT(user_id, credit_date)
            DO UPDATE SET credits = credits + 1, updated_at = datetime('now')`,
      args: [userId, today],
    });

    // 答题积分：每次全对 +5，每日上限 15（防止反复答题刷分）
    const quizRow = await db.execute({
      sql: 'SELECT quiz_points_date, quiz_points_today FROM user_points WHERE user_id = ?',
      args: [userId],
    });
    const row = quizRow.rows[0];
    const qDate = row?.quiz_points_date as string | null;
    const qToday =
      qDate === today ? Number(row?.quiz_points_today) || 0 : 0;

    if (qToday < 15) {
      const awarded = Math.min(5, 15 - qToday);
      await db.execute({
        sql: `INSERT INTO user_points (user_id, total_points, quiz_points_date, quiz_points_today)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id) DO UPDATE SET
                total_points = total_points + excluded.total_points,
                quiz_points_date = excluded.quiz_points_date,
                quiz_points_today = excluded.quiz_points_today,
                updated_at = datetime('now')`,
        args: [userId, awarded, today, qToday + awarded],
      });
      await db.execute({
        sql: 'INSERT INTO point_transactions (user_id, points, reason) VALUES (?, ?, ?)',
        args: [userId, awarded, 'quiz_correct'],
      });
    }
  }

  return passed;
}
