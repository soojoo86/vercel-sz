'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  highScore: number;
  totalGames: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  myRank: number | null;
  myHighScore: number | null;
}

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
          myHighScore: json.myHighScore ?? null,
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
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">🏆 排行榜</h1>
        <Link
          href="/"
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition"
        >
          返回游戏
        </Link>
      </div>

      {isLoggedIn && myRank !== null && (
        <div className="bg-green-600/20 border border-green-500 rounded-lg p-4 mb-6 text-center">
          <p className="text-green-400">
            你的当前排名:{' '}
            <span className="text-2xl font-bold">第 {myRank} 名</span>
            {myRank > entries.length && entries.length > 0 && (
              <span className="ml-2 text-sm opacity-80">
                榜单仅展示前 {entries.length} 名，再拿个高分就能上榜！
              </span>
            )}
          </p>
          {typeof data?.myHighScore === 'number' && (
            <p className="text-sm text-gray-400 mt-1">历史最高分：{data.myHighScore}</p>
          )}
        </div>
      )}

      {isLoggedIn && myRank === null && (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 mb-6 text-center text-gray-400">
          <p>还没有游戏记录，快去创造第一个高分吧！</p>
        </div>
      )}

      <div className="bg-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-medium">排名</th>
              <th className="px-6 py-3 text-left text-sm font-medium">玩家</th>
              <th className="px-6 py-3 text-right text-sm font-medium">最高分</th>
              <th className="px-6 py-3 text-right text-sm font-medium">游戏次数</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-gray-400">
                  暂无记录，快去创造第一个高分吧！
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const isMe = session?.user?.id === entry.userId;
                return (
                  <tr
                    key={entry.userId}
                    className={isMe ? 'bg-green-600/10' : 'hover:bg-gray-700/50'}
                  >
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4">
                      <span className={isMe ? 'text-green-400 font-bold' : ''}>
                        {entry.name}
                        {isMe && ' (我)'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-green-400">
                      {entry.highScore}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-400">
                      {entry.totalGames}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
