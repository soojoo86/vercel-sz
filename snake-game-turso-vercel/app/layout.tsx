import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: '贪吃蛇游戏 - Turso + Vercel',
  description: '基于Next.js + Turso + Vercel部署的贪吃蛇游戏',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-900 text-white">
        <Providers>
          <nav className="bg-gray-800 p-4">
            <div className="max-w-4xl mx-auto flex justify-between items-center">
              <a href="/" className="text-xl font-bold text-green-400">🐍 贪吃蛇</a>
              <div className="flex gap-4">
                <a href="/" className="hover:text-green-400 transition">游戏</a>
                <a href="/leaderboard" className="hover:text-green-400 transition">排行榜</a>
                <a href="/admin" className="hover:text-green-400 transition">题库管理</a>
              </div>
            </div>
          </nav>
          <main className="max-w-4xl mx-auto p-4">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
