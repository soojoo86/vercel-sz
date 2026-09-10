/**
 * 钉钉换 token 协议适配的回归验证脚本。
 *
 * 用 mock 冒充钉钉 `/v1.0/oauth2/userAccessToken`（只接受 JSON body），
 * 再走一遍 @auth/core 内部使用的 oauth4webapi 流程，验证：
 *   1. 不改写请求时必然失败（这就是 error=Configuration 的根因）
 *   2. 经 createDingtalkFetch 改写后，能通过 Auth.js 自身的响应校验
 *
 * 运行：node_modules/.bin/tsx scripts/verify-dingtalk-token.ts
 */
import * as o from 'oauth4webapi';
import {
  createDingtalkFetch,
  DINGTALK_TOKEN_ENDPOINT,
} from '../lib/dingtalk';

const CLIENT_ID = 'ding-appkey';
const CLIENT_SECRET = 'ding-appsecret';
const REDIRECT_URI = 'https://example.com/api/auth/callback/dingtalk';

let lastRequest: {
  contentType: string;
  body: string;
  auth: string | null;
} | null = null;

// ── mock 钉钉 token 端点：严格只吃 JSON body ──────────────────
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  if (!url.startsWith(DINGTALK_TOKEN_ENDPOINT)) {
    throw new Error(`测试中出现了预期之外的请求：${url}`);
  }

  const headers = new Headers(init?.headers ?? undefined);
  const raw = init?.body;
  const bodyText =
    typeof raw === 'string'
      ? raw
      : raw instanceof URLSearchParams
        ? raw.toString()
        : String(raw);

  lastRequest = {
    contentType: headers.get('content-type') ?? '',
    body: bodyText,
    auth: headers.get('authorization'),
  };

  if (!lastRequest.contentType.includes('application/json')) {
    return Response.json(
      { code: 'invalidParameter', message: 'Content-Type 必须是 application/json' },
      { status: 400 }
    );
  }

  const parsed = JSON.parse(bodyText) as Record<string, string>;
  if (
    parsed.grantType !== 'authorization_code' ||
    !parsed.clientId ||
    !parsed.clientSecret ||
    !parsed.code
  ) {
    return Response.json(
      { code: 'invalidParameter', message: '缺少必要字段' },
      { status: 400 }
    );
  }

  return Response.json(
    { accessToken: 'AT-123', refreshToken: 'RT-456', expireIn: 7200 },
    { status: 200 }
  );
}) as typeof fetch;

const as = {
  issuer: 'https://authjs.dev',
  token_endpoint: DINGTALK_TOKEN_ENDPOINT,
} as o.AuthorizationServer;

const client: o.Client = {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
};

// @auth/core 内部就是这么给请求加客户端认证的（client_secret_basic）
const clientAuth = (
  _as: o.AuthorizationServer,
  _client: o.Client,
  _body: URLSearchParams,
  headers: Headers
) => {
  headers.set(
    'authorization',
    `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')}`
  );
};

const newParams = () =>
  new URLSearchParams({
    code: 'CODE-XYZ',
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
  });

async function main() {
  let failed = false;

  // ── 1. 复现：不做改写（Auth.js 默认行为） ───────────────────
  console.log('\n[1] 复现根因：不做任何改写，直接发标准 OAuth2 请求');
  try {
    const res = await o.authorizationCodeGrantRequest(
      as,
      client,
      clientAuth,
      newParams(),
      REDIRECT_URI,
      'decoy',
      {
        [o.customFetch]: ((...args: unknown[]) => {
          (args[1] as RequestInit & { body: URLSearchParams }).body.delete(
            'code_verifier'
          );
          return fetch(...(args as Parameters<typeof fetch>));
        }) as typeof fetch,
      }
    );
    const tokens = await o.processAuthorizationCodeResponse(as, client, res, {
      requireIdToken: false,
    });
    console.log('    ❌ 竟然成功了（与预期不符）', tokens);
    failed = true;
  } catch (error) {
    const e = error as Error;
    console.log(`    ✅ 按预期失败：${e.name}: ${e.message}`);
    console.log('    实际发出的请求：', {
      'content-type': lastRequest?.contentType,
      authorization: lastRequest?.auth ? 'Basic ***' : null,
      body: lastRequest?.body,
    });
  }

  // ── 2. 验证修复：经 createDingtalkFetch 改写 ────────────────
  console.log('\n[2] 验证修复：经 createDingtalkFetch 改写后再走同一流程');
  try {
    const errors: string[] = [];
    const dingtalkFetch = createDingtalkFetch({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      onError: (stage, detail) => {
        errors.push(`${stage}: ${detail}`);
      },
    });

    const res = await o.authorizationCodeGrantRequest(
      as,
      client,
      clientAuth,
      newParams(),
      REDIRECT_URI,
      'decoy',
      {
        [o.customFetch]: ((...args: unknown[]) => {
          (args[1] as RequestInit & { body: URLSearchParams }).body.delete(
            'code_verifier'
          );
          return dingtalkFetch(...(args as Parameters<typeof fetch>));
        }) as typeof fetch,
      }
    );

    console.log('    改写后实际发出的请求：', {
      'content-type': lastRequest?.contentType,
      body: lastRequest?.body,
    });

    const tokens = await o.processAuthorizationCodeResponse(as, client, res, {
      requireIdToken: false,
    });
    console.log('    ✅ 换 token 成功，Auth.js 校验通过：', {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_type: tokens.token_type,
      expires_in: tokens.expires_in,
    });

    if (tokens.access_token !== 'AT-123') {
      console.log('    ❌ access_token 不符合预期');
      failed = true;
    }
    if (errors.length) {
      console.log('    ❌ 不应有错误上报：', errors);
      failed = true;
    }
  } catch (error) {
    const e = error as Error;
    console.log(`    ❌ 仍然失败：${e.name}: ${e.message}`);
    failed = true;
  }

  // ── 3. 验证钉钉侧报错时能被记录并透出 ───────────────────────
  console.log('\n[3] 验证异常路径：钉钉返回错误时能被记录');
  try {
    const errors: string[] = [];
    const dingtalkFetch = createDingtalkFetch({
      clientId: 'bad',
      clientSecret: 'bad',
      onError: (stage, detail) => {
        errors.push(`${stage}: ${detail}`);
      },
    });
    // 构造一个没有 code 的请求体
    const res = await dingtalkFetch(DINGTALK_TOKEN_ENDPOINT, {
      method: 'POST',
      body: new URLSearchParams({ grant_type: 'authorization_code' }),
    });
    const body = (await res.json()) as { error: string };
    console.log(`    状态码 ${res.status}，错误码 ${body.error}`);
    console.log('    上报内容：', errors);
    if (res.status !== 400 || !errors.length) {
      console.log('    ❌ 异常路径未按预期上报');
      failed = true;
    } else {
      console.log('    ✅ 异常路径已记录，可在 /admin 诊断里看到');
    }
  } catch (error) {
    const e = error as Error;
    console.log(`    ❌ 异常路径本身抛错：${e.message}`);
    failed = true;
  }

  console.log(failed ? '\n=== 验证失败 ===\n' : '\n=== 全部验证通过 ===\n');
  process.exit(failed ? 1 : 0);
}

void main();
