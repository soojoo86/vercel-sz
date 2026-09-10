// console.log("AUTH_SECRET:", process.env.AUTH_SECRET);

import NextAuth from 'next-auth';
import type { OAuth2Config, Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getDb } from './db';
import { ensureSchema } from './db/schema';
import { isRegistrationEnabled } from './settings';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('邮箱格式不正确'),
  password: z.string().min(6, '密码至少6位'),
});

// NextAuth v5 优先读取 AUTH_SECRET；兼容旧版 NEXTAUTH_SECRET 命名
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

// ─── 钉钉扫码登录 ────────────────────────────────────────────
// 凭据来自钉钉开放平台（https://open-dev.dingtalk.com）
// 创建「企业内部应用」→ 凭证与基础信息 → AppKey / AppSecret
// 回调地址配置为：https://<你的域名>/api/auth/callback/dingtalk
const dingtalkClientId = process.env.DINGTALK_CLIENT_ID;
const dingtalkClientSecret = process.env.DINGTALK_CLIENT_SECRET;
export const isDingtalkLoginEnabled = Boolean(
  dingtalkClientId && dingtalkClientSecret
);

/** 钉钉扫码后回调返回的用户信息结构 */
interface DingtalkProfile {
  unionId: string;
  openId: string;
  nick?: string;
  avatarUrl?: string;
  email?: string;
}

const dingtalkProvider: OAuth2Config<DingtalkProfile> = {
  id: 'dingtalk',
  name: '钉钉',
  type: 'oauth',
  clientId: dingtalkClientId,
  clientSecret: dingtalkClientSecret,
  authorization: {
    url: 'https://login.dingtalk.com/oauth2/auth',
    params: {
      response_type: 'code',
      scope: 'openid',
      prompt: 'consent',
    },
  },
  token: {
    url: 'https://api.dingtalk.com/v1.0/oauth2/userAccessToken',
    // 钉钉 token 接口要求 JSON body（非标准 OAuth form 编码），需自定义请求
    async request({
      params,
      provider,
    }: {
      params: { code?: string };
      provider: { clientId?: string; clientSecret?: string };
    }) {
      const res = await fetch(
        'https://api.dingtalk.com/v1.0/oauth2/userAccessToken',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientId: provider.clientId as string,
            clientSecret: provider.clientSecret as string,
            code: params.code as string,
            grantType: 'authorization_code',
          }),
        }
      );
      const data = (await res.json()) as {
        accessToken?: string;
        refreshToken?: string;
      };
      if (!res.ok || !data.accessToken) {
        throw new Error(
          `钉钉获取用户授权失败: ${JSON.stringify(data)}`
        );
      }
      return {
        tokens: {
          access_token: data.accessToken,
          refresh_token: data.refreshToken,
        },
      };
    },
  },
  userinfo: {
    url: 'https://api.dingtalk.com/v1.0/contact/users/me',
    // 钉钉用户信息接口要求专用 header（非标准 Bearer），需自定义请求
    async request({ tokens }: { tokens: { access_token?: string } }) {
      const res = await fetch('https://api.dingtalk.com/v1.0/contact/users/me', {
        headers: {
          'x-acs-dingtalk-access-token': String(tokens.access_token),
        },
      });
      if (!res.ok) {
        throw new Error(`钉钉获取用户信息失败: HTTP ${res.status}`);
      }
      return (await res.json()) as DingtalkProfile;
    },
  },
  profile(profile) {
    return {
      id: profile.unionId,
      name: profile.nick || '钉钉用户',
      email: profile.email ?? `${profile.unionId}@dingtalk.noreply.local`,
      image: profile.avatarUrl ?? null,
    };
  },
};

/**
 * 钉钉登录落库：
 * - 已绑定过（unionId 存在）→ 直接返回现有用户
 * - 新钉钉用户 → 视为注册，受「注册开关」控制（关闭时抛错拒绝）
 * - 占位 email / 随机密码哈希，保证不会被撞库登录
 */
async function upsertDingtalkUser(profile: DingtalkProfile): Promise<{
  id: string;
  email: string;
  name: string | null;
}> {
  const db = getDb();
  await ensureSchema();

  const existing = await db.execute({
    sql: 'SELECT id, email, name FROM users WHERE dingtalk_union_id = ?',
    args: [profile.unionId],
  });

  const row = existing.rows[0];
  if (row) {
    // 昵称有变化时更新展示名
    if (profile.nick && profile.nick !== (row.name as string | null)) {
      await db.execute({
        sql: 'UPDATE users SET name = ? WHERE id = ?',
        args: [profile.nick, row.id as string],
      });
      return {
        id: row.id as string,
        email: row.email as string,
        name: profile.nick,
      };
    }
    return {
      id: row.id as string,
      email: row.email as string,
      name: (row.name as string | null) ?? '钉钉用户',
    };
  }

  // 新用户视为注册行为，尊重注册开关
  if (!(await isRegistrationEnabled())) {
    throw new Error('REGISTRATION_DISABLED');
  }

  const id = randomUUID();
  const email = `dingtalk_${profile.unionId}@users.noreply.local`;
  const name = profile.nick || '钉钉用户';
  // 随机占位密码：无法用于邮箱密码登录，杜绝撞库
  const passwordHash = await bcrypt.hash(randomUUID() + randomUUID(), 10);

  await db.execute({
    sql: `INSERT INTO users (id, email, name, password_hash, dingtalk_union_id)
          VALUES (?, ?, ?, ?, ?)`,
    args: [id, email, name, passwordHash, profile.unionId],
  });

  return { id, email, name };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: authSecret,
  // Serverless / Vercel 场景下信任部署平台提供的 Host
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: '邮箱', type: 'email' },
        password: { label: '密码', type: 'password' },
      },
      async authorize(credentials) {
        const validated = loginSchema.safeParse(credentials);
        if (!validated.success) {
          return null;
        }

        const { email, password } = validated.data;
        const db = getDb();

        try {
          const result = await db.execute({
            sql: 'SELECT id, email, name, password_hash FROM users WHERE email = ?',
            args: [email],
          });

          const user = result.rows[0];
          if (!user) {
            return null;
          }

          const passwordMatch = await bcrypt.compare(
            password,
            user.password_hash as string
          );

          if (!passwordMatch) {
            return null;
          }

          return {
            id: user.id as string,
            email: user.email as string,
            name: user.name as string | null,
          };
        } catch (error) {
          console.error('认证错误:', error);
          return null;
        }
      },
    }),
    // 仅在配置了钉钉凭据时启用
    ...(isDingtalkLoginEnabled ? [dingtalkProvider] : []),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user && account?.provider === 'dingtalk') {
        // 钉钉登录：落库（绑定或新建），把内部用户 id 写入 token
        const dingtalkProfile = profile as DingtalkProfile | undefined;
        if (!dingtalkProfile?.unionId) {
          throw new Error('DINGTALK_PROFILE_MISSING');
        }
        const dbUser = await upsertDingtalkUser({
          unionId: dingtalkProfile.unionId,
          openId: dingtalkProfile.openId,
          nick: dingtalkProfile.nick,
          avatarUrl: dingtalkProfile.avatarUrl,
          email: dingtalkProfile.email,
        });
        token.id = dbUser.id;
        token.email = dbUser.email;
        token.name = dbUser.name;
      } else if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
});
