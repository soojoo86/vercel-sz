import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  checkGameAccess,
  recordGameScore,
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

    // 再次验证权限（防止前端绕过）
    const access = await checkGameAccess(userId);
    if (!access.allowed) {
      return NextResponse.json(
        { error: '今日游戏次数已用完，请先答题解锁' },
        { status: 403 }
      );
    }

    const previousHighScore = await getUserHighScore(userId);
    await recordGameScore(userId, score);
    const isNewHigh = score > previousHighScore;

    return NextResponse.json({
      success: true,
      message: '分数已记录',
      score,
      highScore: Math.max(previousHighScore, score),
      isNewHigh,
    });
  } catch (error) {
    console.error('提交分数错误:', error);
    return NextResponse.json(
      { error: '提交失败，请稍后重试' },
      { status: 500 }
    );
  }
}
