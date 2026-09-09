'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SnakeGame from '@/components/SnakeGame';
import QuizModal from '@/components/QuizModal';

interface GameStatus {
  allowed: boolean;
  reason: string;
  playCount: number;
  remainingPlays: number;
  credits: number;
  highScore: number;
  totalPoints?: number;
  streak?: number;
  rank?: number | null;
  maxPlaysPerDay?: number;
  quizPassRequired?: number;
  quizQuestionCount?: number;
  user?: { name?: string; email: string };
}

type Message = { type: 'ok' | 'error'; text: string } | null;

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message>(null);

  const showTemporaryMessage = useCallback((type: 'ok' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3500);
  }, []);

  const fetchGameStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/game/status');
      const data = await res.json();
      if (res.ok) {
        setGameStatus(data);
      } else {
        showTemporaryMessage('error', data.error || '获取状态失败');
      }
    } catch (err) {
      console.error('获取游戏状态失败:', err);
      showTemporaryMessage('error', '网络异常，请刷新重试');
    } finally {
      setLoading(false);
    }
  }, [showTemporaryMessage]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      fetchGameStatus();
    }
  }, [status, router, fetchGameStatus]);

  const handleGameOver = useCallback(
    async (score: number) => {
      try {
        const res = await fetch('/api/game/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ score }),
        });
        const data = await res.json();
        if (res.ok) {
          const breakdownText = (data.pointsBreakdown || [])
            .map((item: { label: string; points: number }) => `${item.label} +${item.points}`)
            .join('，');
          showTemporaryMessage(
            'ok',
            `游戏结束！得分 ${score}，获得积分 +${data.pointsEarned ?? 0}${
              breakdownText ? `（${breakdownText}）` : ''
            }${data.isNewHigh ? ' 🏆 刷新了历史纪录！' : ''}`
          );
          fetchGameStatus();
        } else {
          showTemporaryMessage('error', data.error || '分数提交失败');
          // 若服务器判定无权游玩，同步刷新状态（可能已被其它端消耗次数）
          if (res.status === 401 || res.status === 403) {
            fetchGameStatus();
          }
        }
      } catch (err) {
        console.error('提交分数失败:', err);
        showTemporaryMessage('error', '分数提交失败，请检查网络');
      }
    },
    [fetchGameStatus, showTemporaryMessage]
  );

  const handleQuizPass = useCallback(() => {
    showTemporaryMessage('ok', '🎉 答题通过！获得 1 次游戏机会');
    fetchGameStatus();
  }, [fetchGameStatus, showTemporaryMessage]);

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

  const maxPlays = gameStatus?.maxPlaysPerDay ?? 5;
  const quizCount = gameStatus?.quizQuestionCount ?? 3;
  const unlocked = gameStatus?.reason === 'unlocked';
  const quizRequired = gameStatus?.reason === 'quiz_required';
  const limitReached = gameStatus?.reason === 'limit_reached';

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
        <div
          className={`p-3 rounded mb-6 text-center border ${
            message.type === 'ok'
              ? 'bg-green-500/20 border-green-500 text-green-300'
              : 'bg-red-500/20 border-red-500 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 状态卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm">今日已玩</p>
          <p className="text-3xl font-bold text-green-400 mt-1">
            {gameStatus?.playCount ?? 0}
            <span className="text-lg text-gray-500"> / {maxPlays} 次</span>
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm">可用游戏机会</p>
          {unlocked ? (
            <p className="text-3xl font-bold text-green-400 mt-1">
              {gameStatus?.credits ?? 0}
              <span className="text-lg text-gray-500"> 次（答题解锁）</span>
            </p>
          ) : (
            <p className="text-2xl font-bold text-yellow-400 mt-2">
              {limitReached ? '今日已用完' : (gameStatus?.playCount ?? 0) === 0 ? '首次免费' : '需答题获取'}
            </p>
          )}
        </div>
        <div className="bg-gradient-to-br from-yellow-600/20 to-orange-600/20 border border-yellow-500/40 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm">累计积分</p>
          <p className="text-3xl font-bold text-yellow-400 mt-1">
            {gameStatus?.totalPoints ?? 0}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            排名第 {gameStatus?.rank ?? '-'} 名
            {(gameStatus?.streak ?? 0) > 0 && ` · 🔥 连续 ${gameStatus?.streak} 天`}
          </p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 text-center">
          <p className="text-gray-400 text-sm">历史最高分</p>
          <p className="text-3xl font-bold text-red-400 mt-1">
            {gameStatus?.highScore ?? 0}
          </p>
        </div>
      </div>

      {/* 游戏区域 */}
      <div className="bg-gray-800 rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
          <h2 className="text-xl font-bold">🐍 贪吃蛇游戏</h2>
          {quizRequired && (
            <button
              onClick={() => setShowQuiz(true)}
              className="bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded text-sm font-medium transition"
            >
              📝 答题获取游戏机会
            </button>
          )}
          {limitReached && (
            <span className="text-red-400 text-sm">今日次数已用完</span>
          )}
        </div>

        {limitReached ? (
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
          <SnakeGame
            onGameOver={handleGameOver}
            disabled={!gameStatus?.allowed}
            highScore={gameStatus?.highScore}
            unlockHint={quizRequired}
            onUnlockRequest={() => setShowQuiz(true)}
          />
        )}
      </div>

      {/* 游戏说明 */}
      <div className="bg-gray-800/50 rounded-lg p-6">
        <h3 className="font-bold text-lg mb-3">📋 游戏规则</h3>
        <ul className="space-y-2 text-gray-300 text-sm">
          <li>
            • 每天最多可玩 <span className="text-green-400 font-bold">{maxPlays} 次</span>，
            其中<span className="text-green-400 font-bold">第 1 次免费</span>
          </li>
          <li>
            • 第 2 次起，每次游玩前需完成{' '}
            <span className="text-yellow-400 font-bold">{quizCount} 道信息安全题目</span>，
            <span className="text-yellow-400 font-bold">全部答对</span>才能获得 1 次游戏机会
          </li>
          <li>
            • 使用{' '}
            <span className="font-mono bg-gray-700 px-1 rounded">方向键</span> 或{' '}
            <span className="font-mono bg-gray-700 px-1 rounded">WASD</span>{' '}
            控制，手机上可直接滑动或使用屏幕按钮
          </li>
          <li>
            • 每吃一个食物 <span className="text-red-400 font-bold">+10分</span>，
            速度随分数提升逐步加快；空格 / P 键可暂停
          </li>
          <li>• 撞墙或撞到自己游戏结束，吃满整张棋盘可通关</li>
        </ul>

        <h3 className="font-bold text-lg mt-6 mb-3">💰 积分规则</h3>
        <ul className="space-y-2 text-gray-300 text-sm">
          <li>
            • <span className="text-yellow-400 font-bold">每局得分 = 积分</span>，
            玩得越好赚得越多
          </li>
          <li>
            • <span className="text-yellow-400 font-bold">每日首局 +10</span>，
            天天都有基础奖励
          </li>
          <li>
            • <span className="text-yellow-400 font-bold">连续游玩加成</span>：
            连续第 N 天额外 +5×N（最高 +50/天），中断则重新计算——坚持就是优势！
          </li>
          <li>
            • <span className="text-yellow-400 font-bold">刷新纪录 +50</span>，
            <span className="text-yellow-400 font-bold"> 通关 +200</span>
            （吃满 3990 分）
          </li>
          <li>
            • 答题全部答对 <span className="text-yellow-400 font-bold">+5</span>（每日上限 15）
          </li>
          <li className="text-yellow-300">
            🎁 积分排行榜 Top 10 将获得线下物质奖励，<Link href="/leaderboard" className="underline">前往排行榜</Link> 查看当前战况
          </li>
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
