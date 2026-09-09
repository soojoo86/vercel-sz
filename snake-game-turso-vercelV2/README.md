# 🐍 贪吃蛇游戏 - Turso + Vercel 部署版

基于 Next.js + Turso (libSQL) + NextAuth 构建的贪吃蛇游戏，支持邮箱注册登录、每日游戏次数限制、答题解锁和积分排行榜。

## ✨ 功能特性

1. **邮箱注册登录** - 使用邮箱和密码注册登录，密码安全哈希存储
2. **贪吃蛇游戏** - 经典贪吃蛇玩法，Canvas 绘制，方向键/WASD 控制
3. **每日次数限制** - 每天前4次免费游玩
4. **答题解锁机制** - 第5次游玩前需答对5道题中的3道
5. **积分排行榜** - 按历史最高分排名，实时更新
6. **Turso 数据库** - 使用边缘 SQLite 数据库，全球低延迟
7. **Vercel 部署** - 一键部署到 Vercel Serverless 平台

## 🚀 本地开发

### 1. 环境准备

- Node.js 18+ (注意：Vercel 目前主要支持 LTS 版本，Node 26 可能尚未上线生产环境，建议使用 18/20/22)
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

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

编辑 `.env.local` 填入你的配置：

```env
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token
NEXTAUTH_SECRET=生成一个随机字符串，例如 openssl rand -hex 32
NEXTAUTH_URL=http://localhost:3000
```

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

### 1. 推送到 GitHub

将代码推送到你的 GitHub 仓库。

### 2. 在 Vercel 导入项目

1. 访问 https://vercel.com/new
2. 选择你的 GitHub 仓库
3. 在 "Environment Variables" 部分添加以下环境变量：
   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `NEXTAUTH_SECRET`
   - (无需手动设置 `NEXTAUTH_URL`，Vercel 会自动配置)

4. 点击 "Deploy"

### 3. Vercel 部署注意事项

- **Node.js 版本**: 在 `package.json` 的 `engines` 字段中指定 Node.js 版本。Vercel 目前支持 Node.js 18/20/22。如果您本地使用 26.8.1，建议确认 Vercel 是否已支持该版本，或使用 22.x LTS。
- **Serverless 函数**: 本项目使用 App Router 和 API Routes，会自动部署为 Vercel Serverless Functions。
- **数据库连接**: 使用 `@libsql/client` 连接 Turso，支持 HTTP 协议，适配 Serverless 环境。

## 📁 项目结构

```
├── app/
│   ├── api/              # API 路由
│   │   ├── auth/         # NextAuth 认证
│   │   ├── register/     # 注册接口
│   │   ├── game/         # 游戏相关接口
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
│   ├── db/               # 数据库配置
│   ├── auth.ts           # NextAuth 配置
│   ├── game.ts           # 游戏业务逻辑
│   └── quiz.ts           # 题库和答题逻辑
└── package.json
```

## 🎮 游戏规则

1. 每天前 **4次** 免费游玩
2. 第5次游玩前需要完成 **5道贪吃蛇知识题**，答对3题即可解锁当日额外游戏
3. 使用 **方向键** 或 **WASD** 控制蛇的移动
4. 吃到红色食物得 10 分
5. 撞墙或撞到自己身体游戏结束
6. 排行榜按历史最高分排名

## 🛠️ 技术栈

- **框架**: Next.js 14 (App Router)
- **数据库**: Turso (libSQL/SQLite)
- **认证**: NextAuth.js v5
- **样式**: Tailwind CSS
- **部署**: Vercel
- **语言**: TypeScript
