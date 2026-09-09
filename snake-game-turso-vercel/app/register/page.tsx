'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  // null = 检查中；true = 开放；false = 已关闭
  const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/settings/registration')
      .then((res) => res.json())
      .then((data) => setRegistrationOpen(data.enabled !== false))
      .catch(() => setRegistrationOpen(true));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess('注册成功！正在跳转登录...');
        setTimeout(() => router.push('/login'), 1500);
      } else {
        setError(data.error || '注册失败');
      }
    } catch (err) {
      setError('注册失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (registrationOpen === null) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-400">加载中...</p>
      </div>
    );
  }

  if (!registrationOpen) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-gray-800 rounded-lg p-8 shadow-xl text-center">
          <h1 className="text-2xl font-bold mb-4 text-yellow-400">🚫 注册已关闭</h1>
          <p className="text-gray-400">
            当前注册通道已关闭，暂时无法注册新账号。
          </p>
          <p className="text-gray-500 text-sm mt-2">
            如需开通账号，请联系管理员。
          </p>
          <Link
            href="/login"
            className="inline-block mt-6 bg-gray-700 hover:bg-gray-600 px-6 py-2 rounded font-medium transition"
          >
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-20">
      <div className="bg-gray-800 rounded-lg p-8 shadow-xl">
        <h1 className="text-2xl font-bold text-center mb-6 text-green-400">注册</h1>
        
        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-500/20 border border-green-500 text-green-300 p-3 rounded mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">昵称（选填）</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
            />
          </div>
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
            <label className="block text-sm font-medium mb-2">密码（至少6位）</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              minLength={6}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-2 rounded font-medium transition"
          >
            {loading ? '注册中...' : '注册'}
          </button>
        </form>

        <p className="text-center mt-4 text-gray-400">
          已有账号？{' '}
          <Link href="/login" className="text-green-400 hover:underline">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  );
}
