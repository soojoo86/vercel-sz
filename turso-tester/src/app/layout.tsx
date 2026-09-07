import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Turso 数据库连接测试工具',
  description: '测试 Vercel 与 Turso 数据库的连接状态',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
