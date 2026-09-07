
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { initDb } from '@/lib/db'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Turso Auth App',
  description: 'Next.js app with Turso DB authentication',
}

// 在服务器启动时初始化数据库
initDb().catch(console.error)

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
