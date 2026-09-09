import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  checkGameAccess,
  getUserHighScore,
  FREE_PLAYS_PER_DAY,
  QUIZ_PASS_REQUIRED,
  MAX_GAME_SCORE,
} from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const userId = session.user.id;
    const access = await checkGameAccess(userId);
    const highScore = await getUserHighScore(userId);

    return NextResponse.json({
      ...access,
      highScore,
      freePlaysPerDay: FREE_PLAYS_PER_DAY,
      quizPassRequired: QUIZ_PASS_REQUIRED,
      maxGameScore: MAX_GAME_SCORE,
      user: {
        name: session.user.name,
        email: session.user.email,
      },
    });
  } catch (error) {
    console.error('获取游戏状态错误:', error);
    return NextResponse.json(
      { error: '获取状态失败' },
      { status: 500 }
    );
  }
}
