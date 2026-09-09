'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import SnakeGame from '@/components/SnakeGame';
import QuizModal from '@/components/QuizModal';

interface GameStatus {
  allowed: boolean;
  reason: string;
  playCount: number;
  remainingFreePlays: number;
  highScore: number;
  user?: { name?: string; email: string };
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchGameStatus();
    }
  }, [status, router]);

  const fetchGameStatus = async () => {
    try {
      const res = await fetch('/api/game/status');
      const data = await res.json();
      if (res.ok) {
        setGameStatus(data);
      }
    } catch (err) {
      console.error('获取游戏状态失败:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGameOver = async (score: number) => {
    try {
      const res = await fetch('/api/game/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`游戏结束！得分 ${score} 已记录`);
        setTimeout(() => setMessage(''), 3000);
        fetchGameStatus();
      } else {
        setMessage(data.error || '分数提交失败');
      }
    } catch (err) {
      setMessage('分数提交失败');
    }
  };

  const handleQuizPass = () => {
    setMessage('🎉 答题通过！已解锁今日游戏');
    setTimeout(() => setMessage(''), 3000);
    fetchGameStatus();
  };

  const handlePlayClick = () => {
    if (gameStatus?.reason === 'quiz_required') {
      setShowQuiz(true);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>加载中...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">
            欢迎，{session.user.name || session.user.email?.split('@')[0]}！
          </h1>
          <p className="text-gray-400 text-sm mt-1">{session.user.email}</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition"
        >
          退出登录
        </button>
      </div>

      {message && (
        <div className="bg-blue-500/20 border border-blue-500 text-blue-300 p-3 rounded mb-6 text-center">
          {message}
        </div>
      )}

      {/* 状态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm">今日已玩</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {gameStatus?.playCount || 0} <span className="text-lg text-gray-500">/ 5</span>
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm">剩余免费次数</p>
          <p className="text-3xl font-bold text-yellow-400 mt-1">
            {gameStatus?.remainingFreePlays || 0}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm">历史最高分</p>
          <p className="text-3xl font-bold text-red-400 mt-1">
            {gameStatus?.highScore || 0}
          </p>
        </div>
      </div>

      {/* 游戏区域 */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">🐍 贪吃蛇游戏</h2>
          {!gameStatus?.allowed && gameStatus?.reason === 'quiz_required' && (
            <button
              onClick={() => setShowQuiz(true)}
              className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded text-sm font-medium transition"
            >
              答题解锁
            </button>
          )}
          {!gameStatus?.allowed && gameStatus?.reason === 'limit_reached' && (
            <span className="text-red-400 text-sm">今日次数已用完</span>
          )}
        </div>

        {!gameStatus?.allowed && gameStatus?.reason === 'limit_reached' ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-lg mb-2">今日游戏次数已用完</p>
            <p className="text-sm">明天再来挑战吧！或前往查看排行榜</p>
            <button
              onClick={() => router.push('/leaderboard')}
              className="mt-4 bg-green-600 hover:bg-green-700 px-6 py-2 rounded font-medium transition"
            >
              查看排行榜
            </button>
          </div>
        ) : (
          <div onClick={handlePlayClick}>
            <SnakeGame
              onGameOver={handleGameOver}
              disabled={!gameStatus?.allowed}
            />
          </div>
        )}
      </div>

      {/* 游戏说明 */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="font-bold text-lg mb-3">📋 游戏规则</h3>
        <ul className="space-y-2 text-gray-300 text-sm">
          <li>• 每天前 <span className="text-green-400 font-bold">4次</span> 免费游玩，无需任何限制</li>
          <li>• 第5次游玩前需要完成 <span className="text-yellow-400 font-bold">5道贪吃蛇知识题</span>，答对3题即可解锁</li>
          <li>• 使用 <span className="font-mono bg-gray-700 px-1 rounded">方向键</span> 或 <span className="font-mono bg-gray-700 px-1 rounded">WASD</span> 控制蛇的移动</li>
          <li>• 吃到红色食物得10分，撞墙或撞到自己游戏结束</li>
          <li>• 排行榜按最高分排名，快去挑战吧！</li>
        </ul>
      </div>

      <QuizModal
        isOpen={showQuiz}
        onClose={() => setShowQuiz(false)}
        onPass={handleQuizPass}
      />
    </div>
  );
}
