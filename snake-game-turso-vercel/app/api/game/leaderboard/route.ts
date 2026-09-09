import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  getPointsLeaderboard,
  getUserPointsSummary,
  REWARD_TOP_N,
} from '@/lib/points';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 展示所有注册用户（积分榜，含 0 分用户）
    const entries = await getPointsLeaderboard(50);

    // 排行榜公开可看；若已登录则附带"我的排名 / 累计积分"用于高亮
    let myRank: number | null = null;
    let myPoints: number | null = null;
    try {
      const session = await auth();
      if (session?.user?.id) {
        const summary = await getUserPointsSummary(session.user.id);
        myRank = summary.rank;
        myPoints = summary.totalPoints;
      }
    } catch {
      // 匿名访问时忽略鉴权
    }

    return NextResponse.json({ entries, myRank, myPoints, rewardTopN: REWARD_TOP_N });
  } catch (error) {
    console.error('获取排行榜错误:', error);
    return NextResponse.json(
      { error: '获取排行榜失败' },
      { status: 500 }
    );
  }
}
