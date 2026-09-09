# 🐍 贪吃蛇游戏 - Turso + Vercel 部署版

基于 Next.js + Turso (libSQL) + NextAuth 构建的贪吃蛇游戏，支持邮箱注册登录、每日游戏次数限制、答题解锁和积分排行榜。

## ✨ 功能特性

1. **邮箱注册登录** - 使用邮箱和密码注册登录，密码安全哈希存储
2. **贪吃蛇游戏** - 经典贪吃蛇玩法，Canvas 绘制，方向键/WASD 控制
3. **每日次数限制** - 每天前 4 次免费游玩（按 `Asia/Shanghai` 时区重置）
4. **答题解锁机制** - 第 5 次游玩前需答对 5 道题中的 3 道，通过后当日畅玩
5. **积分排行榜** - 按历史最高分排名，实时更新，支持查看自己名次
6. **Turso 数据库** - 使用边缘 SQLite 数据库，全球低延迟
7. **Vercel 部署** - 一键部署到 Vercel Serverless 平台

### 🎮 游戏体验细节

- 每吃一个食物 **+10 分**，分数越高蛇移动越快（有难度上限）
- 支持 **暂停/继续**（空格键 / P 键 或暂停按钮）
- 支持 **手机触屏滑动** 与 **屏幕方向按钮**，桌面端可用方向键 / WASD
- 破纪录时显示「🏆 新纪录」角标，吃满整张棋盘可**通关**
- 游戏结束后按 **R / Enter** 可快速再来一局

## 🚀 本地开发

### 1. 环境准备

- Node.js 18+（建议 18/20/22 LTS）
- Turso CLI: `npm install -g tursodatabase/turso` 或访问 https://turso.tech

### 2. 配置 Turso 数据库

```bash
# 登录 Turso
turso auth login

# 创建数据库
turso db create snake-game

# 获取数据库 URL
turso db show snake-game --url

# 创建认证 Token
turso db tokens create snake-game
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local` 并填写：

```bash
cp .env.example .env.local
```

```env
# Turso 数据库
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# NextAuth v5（生成：openssl rand -hex 32）
AUTH_SECRET=生成一个随机字符串
AUTH_URL=http://localhost:3000   # 本地开发地址

# 可选：每日次数重置时区（默认 Asia/Shanghai）
GAME_TIMEZONE=Asia/Shanghai
```

> 说明：项目使用 NextAuth v5 的 `AUTH_SECRET` 命名；若从 v4 迁移且只配置过
> `NEXTAUTH_SECRET`，代码会自动兼容读取。

### 4. 初始化数据库表

```bash
npm install
npm run db:init
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## ☁️ 部署到 Vercel

1. 将代码推送到你的 GitHub 仓库
2. 访问 https://vercel.com/new 导入该项目
3. 在 "Environment Variables" 中配置：
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `AUTH_SECRET`
   - （`AUTH_URL` 无需填写，Vercel 会自动注入生产域名）
4. 点击 "Deploy"

### Vercel 部署注意事项

- **Node.js 版本**：在 `package.json` 的 `engines` 字段指定，Vercel 支持 18/20/22
- **Serverless 函数**：App Router 与 API Routes 会自动部署为 Serverless Functions
- **数据库连接**：使用 `@libsql/client` 通过 HTTP 连接 Turso，适配 Serverless 环境
- **安全提示**：`.env` / `.env.local` 包含真实密钥，**不要提交到仓库**；
  若在分享/上传中泄露过，请到 Turso 控制台重新生成 Token

## 📁 项目结构

```
├── app/
│   ├── api/              # API 路由
│   │   ├── auth/         # NextAuth 认证
│   │   ├── register/     # 注册接口
│   │   ├── game/         # 游戏状态/分数/排行榜接口
│   │   └── quiz/         # 答题接口
│   ├── login/            # 登录页
│   ├── register/         # 注册页
│   ├── leaderboard/      # 排行榜页
│   ├── layout.tsx        # 根布局
│   └── page.tsx          # 首页/游戏页
├── components/
│   ├── SnakeGame.tsx     # 贪吃蛇游戏组件
│   └── QuizModal.tsx     # 答题弹窗组件
├── lib/
│   ├── db/               # 数据库配置与初始化
│   ├── auth.ts           # NextAuth 配置
│   ├── game.ts           # 游戏业务逻辑
│   └── quiz.ts           # 题库和答题逻辑
└── package.json
```

## 🎮 游戏规则

1. 每天前 **4次** 免费游玩，无需任何限制
2. 第 5 次游玩前需完成 **5道贪吃蛇知识题**，答对 **3题** 解锁当日畅玩
3. 使用 **方向键** 或 **WASD** 控制蛇的移动；手机上滑动或使用屏幕按钮
4. 吃到红色食物得 **10分**，分数越高移动越快
5. 空格 / P 暂停，撞墙或撞到自己游戏结束，吃满棋盘通关
6. 排行榜按最高分排名（并列取先达到者靠前）

## 🛠️ 技术栈

- **框架**: Next.js 14 (App Router)
- **数据库**: Turso (libSQL/SQLite)
- **认证**: NextAuth.js v5
- **样式**: Tailwind CSS
- **部署**: Vercel
- **语言**: TypeScript
