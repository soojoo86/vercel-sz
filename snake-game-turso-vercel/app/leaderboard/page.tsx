'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalPoints: number;
  highScore: number;
  totalGames: number;
  streak: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  myRank: number | null;
  myPoints: number | null;
  rewardTopN?: number;
}

const REWARD_TOP_N = 10;

export default function LeaderboardPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/game/leaderboard');
      const json = await res.json();
      if (res.ok) {
        setData({
          entries: json.entries,
          myRank: json.myRank ?? null,
          myPoints: json.myPoints ?? null,
          rewardTopN: json.rewardTopN,
        });
      }
    } catch (err) {
      console.error('获取排行榜失败:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>加载排行榜中...</p>
      </div>
    );
  }

  const entries = data?.entries ?? [];
  const myRank = data?.myRank ?? null;
  const isLoggedIn = !!session?.user?.id;

  return (
    <div className="py-8">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">🏆 积分排行榜</h1>
        <Link
          href="/"
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition"
        >
          返回游戏
        </Link>
      </div>

      {/* 奖励横幅 */}
      <div className="bg-gradient-to-r from-yellow-600/30 via-orange-600/30 to-red-600/30 border border-yellow-500/50 rounded-lg p-4 mb-6 text-center">
        <p className="text-yellow-300 font-bold text-lg">
          🎁 每期积分 Top {REWARD_TOP_N} 将获得线下物质奖励！
        </p>
        <p className="text-sm text-gray-300 mt-1">
          积分 = 每局得分 + 每日首局 +10 + 连续游玩加成（最高 +50/天）+ 破纪录
          +50 + 通关 +200 + 答题奖励
        </p>
        <p className="text-xs text-gray-400 mt-1">
          坚持每天上线，连续天数越久加成越高，冲进前 {REWARD_TOP_N} 名拿奖励！
        </p>
      </div>

      {isLoggedIn && myRank !== null && (
        <div className="bg-green-600/20 border border-green-500 rounded-lg p-4 mb-6 text-center">
          <p className="text-green-400">
            你的当前排名:{' '}
            <span className="text-2xl font-bold">第 {myRank} 名</span>
            <span className="ml-3">
              累计积分 <span className="text-2xl font-bold">{data?.myPoints ?? 0}</span>
            </span>
          </p>
          {myRank > REWARD_TOP_N && (
            <p className="text-sm text-yellow-300 mt-1">
              距离奖励区（Top {REWARD_TOP_N}）还差 {myRank - REWARD_TOP_N} 个名次，继续加油！
            </p>
          )}
        </div>
      )}

      <div className="bg-gray-800 rounded-lg overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">排名</th>
              <th className="px-4 py-3 text-left text-sm font-medium">玩家</th>
              <th className="px-4 py-3 text-right text-sm font-medium">累计积分</th>
              <th className="px-4 py-3 text-right text-sm font-medium">最高分</th>
              <th className="px-4 py-3 text-right text-sm font-medium">连续天数</th>
              <th className="px-4 py-3 text-right text-sm font-medium">游戏次数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  暂无玩家，快去创造第一个高分吧！
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const isMe = session?.user?.id === entry.userId;
                const inRewardZone = entry.rank <= REWARD_TOP_N;
                return (
                  <tr
                    key={entry.userId}
                    className={isMe ? 'bg-green-600/10' : 'hover:bg-gray-700/50'}
                  >
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${
                          entry.rank === 1
                            ? 'bg-yellow-500 text-black'
                            : entry.rank === 2
                            ? 'bg-gray-400 text-black'
                            : entry.rank === 3
                            ? 'bg-orange-600 text-white'
                            : 'bg-gray-600'
                        }`}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={isMe ? 'text-green-400 font-bold' : ''}>
                        {entry.name}
                        {isMe && ' (我)'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right font-bold text-yellow-400">
                      {entry.totalPoints}
                      {inRewardZone && (
                        <span className="ml-1 text-xs" title="奖励区">
                          🎁
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-green-400">
                      {entry.highScore}
                    </td>
                    <td className="px-4 py-4 text-right">
                      {entry.streak > 0 ? (
                        <span className="text-orange-400">🔥 {entry.streak} 天</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-400">
                      {entry.totalGames}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {entries.length > 0 && entries[entries.length - 1].totalPoints === 0 && (
        <p className="text-xs text-gray-500 mt-3 text-center">
          以上为全部注册玩家名单（按累计积分排序）；积分为 0 表示还没有游玩记录
        </p>
      )}
    </div>
  );
}
