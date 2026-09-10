# 🐍 贪吃蛇游戏 - Turso + Vercel 部署版

基于 Next.js + Turso (libSQL) + NextAuth 构建的贪吃蛇游戏，支持邮箱注册登录、每日游戏次数限制、答题解锁和积分排行榜。

## ✨ 功能特性

1. **邮箱注册登录** - 使用邮箱和密码注册登录，密码安全哈希存储
2. **钉钉扫码登录（可选）** - 配置 `DINGTALK_CLIENT_ID/SECRET` 后玩家可直接用钉钉账号登录
3. **贪吃蛇游戏** - 经典贪吃蛇玩法，Canvas 绘制，方向键/WASD 控制
4. **每日次数限制** - 每天最多可玩 **5 次**，第 1 次免费（按 `Asia/Shanghai` 时区重置）
5. **答题获取机会** - 第 2~5 次：每次需答 **3 道信息安全题**，**全部答对**获得 1 次游戏机会
6. **题库管理后台** - 访问 `/admin`（默认密码 `admin112233sz`，可用 `ADMIN_PASSWORD` 覆盖）自定义增删改题目
7. **积分排行榜** - 按**累计积分**排名，展示全部注册玩家名单，Top 10 为奖励区
8. **积分体系** - 得分即积分，叠加每日首局、连续游玩、破纪录、通关、答题等多重奖励
9. **注册开关** - 管理后台可随时开启/关闭新用户注册通道
10. **Turso 数据库** - 使用边缘 SQLite 数据库，全球低延迟
11. **Vercel 部署** - 一键部署到 Vercel Serverless 平台

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

# 可选：钉钉扫码登录（见下文「钉钉登录接入」）
# DINGTALK_CLIENT_ID=钉钉应用 AppKey
# DINGTALK_CLIENT_SECRET=钉钉应用 AppSecret
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
   - （可选）`DINGTALK_CLIENT_ID` / `DINGTALK_CLIENT_SECRET` —— 启用钉钉扫码登录
   - （`AUTH_URL` 无需填写，Vercel 会自动注入生产域名）
4. 点击 "Deploy"

## 🤖 钉钉登录接入（可选）

玩家可用钉钉账号扫码登录玩游戏，无需再注册邮箱账号。

### 配置步骤

1. 打开钉钉开放平台 <https://open-dev.dingtalk.com>，用管理员钉钉扫码登录
2. 「应用开发」→ 创建**企业内部应用**（应用名如"信息安全贪吃蛇"）
3. 在应用左侧「应用开发」→ **登录与分享** → **回调域名** 中配置：
   - ⚠️ 这里填的是**纯域名**（不带 `https://`、不带路径），例如：
     - 本地开发：`localhost:3000`
     - 生产环境：`your-app.vercel.app`（**不要**写 `https://your-app.vercel.app/api/auth/callback/dingtalk`）
   - 配置后钉钉会用这个域名做前缀校验：
     - ✅ `https://your-app.vercel.app/api/auth/callback/dingtalk` —— 与 `your-app.vercel.app` 匹配
     - ❌ `https://www.your-app.vercel.app/...` —— `www` 子域名不匹配，需单独配
4. （可选）在「安全设置」→「重定向URL」再补一遍完整回调地址作为兜底：
   - `https://<你的域名>/api/auth/callback/dingtalk`
5. 在「凭证与基础信息」页复制 **AppKey / AppSecret**
6. 配置到环境变量（本地 `.env.local` 或 Vercel）：
   ```env
   DINGTALK_CLIENT_ID=你的AppKey
   DINGTALK_CLIENT_SECRET=你的AppSecret
   ```
7. 重启 / 重新部署后，登录页会自动出现「钉钉扫码登录」按钮

### 机制说明

- **首次扫码**自动创建账号（写入 `users` 表，绑定 `dingtalk_union_id`），
  昵称取钉钉昵称，使用随机占位密码，无法撞库登录
- **注册开关联动**：admin 关闭注册后，新钉钉用户无法首次登录，
  已绑定的老用户不受影响
- 钉钉扫码登录要求**玩家本人在你的钉钉组织内**（企业内部应用限制），
  如需组织外玩家参与，需申请发布为「第三方个人应用」或改用网页应用的扫码登录组件

### 常见问题排查

钉钉登录报错时，登录页会显示中文提示；**管理员访问 `/admin` 的「🔍 钉钉登录诊断」区块**，
可以一站式看到：实际回调地址、应填写的回调域名、环境变量是否齐全，
以及最近 20 条登录失败的**具体原因**（换取 token 失败 / 用户信息接口报错 / 落库异常）。

| 现象 | 原因与处理 |
|---|---|
| 钉钉授权页提示 `redirect_uri参数错误` | 钉钉后台「登录与分享 → 回调域名」未配置或填错。必须填**纯域名**（`your-app.vercel.app`），不能带 `https://` 和路径 |
| 扫码后回到站点提示 `Server error / There is a problem with the server configuration` | 这是 NextAuth 的通用兜底文案，真实原因已写入诊断面板。常见：`AUTH_SECRET` 缺失、token 交换失败、`contact/users/me` 权限不足 |
| 提示「当前未开放注册」 | admin 后台关闭了注册通道，新钉钉用户无法首登；已绑定老用户不受影响 |
| 想看到最详细的日志 | Vercel 环境变量加 `AUTH_DEBUG=true` 后重新部署，Functions 日志会输出 OAuth 全流程 |

> 实现说明：NextAuth 默认对 OAuth 启用 PKCE（授权时下发 `code_challenge`），
> 但钉钉 `userAccessToken` 接口不接受 `code_verifier` 参数，会导致换 token 必然失败。
> 因此本项目在钉钉 Provider 上显式设置 `checks: ['state']`，仅保留 state 校验。


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
│   │   ├── quiz/         # 答题接口
│   │   └── admin/        # 题库管理后台接口
│   ├── login/            # 登录页
│   ├── register/         # 注册页
│   ├── leaderboard/      # 排行榜页
│   ├── admin/            # 题库管理页面
│   ├── layout.tsx        # 根布局
│   └── page.tsx          # 首页/游戏页
├── components/
│   ├── SnakeGame.tsx     # 贪吃蛇游戏组件
│   └── QuizModal.tsx     # 答题弹窗组件
├── lib/
│   ├── db/               # 数据库配置、schema 懒加载与初始化
│   ├── auth.ts           # NextAuth 配置
│   ├── admin.ts          # 题库管理后台鉴权
│   ├── game.ts           # 游戏业务逻辑（次数/额度/排行）
│   └── quiz.ts           # 信息安全题库与出题逻辑
└── package.json
```

## 🎮 游戏规则

1. 每天最多可玩 **5 次**，其中**第 1 次免费**
2. 第 2 次起，每次游玩前需答 **3 道信息安全题**，**全部答对**才能获得 1 次游戏机会（机会当日有效）
3. 使用 **方向键** 或 **WASD** 控制蛇的移动；手机上滑动或使用屏幕按钮
4. 吃到红色食物得 **10分**，分数越高移动越快
5. 空格 / P 暂停，撞墙或撞到自己游戏结束，吃满棋盘通关

## 💰 积分规则

| 积分来源 | 分值 | 说明 |
|---|---|---|
| 每局基础分 | = 本局得分 | 玩得越好赚得越多 |
| 每日首局奖励 | +10 | 每天第一局额外赠送 |
| 连续游玩加成 | +5 × 第 N 天 | 连续第 N 天游玩每日额外奖励，最高 +50/天；中断重新计算 |
| 刷新纪录奖励 | +50 | 打破个人历史最高分 |
| 通关奖励 | +200 | 吃满整张棋盘（3990 分） |
| 答题奖励 | +5 | 3 题全部答对（每日上限 15） |

> 🎁 **奖励机制**：积分排行榜 **Top 10** 可获得线下物质奖励，鼓励玩家持续参与。
> 所有积分变动均写入 `point_transactions` 流水表，可追溯。

## 🛠️ 管理后台

- 入口：导航栏「题库管理」或直接访问 `/admin`
- 默认密码：`admin112233sz`（生产环境建议配置 `ADMIN_PASSWORD` 环境变量覆盖）
- 功能：
  - **系统设置**：一键开启/关闭新用户注册通道（关闭后登录页隐藏注册入口、注册接口返回 403）
  - **题库管理**：新增 / 编辑 / 删除自定义题目（4 选 1 单选，标记正确答案）
- 出题规则：优先随机抽取自定义题，不足 3 题时用内置信息安全题库补齐
- 新增的 `quiz_questions`、`daily_credits`、`user_points`、`point_transactions`、`app_settings` 表会在首次访问相关 API 时自动创建，**Vercel 上无需手动跑初始化脚本**

## 🛠️ 技术栈

- **框架**: Next.js 14 (App Router)
- **数据库**: Turso (libSQL/SQLite)
- **认证**: NextAuth.js v5
- **样式**: Tailwind CSS
- **部署**: Vercel
- **语言**: TypeScript
