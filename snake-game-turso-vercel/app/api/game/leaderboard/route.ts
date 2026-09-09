import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getLeaderboard,
  getUserHighScore,
  getUserLeaderboardRank,
} from '@/lib/game';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const entries = await getLeaderboard(10);

    // 排行榜公开可看；若已登录则附带“我的排名 / 最高分”用于高亮
    let myRank: number | null = null;
    let myHighScore: number | null = null;
    try {
      const session = await auth();
      if (session?.user?.id) {
        myRank = await getUserLeaderboardRank(session.user.id);
        myHighScore = await getUserHighScore(session.user.id);
      }
    } catch {
      // 匿名访问时忽略鉴权
    }

    return NextResponse.json({ entries, myRank, myHighScore });
  } catch (error) {
    console.error('获取排行榜错误:', error);
    return NextResponse.json(
      { error: '获取排行榜失败' },
      { status: 500 }
    );
  }
}
