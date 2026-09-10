import type { AuthStage } from './auth-log';

/**
 * 钉钉 OAuth2 适配层。
 *
 * 钉钉（新版 api.dingtalk.com）**不是**标准 OAuth2，有两处不兼容：
 *
 * 1. `/v1.0/oauth2/userAccessToken` 要求 POST **JSON** body
 *    （clientId / clientSecret / code / grantType），
 *    而 Auth.js 内部走 oauth4webapi 的标准流程，发的是
 *    `application/x-www-form-urlencoded` + HTTP Basic 认证 → 钉钉直接报错。
 * 2. 返回体是 `accessToken` / `refreshToken`（驼峰），标准 OAuth2 是
 *    `access_token` / `refresh_token`，需要归一化。
 *
 * ⚠️ 关键坑：`provider.token.request` 在 @auth/core 0.41.x 中 **已完全不再被调用**
 * （源码里零引用，写了也不生效，属于死配置）。官方给出的逃生口是
 * `provider[customFetch]`，内置的 apple / microsoft-entra-id 等 provider
 * 也是用它来适配非标准协议的。
 */

export const DINGTALK_TOKEN_ENDPOINT =
  'https://api.dingtalk.com/v1.0/oauth2/userAccessToken';

export const DINGTALK_USERINFO_ENDPOINT =
  'https://api.dingtalk.com/v1.0/contact/users/me';

/** 钉钉换 token 接口的返回体 */
export interface DingtalkTokenResponse {
  accessToken?: string;
  refreshToken?: string;
  expireIn?: number;
  code?: string;
  message?: string;
}

/** 错误上报回调（由调用方注入，避免本模块依赖数据库） */
export type DingtalkErrorReporter = (
  stage: AuthStage,
  detail: string,
  meta?: Record<string, unknown>
) => void | Promise<void>;

/** 读取响应体文本（钉钉报错时可能返回非 JSON），截断避免日志过长 */
export async function readBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return '<无法读取响应体>';
  }
}

/** 从 fetch 的第一个参数中取出请求 URL */
function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/** 从 form-urlencoded 请求体中取出 code 参数 */
function extractCode(body: BodyInit | null | undefined): string | null {
  try {
    if (typeof body === 'string') return new URLSearchParams(body).get('code');
    if (body instanceof URLSearchParams) return body.get('code');
  } catch {
    /* 解析失败按「没拿到 code」处理 */
  }
  return null;
}

/**
 * 构造钉钉专用的 fetch，注入到 provider 的 `[customFetch]` 上。
 *
 * 只改写「换 token」这一个请求，其它请求（如 userinfo）原样放行。
 */
export function createDingtalkFetch(options: {
  clientId?: string;
  clientSecret?: string;
  onError: DingtalkErrorReporter;
}): (...args: Parameters<typeof fetch>) => Promise<Response> {
  const { clientId, clientSecret, onError } = options;

  /**
   * 把钉钉侧的错误落库，并返回一个标准 OAuth2 错误响应。
   *
   * Auth.js 只会把「白名单内」的错误类型透传到前端，其余一律掩码成
   * `error=Configuration`（见 @auth/core/index.js 的 isClientError 逻辑），
   * 所以真实原因必须由我们自己记录，否则页面上永远只有一句
   * 「服务端配置有误」，无从排查。
   */
  const fail = async (
    error: string,
    description: string,
    status = 400
  ): Promise<Response> => {
    await onError('token_exchange', description, { status });
    return Response.json(
      { error, error_description: description },
      { status, headers: { 'Cache-Control': 'no-store' } }
    );
  };

  return async function dingtalkFetch(
    ...args: Parameters<typeof fetch>
  ): Promise<Response> {
    const [input, init] = args;

    if (!resolveRequestUrl(input).startsWith(DINGTALK_TOKEN_ENDPOINT)) {
      return fetch(...args);
    }

    const code = extractCode(init?.body);
    if (!code) {
      return fail('invalid_request', '钉钉回调参数中未解析到 authorization code');
    }

    let res: Response;
    try {
      res = await fetch(DINGTALK_TOKEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId,
          clientSecret,
          code,
          grantType: 'authorization_code',
        }),
      });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return fail('server_error', `请求钉钉 token 接口网络异常：${detail}`);
    }

    const text = await readBody(res);

    if (!res.ok) {
      return fail(
        'invalid_grant',
        `钉钉 token 接口返回 HTTP ${res.status}：${text}`,
        res.status
      );
    }

    let data: DingtalkTokenResponse;
    try {
      data = JSON.parse(text) as DingtalkTokenResponse;
    } catch {
      return fail('invalid_response', `钉钉 token 接口返回非 JSON：${text}`);
    }

    if (!data.accessToken) {
      return fail('invalid_response', `钉钉未返回 accessToken：${text}`);
    }

    // 归一化为标准 OAuth2 token 响应，交给 Auth.js 继续走后续流程
    return Response.json(
      {
        access_token: data.accessToken,
        refresh_token: data.refreshToken,
        token_type: 'Bearer',
        expires_in: typeof data.expireIn === 'number' ? data.expireIn : 7200,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  };
}

/**
 * 把 Auth.js 抛出的错误（含 cause 链）压成一行可读文本。
 * CallbackRouteError / OAuthCallbackError 这类内部错误本身不带细节，
 * 真正有用的信息藏在 cause 里。
 */
export function describeAuthError(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;

  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === 'string') {
      parts.push(current);
      break;
    }
    const e = current as {
      type?: string;
      name?: string;
      message?: string;
      code?: string;
      status?: number;
      cause?: unknown;
    };
    const label = e.type ?? e.name ?? 'Error';
    const detail = [
      e.message,
      e.code ? `code=${e.code}` : null,
      e.status ? `status=${e.status}` : null,
    ]
      .filter(Boolean)
      .join(' ');
    parts.push(depth === 0 ? `${label}: ${detail}` : `↳ ${label}: ${detail}`);
    current = e.cause;
  }

  return parts.join(' ｜ ') || String(error);
}
