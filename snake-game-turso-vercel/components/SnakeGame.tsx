'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const BASE_SPEED = 150; // 初始每步毫秒数
const MIN_SPEED = 60; // 最快速度
const SPEED_STEP = 10; // 每升一级加快的毫秒数
const FOODS_PER_LEVEL = 5; // 每吃 5 个食物升 1 级
const POINTS_PER_FOOD = 10;
const SWIPE_THRESHOLD = 24; // 滑动判定阈值(px)

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };

interface SnakeGameProps {
  onGameOver: (score: number) => void;
  disabled?: boolean;
  /** 历史最高分，用于标记“新纪录” */
  highScore?: number;
  /** 是否显示“答题解锁”按钮（需要 onUnlockRequest 配合） */
  unlockHint?: boolean;
  onUnlockRequest?: () => void;
}

const OPPOSITE: Record<Direction, Direction> = {
  UP: 'DOWN',
  DOWN: 'UP',
  LEFT: 'RIGHT',
  RIGHT: 'LEFT',
};

function speedForLevel(level: number): number {
  return Math.max(MIN_SPEED, BASE_SPEED - (level - 1) * SPEED_STEP);
}

function levelForScore(score: number): number {
  return Math.floor(score / (POINTS_PER_FOOD * FOODS_PER_LEVEL)) + 1;
}

export default function SnakeGame({
  onGameOver,
  disabled,
  highScore,
  unlockHint,
  onUnlockRequest,
}: SnakeGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const [gameStarted, setGameStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [recordBeaten, setRecordBeaten] = useState(false);

  // 与定时器 / 键盘事件共享的可变状态（避免闭包过期）
  const snakeRef = useRef<Position[]>([{ x: 10, y: 10 }]);
  const foodRef = useRef<Position | null>({ x: 15, y: 15 });
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const loopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoreRef = useRef(0);
  const startedRef = useRef(false);
  const pausedRef = useRef(false);
  const overRef = useRef(false);
  const highScoreRef = useRef(highScore ?? 0);
  const onGameOverRef = useRef(onGameOver);

  useEffect(() => {
    highScoreRef.current = highScore ?? 0;
  }, [highScore]);
  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  const clearLoop = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 网格（隔行微色差，增强可视性）
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = '#131e35';
          ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        }
      }
    }

    // 食物（红色圆点 + 高光）
    if (foodRef.current) {
      const { x, y } = foodRef.current;
      ctx.fillStyle = '#f43f5e';
      ctx.beginPath();
      ctx.arc(
        x * CELL_SIZE + CELL_SIZE / 2,
        y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 - 2,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.beginPath();
      ctx.arc(
        x * CELL_SIZE + CELL_SIZE / 2 - 3,
        y * CELL_SIZE + CELL_SIZE / 2 - 3,
        2.2,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // 蛇
    const snake = snakeRef.current;
    snake.forEach((segment, index) => {
      const isHead = index === 0;
      ctx.fillStyle = isHead ? '#4ade80' : index % 2 === 0 ? '#22c55e' : '#16a34a';
      const px = segment.x * CELL_SIZE + 1;
      const py = segment.y * CELL_SIZE + 1;
      const size = CELL_SIZE - 2;
      ctx.fillRect(px, py, size, size);
      if (isHead) {
        // 蛇头眼睛（随朝向变化）
        ctx.fillStyle = '#052e16';
        const dir = directionRef.current;
        const eyes: Position[] =
          dir === 'UP' || dir === 'DOWN'
            ? [
                { x: px + 5, y: dir === 'UP' ? py + 5 : py + size - 5 },
                { x: px + size - 5, y: dir === 'UP' ? py + 5 : py + size - 5 },
              ]
            : [
                { x: dir === 'LEFT' ? px + 5 : px + size - 5, y: py + 5 },
                { x: dir === 'LEFT' ? px + 5 : px + size - 5, y: py + size - 5 },
              ];
        eyes.forEach((e) => {
          ctx.beginPath();
          ctx.arc(e.x, e.y, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      }
    });
  }, []);

  const changeDirection = useCallback((next: Direction) => {
    if (!startedRef.current || pausedRef.current || overRef.current) return;
    // 关键修复：与“待执行方向”比较而非当前方向，
    // 避免同一 tick 内连按两次方向键造成 180° 反向自杀
    if (nextDirectionRef.current !== OPPOSITE[next]) {
      nextDirectionRef.current = next;
    }
  }, []);

  const endGame = useCallback(
    (win: boolean) => {
      if (overRef.current) return;
      overRef.current = true;
      clearLoop();
      startedRef.current = false;
      pausedRef.current = false;

      const finalScore = scoreRef.current;
      setWon(win);
      setGameOver(true);
      setGameStarted(false);
      setPaused(false);
      setRecordBeaten(finalScore > highScoreRef.current);
      onGameOverRef.current(finalScore);
    },
    [clearLoop]
  );

  const tick = useCallback(() => {
    if (!startedRef.current || pausedRef.current || overRef.current) return;

    directionRef.current = nextDirectionRef.current;
    const snake = snakeRef.current;
    const direction = directionRef.current;
    const head = { ...snake[0] };

    switch (direction) {
      case 'UP':
        head.y -= 1;
        break;
      case 'DOWN':
        head.y += 1;
        break;
      case 'LEFT':
        head.x -= 1;
        break;
      case 'RIGHT':
        head.x += 1;
        break;
    }

    // 撞墙检测
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      endGame(false);
      return;
    }

    const willEat =
      !!foodRef.current &&
      head.x === foodRef.current.x &&
      head.y === foodRef.current.y;

    // 撞自己检测：未吃食物时尾巴会移开，应允许进入原尾巴格
    const bodyToCheck = willEat ? snake : snake.slice(0, -1);
    if (bodyToCheck.some((s) => s.x === head.x && s.y === head.y)) {
      endGame(false);
      return;
    }

    const newSnake = [head, ...snake];
    if (willEat) {
      scoreRef.current += POINTS_PER_FOOD;
      setScore(scoreRef.current);

      // 吃满整张棋盘 = 通关
      if (newSnake.length >= TOTAL_CELLS) {
        snakeRef.current = newSnake;
        draw();
        endGame(true);
        return;
      }

      // 生成新食物（若棋盘未满，必然有空格）
      const emptyCells: Position[] = [];
      const occupied = new Set(newSnake.map((s) => s.y * GRID_SIZE + s.x));
      for (let i = 0; i < TOTAL_CELLS; i++) {
        if (!occupied.has(i)) {
          emptyCells.push({ x: i % GRID_SIZE, y: Math.floor(i / GRID_SIZE) });
        }
      }
      const nextFood =
        emptyCells.length > 0
          ? emptyCells[Math.floor(Math.random() * emptyCells.length)]
          : null;
      foodRef.current = nextFood;

      // 升级提速
      const newLevel = levelForScore(scoreRef.current);
      if (newLevel !== levelForScore(scoreRef.current - POINTS_PER_FOOD)) {
        setLevel(newLevel);
        clearLoop();
        if (startedRef.current && !overRef.current) {
          loopRef.current = setInterval(tick, speedForLevel(newLevel));
        }
      }
    } else {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
    draw();
  }, [clearLoop, draw, endGame]);

  const startGame = useCallback(() => {
    if (disabled) return;

    clearLoop();
    snakeRef.current = [{ x: Math.floor(GRID_SIZE / 2), y: Math.floor(GRID_SIZE / 2) }];
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    scoreRef.current = 0;
    setScore(0);
    setLevel(1);
    setWon(false);
    setGameOver(false);
    setRecordBeaten(false);
    foodRef.current = { x: 15, y: 15 };
    overRef.current = false;
    pausedRef.current = false;
    startedRef.current = true;
    setPaused(false);
    setGameStarted(true);
    draw();
    loopRef.current = setInterval(tick, BASE_SPEED);
  }, [clearLoop, disabled, draw, tick]);

  const togglePause = useCallback(() => {
    if (!startedRef.current || overRef.current) return;
    if (pausedRef.current) {
      // 恢复
      pausedRef.current = false;
      setPaused(false);
      loopRef.current = setInterval(tick, speedForLevel(levelForScore(scoreRef.current)));
    } else {
      pausedRef.current = true;
      setPaused(true);
      clearLoop();
    }
  }, [clearLoop, tick]);

  // 键盘控制（一次性绑定，内部全部使用 ref，无闭包过期问题）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: 'UP',
        w: 'UP',
        W: 'UP',
        ArrowDown: 'DOWN',
        s: 'DOWN',
        S: 'DOWN',
        ArrowLeft: 'LEFT',
        a: 'LEFT',
        A: 'LEFT',
        ArrowRight: 'RIGHT',
        d: 'RIGHT',
        D: 'RIGHT',
      };

      const mapped = keyMap[e.key];
      if (mapped) {
        // 游戏中阻止方向键滚动页面；答题弹窗打开时 gameStarted 为 false，不受影响
        if (startedRef.current) e.preventDefault();
        changeDirection(mapped);
        return;
      }

      if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
        if (startedRef.current) {
          e.preventDefault(); // 避免空格触发聚焦按钮/滚动页面
          togglePause();
        }
      }

      // 游戏结束或胜利后按 R / 回车 快速再来一局
      if ((e.key === 'r' || e.key === 'R' || e.key === 'Enter') && overRef.current) {
        if (disabled) return;
        startGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [changeDirection, disabled, startGame, togglePause]);

  // 初始绘制
  useEffect(() => {
    draw();
  }, [draw]);

  // 卸载时清理
  useEffect(() => clearLoop, [clearLoop]);

  // 触屏滑动
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return;

    if (Math.abs(dx) > Math.abs(dy)) {
      changeDirection(dx > 0 ? 'RIGHT' : 'LEFT');
    } else {
      changeDirection(dy > 0 ? 'DOWN' : 'UP');
    }
    touchStartRef.current = null;
  };

  const dirBtn =
    'w-14 h-12 rounded-lg bg-gray-700/80 active:bg-green-700 text-xl text-green-300 select-none touch-none flex items-center justify-center transition';

  // ---------- 渲染 ----------
  return (
    <div className="flex flex-col items-center gap-4">
      {/* 状态栏 */}
      <div className="flex items-center justify-between w-full max-w-[400px]">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-green-400">分数 {score}</span>
          {gameStarted && !gameOver && (
            <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-yellow-300">
              Lv.{level}
            </span>
          )}
          {gameStarted && !gameOver && paused && (
            <span className="text-xs px-2 py-0.5 bg-blue-600/30 text-blue-300 rounded-full">
              已暂停
            </span>
          )}
        </div>

        {gameStarted && !gameOver && (
          <button
            onClick={togglePause}
            className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-sm transition"
          >
            {paused ? '▶ 继续' : '⏸ 暂停'}
          </button>
        )}
        {!gameStarted && !gameOver && (
          <span className="text-xs text-gray-500">方向键 / WASD 控制</span>
        )}
      </div>

      {/* 画布 */}
      <div className="relative w-full max-w-[400px] select-none">
        <canvas
          ref={canvasRef}
          width={GRID_SIZE * CELL_SIZE}
          height={GRID_SIZE * CELL_SIZE}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'none' }}
          className="w-full h-auto rounded-lg border border-green-500/40 shadow-[0_0_20px_rgba(34,197,94,0.15)]"
        />

        {/* 待开始遮罩 */}
        {!gameStarted && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-gray-950/70 backdrop-blur-[2px]">
            {disabled ? (
              unlockHint ? (
                <>
                  <p className="text-yellow-300 font-medium px-6 text-center">
                    今日免费次数已用完
                  </p>
                  <button
                    onClick={onUnlockRequest}
                    className="bg-yellow-600 hover:bg-yellow-500 px-6 py-2.5 rounded-lg font-medium transition"
                  >
                    📝 答题解锁再玩一局
                  </button>
                </>
              ) : (
                <p className="text-gray-300 font-medium px-6 text-center">
                  今日次数已用完
                </p>
              )
            ) : (
              <>
                <p className="text-3xl">🐍</p>
                <button
                  onClick={startGame}
                  className="bg-green-600 hover:bg-green-500 px-8 py-2.5 rounded-lg font-bold text-lg transition shadow-lg shadow-green-600/25"
                >
                  开始游戏
                </button>
                <p className="text-xs text-gray-400">吃食物 +10 分 · 撞墙/撞自己结束</p>
              </>
            )}
          </div>
        )}

        {/* 暂停遮罩 */}
        {gameStarted && paused && !gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-gray-950/60">
            <p className="text-2xl font-bold">⏸ 已暂停</p>
            <button
              onClick={togglePause}
              className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded-lg font-medium transition"
            >
              继续游戏
            </button>
            <p className="text-xs text-gray-400">按 空格 / P 键 继续</p>
          </div>
        )}

        {/* 结束遮罩 */}
        {gameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-gray-950/75 text-center px-4">
            <p className="text-2xl font-bold">{won ? '🎉 通关！' : '💀 游戏结束'}</p>
            <p className="text-lg">
              最终得分{' '}
              <span className="text-green-400 font-bold text-2xl">{score}</span>
            </p>
            {recordBeaten && (
              <p className="text-yellow-300 font-medium animate-pulse">🏆 新纪录！</p>
            )}
            <div className="flex gap-3 mt-3">
              <button
                onClick={startGame}
                disabled={disabled}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 px-6 py-2 rounded-lg font-medium transition"
              >
                再玩一次
              </button>
              {disabled && unlockHint && (
                <button
                  onClick={onUnlockRequest}
                  className="bg-yellow-600 hover:bg-yellow-500 px-6 py-2 rounded-lg font-medium transition"
                >
                  📝 答题解锁
                </button>
              )}
            </div>
            {!disabled && (
              <p className="text-xs text-gray-500 mt-1">按 R 键 快速开始</p>
            )}
          </div>
        )}
      </div>

      {/* 移动端虚拟方向键 */}
      <div className="grid grid-cols-3 gap-1.5 sm:hidden">
        <div />
        <button className={dirBtn} onPointerDown={(e) => { e.preventDefault(); changeDirection('UP'); }}>
          ↑
        </button>
        <div />
        <button className={dirBtn} onPointerDown={(e) => { e.preventDefault(); changeDirection('LEFT'); }}>
          ←
        </button>
        <div className="flex items-center justify-center">
          {gameStarted && !gameOver && (
            <button
              onClick={togglePause}
              className="w-12 h-12 rounded-full bg-gray-700 text-sm text-green-300 active:bg-gray-600 transition"
            >
              {paused ? '▶' : '⏸'}
            </button>
          )}
        </div>
        <button className={dirBtn} onPointerDown={(e) => { e.preventDefault(); changeDirection('RIGHT'); }}>
          →
        </button>
        <div />
        <button className={dirBtn} onPointerDown={(e) => { e.preventDefault(); changeDirection('DOWN'); }}>
          ↓
        </button>
      </div>
    </div>
  );
}
