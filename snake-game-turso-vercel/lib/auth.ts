// console.log("AUTH_SECRET:", process.env.AUTH_SECRET);

import NextAuth, { customFetch } from 'next-auth';
import type { OAuth2Config } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { getDb } from './db';
import { ensureSchema } from './db/schema';
import { isRegistrationEnabled } from './settings';
import { recordAuthFailure } from './auth-log';
import {
  createDingtalkFetch,
  describeAuthError,
  DINGTALK_TOKEN_ENDPOINT,
  DINGTALK_USERINFO_ENDPOINT,
  readBody,
} from './dingtalk';
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

// 钉钉 OAuth2 协议适配（换 token 报文改写、错误描述）统一放在 ./dingtalk.ts

const dingtalkProvider: OAuth2Config<DingtalkProfile> = {
  id: 'dingtalk',
  name: '钉钉',
  type: 'oauth',
  clientId: dingtalkClientId,
  clientSecret: dingtalkClientSecret,
  // ⚠️ 关闭 PKCE，只保留 state 校验。
  // Auth.js 默认对 OAuth 启用 PKCE（授权时下发 code_challenge，换 token 时
  // 要求回传 code_verifier），但钉钉的 userAccessToken 接口只接受
  // clientId / clientSecret / code / refreshToken / grantType，不接受
  // code_verifier，因此必须关掉，否则换 token 一定失败。
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
    url: DINGTALK_TOKEN_ENDPOINT,
  },
  // 钉钉换 token 的报文与标准 OAuth2 不兼容，在 fetch 层改写（详见 lib/dingtalk.ts）
  [customFetch]: createDingtalkFetch({
    clientId: dingtalkClientId,
    clientSecret: dingtalkClientSecret,
    onError: recordAuthFailure,
  }),
  userinfo: {
    url: DINGTALK_USERINFO_ENDPOINT,
    // 钉钉用户信息接口要求专用 header（非标准 Bearer），需自定义请求
    async request({ tokens }: { tokens: { access_token?: string } }) {
      const url = DINGTALK_USERINFO_ENDPOINT;

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
      // Auth.js 会把「非白名单」的内部错误统一掩码成 error=Configuration 再重定向，
      // 前端只能看到「服务端配置有误」这种通用文案。这里把真实错误（含 cause 链）
      // 落库，以便在 /admin 的「钉钉登录诊断」里看到确切原因。
      void recordAuthFailure('unexpected', describeAuthError(error));
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
