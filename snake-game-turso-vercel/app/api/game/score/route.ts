import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  checkGameAccess,
  consumePlayAndRecordScore,
  getUserHighScore,
  MAX_GAME_SCORE,
} from '@/lib/game';
import { z } from 'zod';

const scoreSchema = z.object({
  score: z.number().int().min(0).max(MAX_GAME_SCORE, '分数超出合理范围'),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const validated = scoreSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0]?.message || '分数格式错误' },
        { status: 400 }
      );
    }

    const { score } = validated.data;
    const userId = session.user.id;

    const previousHighScore = await getUserHighScore(userId);

    let playResult;
    try {
      // 校验 + 扣减次数 + 记录分数 + 结算积分（事务原子执行）
      playResult = await consumePlayAndRecordScore(userId, score);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      if (code === 'DAILY_LIMIT_REACHED') {
        return NextResponse.json(
          { error: '今日游戏次数已用完（每天最多 5 次），明天再来吧' },
          { status: 403 }
        );
      }
      if (code === 'QUIZ_REQUIRED') {
        return NextResponse.json(
          { error: '本次游戏机会已用完，请先答题获取新的机会' },
          { status: 403 }
        );
      }
      throw err;
    }

    const isNewHigh = score > previousHighScore;

    return NextResponse.json({
      success: true,
      message: '分数已记录',
      score,
      highScore: Math.max(previousHighScore, score),
      isNewHigh,
      pointsEarned: playResult.pointsEarned,
      pointsBreakdown: playResult.breakdown,
    });
  } catch (error) {
    console.error('提交分数错误:', error);
    return NextResponse.json(
      { error: '提交失败，请稍后重试' },
      { status: 500 }
    );
  }
}
