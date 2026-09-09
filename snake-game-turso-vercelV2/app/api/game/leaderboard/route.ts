import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/game';

export async function GET() {
  try {
    const entries = await getLeaderboard(10);
    return NextResponse.json({ entries });
  } catch (error) {
    console.error('获取排行榜错误:', error);
    return NextResponse.json(
      { error: '获取排行榜失败' },
      { status: 500 }
    );
  }
}
