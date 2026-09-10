// console.log("AUTH_SECRET:", process.env.AUTH_SECRET);

import NextAuth from 'next-auth';
import type { OAuth2Config } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getDb } from './db';
import { ensureSchema } from './db/schema';
import { isRegistrationEnabled } from './settings';
import { recordAuthFailure } from './auth-log';
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

/** 读取响应体文本（钉钉报错时可能返回非 JSON），截断避免日志过长 */
async function readBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return '<无法读取响应体>';
  }
}

const dingtalkProvider: OAuth2Config<DingtalkProfile> = {
  id: 'dingtalk',
  name: '钉钉',
  type: 'oauth',
  clientId: dingtalkClientId,
  clientSecret: dingtalkClientSecret,
  // ⚠️ 关键：关闭 PKCE，只保留 state 校验。
  // NextAuth 默认对 OAuth 启用 PKCE（授权时下发 code_challenge，
  // 换 token 时要求回传 code_verifier），但钉钉的 userAccessToken 接口
  // body 仅支持 clientId / clientSecret / code / refreshToken / grantType，
  // 不接受 code_verifier，导致换 token 必然失败（invalid_grant），
  // 最终表现为「There is a problem with the server configuration」。
  checks: ['state'],
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
      const url = 'https://api.dingtalk.com/v1.0/oauth2/userAccessToken';
      const payload = {
        clientId: provider.clientId as string,
        clientSecret: provider.clientSecret as string,
        code: params.code as string,
        grantType: 'authorization_code',
      };

      let res: Response;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        await recordAuthFailure('token_exchange', `请求钉钉 token 接口网络异常: ${detail}`);
        throw error;
      }

      if (!res.ok) {
        const body = await readBody(res);
        await recordAuthFailure(
          'token_exchange',
          `钉钉返回 HTTP ${res.status}：${body}`,
          { status: res.status, body }
        );
        throw new Error(`钉钉获取用户授权失败: HTTP ${res.status} ${body}`);
      }

      const data = (await res.json()) as {
        accessToken?: string;
        refreshToken?: string;
        code?: string;
        message?: string;
      };

      if (!data.accessToken) {
        const body = JSON.stringify(data);
        await recordAuthFailure(
          'token_exchange',
          `钉钉未返回 accessToken：${body}`,
          { body }
        );
        throw new Error(`钉钉获取用户授权失败: ${body}`);
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
      const url = 'https://api.dingtalk.com/v1.0/contact/users/me';

      let res: Response;
      try {
        res = await fetch(url, {
          headers: {
            'x-acs-dingtalk-access-token': String(tokens.access_token),
          },
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        await recordAuthFailure('userinfo', `请求钉钉用户信息接口网络异常: ${detail}`);
        throw error;
      }

      if (!res.ok) {
        const body = await readBody(res);
        await recordAuthFailure(
          'userinfo',
          `钉钉用户信息接口返回 HTTP ${res.status}：${body}`,
          { status: res.status, body }
        );
        throw new Error(`钉钉获取用户信息失败: HTTP ${res.status} ${body}`);
      }

      const profile = (await res.json()) as DingtalkProfile;
      if (!profile.unionId) {
        await recordAuthFailure(
          'profile',
          `钉钉用户信息缺少 unionId：${JSON.stringify(profile).slice(0, 300)}`
        );
        throw new Error('钉钉用户信息缺少 unionId');
      }

      return profile;
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
    await recordAuthFailure(
      'registration_disabled',
      `注册通道已关闭，拒绝新钉钉用户首登（unionId=${profile.unionId}）`
    );
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
  // AUTH_DEBUG=true 时输出 NextAuth 全量调试日志（排查 OAuth 问题用）
  debug: process.env.AUTH_DEBUG === 'true',
  logger: {
    error(error) {
      console.error('[nextauth][error]', error);
    },
    warn(code) {
      console.warn('[nextauth][warn]', code);
    },
    debug(code, metadata) {
      console.log('[nextauth][debug]', code, metadata);
    },
  },
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
    // 登录失败统一回到登录页，页面上会展示可读的中文原因
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user && account?.provider === 'dingtalk') {
        // 钉钉登录：落库（绑定或新建），把内部用户 id 写入 token
        const dingtalkProfile = profile as DingtalkProfile | undefined;
        if (!dingtalkProfile?.unionId) {
          await recordAuthFailure('profile', 'jwt 回调未拿到 unionId');
          throw new Error('DINGTALK_PROFILE_MISSING');
        }
        try {
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
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // 注册关闭是业务预期，不重复记录
          if (message !== 'REGISTRATION_DISABLED') {
            await recordAuthFailure('db_upsert', message, {
              unionId: dingtalkProfile.unionId,
            });
          }
          throw error;
        }
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
