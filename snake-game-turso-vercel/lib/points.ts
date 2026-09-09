import { getDb } from './db';
import { ensureSchema } from './db/schema';
import { getTodayDateString } from './game';

// ===== 积分规则常量（前端展示与结算共用） =====

/** 每局基础积分 = 本局游戏得分 */
export const POINTS_BASE_PER_GAME = 'score';
/** 每日第一局额外奖励 */
export const POINTS_DAILY_FIRST_BONUS = 10;
/** 连续游玩第 N 天奖励：+5 × min(N, 10) */
export const POINTS_STREAK_PER_DAY = 5;
export const POINTS_STREAK_MAX_DAYS = 10;
/** 刷新个人历史纪录额外奖励 */
export const POINTS_NEW_RECORD_BONUS = 50;
/** 吃满整张棋盘（3990 分）通关奖励 */
export const POINTS_PERFECT_BONUS = 200;
/** 答题全部答对奖励 */
export const POINTS_QUIZ_BONUS = 5;
/** 每日答题积分上限（防止刷分） */
export const POINTS_QUIZ_DAILY_CAP = 15;

// 通关分数：20x20 棋盘 399 个食物 × 10 分
export const PERFECT_SCORE = 3990;

/** 排行榜奖励区名次（Top N 线下物质奖励） */
export const REWARD_TOP_N = 10;

export interface PointsLeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalPoints: number;
  highScore: number;
  totalGames: number;
  streak: number;
}

export interface UserPointsSummary {
  totalPoints: number;
  streak: number;
  rank: number | null;
}

/**
 * 积分排行榜：展示所有注册用户（含 0 分），
 * 按累计积分排序，同分比最高分。
 */
export async function getPointsLeaderboard(limit = 50): Promise<PointsLeaderboardEntry[]> {
  await ensureSchema();
  const db = getDb();

  const result = await db.execute({
    sql: `
      SELECT
        u.id,
        u.name,
        u.email,
        COALESCE(p.total_points, 0) AS total_points,
        COALESCE(p.streak, 0) AS streak,
        COALESCE(s.high_score, 0) AS high_score,
        COALESCE(s.total_games, 0) AS total_games
      FROM users u
      LEFT JOIN user_points p ON p.user_id = u.id
      LEFT JOIN (
        SELECT user_id, MAX(score) AS high_score, COUNT(*) AS total_games
        FROM game_sessions
        GROUP BY user_id
      ) s ON s.user_id = u.id
      ORDER BY total_points DESC, high_score DESC, u.email ASC
      LIMIT ?
    `,
    args: [limit],
  });

  return result.rows.map((row, index) => ({
    rank: index + 1,
    userId: row.id as string,
    name: (row.name as string) || ((row.email as string) || '').split('@')[0] || '匿名玩家',
    totalPoints: Number(row.total_points) || 0,
    highScore: Number(row.high_score) || 0,
    totalGames: Number(row.total_games) || 0,
    streak: Number(row.streak) || 0,
  }));
}

/** 用户积分概要：累计积分、连续天数、当前名次 */
export async function getUserPointsSummary(userId: string): Promise<UserPointsSummary> {
  await ensureSchema();
  const db = getDb();

  const today = getTodayDateString();
  const result = await db.execute({
    sql: 'SELECT total_points, streak, last_play_date FROM user_points WHERE user_id = ?',
    args: [userId],
  });

  const row = result.rows[0];
  // 连续天数展示：仅当今天玩过或昨天玩过才有效，断签则显示为 0
  let streak = 0;
  let totalPoints = 0;
  if (row) {
    totalPoints = Number(row.total_points) || 0;
    const last = row.last_play_date as string | null;
    const yesterday = getTodayDateString(Date.now() - 86_400_000);
    if (last === today || last === yesterday) {
      streak = Number(row.streak) || 0;
    }
  }

  // 名次：比我积分高的人数 + 1（无积分时排在所有 >0 用户之后）
  const rankResult = await db.execute({
    sql: 'SELECT COUNT(*) AS cnt FROM user_points WHERE total_points > ?',
    args: [totalPoints],
  });
  const rank = Number(rankResult.rows[0]?.cnt) + 1;

  return { totalPoints, streak, rank };
}
