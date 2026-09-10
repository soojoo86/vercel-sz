'use client';

import { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// 钉钉登录回调失败时，NextAuth 会带 error 参数重定向回登录页
const errorMessages: Record<string, string> = {
  OAuthSignin: '钉钉登录发起失败，请稍后重试',
  OAuthCallback: '钉钉登录回调失败，请重试',
  OAuthCreateAccount: '钉钉账号关联失败，请联系管理员',
  AccessDenied: '当前未开放注册，暂不接受新用户登录',
  CallbackRouteError: '钉钉登录失败，请重试或联系管理员',
  Configuration: '服务端配置有误（请检查钉钉登录配置）',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const urlError = searchParams.get('error');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    urlError
      ? errorMessages[urlError] || `登录失败（${urlError}）`
      : ''
  );
  const [loading, setLoading] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(true);
  const [dingtalkEnabled, setDingtalkEnabled] = useState(false);
  const [dingtalkLoading, setDingtalkLoading] = useState(false);

  useEffect(() => {
    fetch('/api/settings/registration')
      .then((res) => res.json())
      .then((data) => {
        setRegistrationOpen(data.enabled !== false);
        setDingtalkEnabled(data.dingtalkLoginEnabled === true);
      })
      .catch(() => setRegistrationOpen(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('邮箱或密码错误');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      setError('登录失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleDingtalkLogin = () => {
    setDingtalkLoading(true);
    // 跳转到钉钉扫码授权页，授权后回调创建会话
    signIn('dingtalk', { callbackUrl });
  };

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-gray-800 rounded-lg p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-center mb-6 text-green-400">登录</h1>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-2 rounded font-medium transition"
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </form>

        {dingtalkEnabled && (
          <>
            <div className="flex items-center my-5">
              <div className="flex-1 h-px bg-gray-600"></div>
              <span className="px-3 text-gray-500 text-sm">或</span>
              <div className="flex-1 h-px bg-gray-600"></div>
            </div>
            <button
              onClick={handleDingtalkLogin}
              disabled={dingtalkLoading}
              className="w-full flex items-center justify-center gap-2 bg-[#007FFF] hover:bg-[#0070E0] disabled:bg-gray-600 py-2 rounded font-medium transition"
            >
              {dingtalkLoading ? (
                '正在跳转钉钉...'
              ) : (
                <>
                  {/* 钉钉 logo */}
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" aria-hidden="true">
                    <path d="M21.6 8.4c-.3-1.2-.8-2.3-1.6-3.2-.8-.9-1.8-1.6-3-2.1C15.8 2.6 14.5 2.3 13 2.3c-1.5 0-2.8.3-4 .8-1.2.5-2.2 1.2-3 2.1-.8.9-1.3 2-1.6 3.2-.3 1.2-.3 2.4-.1 3.6.2 1.2.7 2.3 1.4 3.3.7 1 1.6 1.8 2.6 2.4l-.5 2.6c-.1.4.3.7.6.5l2.9-1.6c.6.1 1.2.1 1.7.1 1.5 0 2.8-.3 4-.8 1.2-.5 2.2-1.2 3-2.1.8-.9 1.3-2 1.6-3.2.3-1.2.3-2.4.1-3.6-.2-1.2-.7-2.3-1.4-3.3l.9.1zM11.7 9.6l.7 1.9 2.6-.7-3.4-4.1 1.2 3.4-.4-.5-2.5.6.7-1.9-2.7.7 3.5 4.2-1.2-3.4.5.5 2.6-.7z" />
                  </svg>
                  钉钉扫码登录
                </>
              )}
            </button>
            <p className="text-center mt-2 text-gray-500 text-xs">
              首次使用钉钉登录将自动创建账号
              {!registrationOpen && '（当前未开放新用户注册，老用户可正常登录）'}
            </p>
          </>
        )}

        {registrationOpen ? (
          <p className="text-center mt-4 text-gray-400">
            还没有账号？{' '}
            <Link href="/register" className="text-green-400 hover:underline">
              立即注册
            </Link>
          </p>
        ) : (
          <p className="text-center mt-4 text-gray-500 text-sm">
            当前未开放注册，如需账号请联系管理员
          </p>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center py-20">加载中...</div>}>
      <LoginForm />
    </Suspense>
  );
}
