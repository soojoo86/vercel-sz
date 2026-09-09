'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface AdminQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  createdAt?: string;
}

interface FormState {
  id: number | null; // null = 新增
  question: string;
  options: string[];
  correctAnswer: number;
}

const emptyForm: FormState = {
  id: null,
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
};

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const flash = (type: 'ok' | 'error', text: string) => {
    setMessage({ type, text });
    window.setTimeout(() => setMessage(null), 3000);
  };

  const loadQuestions = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/questions');
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setQuestions(data.questions ?? []);
        setAuthed(true);
      } else {
        flash('error', data.error || '获取题目失败');
      }
    } catch {
      flash('error', '网络错误');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setPassword('');
        setAuthed(true);
        loadQuestions();
      } else {
        setLoginError(data.error || '登录失败');
      }
    } catch {
      setLoginError('网络错误，请重试');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthed(false);
    setQuestions([]);
    setForm(emptyForm);
    setShowForm(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.question.trim().length < 2) {
      flash('error', '题干至少 2 个字符');
      return;
    }
    if (form.options.some((o) => !o.trim())) {
      flash('error', '四个选项都不能为空');
      return;
    }

    setSaving(true);
    try {
      const isEdit = form.id !== null;
      const res = await fetch('/api/admin/questions', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(isEdit ? { id: form.id } : {}),
          question: form.question.trim(),
          options: form.options.map((o) => o.trim()),
          correctAnswer: form.correctAnswer,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        flash('ok', data.message || '保存成功');
        setForm(emptyForm);
        setShowForm(false);
        loadQuestions();
      } else if (res.status === 401) {
        setAuthed(false);
      } else {
        flash('error', data.error || '保存失败');
      }
    } catch {
      flash('error', '网络错误，请重试');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('确定删除这道题目吗？')) return;
    try {
      const res = await fetch(`/api/admin/questions?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        flash('ok', data.message || '已删除');
        loadQuestions();
      } else if (res.status === 401) {
        setAuthed(false);
      } else {
        flash('error', data.error || '删除失败');
      }
    } catch {
      flash('error', '网络错误，请重试');
    }
  };

  const startEdit = (q: AdminQuestion) => {
    setForm({
      id: q.id,
      question: q.question,
      options: [...q.options],
      correctAnswer: q.correctAnswer,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (checking) {
    return (
      <div className="text-center py-20">
        <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto"></div>
        <p className="mt-4">加载中...</p>
      </div>
    );
  }

  // 未登录：密码登录
  if (!authed) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <div className="bg-gray-800 rounded-lg p-8 shadow-xl">
          <h1 className="text-2xl font-bold text-center mb-6 text-green-400">
            🔐 题库管理后台
          </h1>
          {loginError && (
            <div className="bg-red-500/20 border border-red-500 text-red-300 p-3 rounded mb-4">
              {loginError}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">管理员密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="w-full bg-green-600 hover:bg-green-700 py-2 rounded font-medium transition"
            >
              登录
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 已登录：题库管理
  return (
    <div className="py-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">🔐 题库管理（信息安全）</h1>
        <div className="flex gap-2">
          <Link
            href="/"
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition"
          >
            返回游戏
          </Link>
          <button
            onClick={handleLogout}
            className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-sm transition"
          >
            退出管理
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-3 rounded mb-4 border ${
            message.type === 'ok'
              ? 'bg-green-500/20 border-green-500 text-green-300'
              : 'bg-red-500/20 border-red-500 text-red-300'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 新增/编辑表单 */}
      {showForm ? (
        <form
          onSubmit={handleSave}
          className="bg-gray-800 rounded-lg p-6 mb-6 space-y-4"
        >
          <h2 className="font-bold text-lg">
            {form.id === null ? '➕ 新增题目' : `✏️ 编辑题目 #${form.id}`}
          </h2>

          <div>
            <label className="block text-sm font-medium mb-2">题干</label>
            <textarea
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              rows={2}
              placeholder="例：以下哪种行为容易导致账号被盗？"
              required
            />
          </div>

          {form.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-3">
              <label className="flex items-center gap-2 shrink-0 cursor-pointer">
                <input
                  type="radio"
                  name="correct"
                  checked={form.correctAnswer === i}
                  onChange={() => setForm({ ...form, correctAnswer: i })}
                  className="accent-green-500"
                />
                <span className="text-xs text-gray-400">正确</span>
              </label>
              <input
                type="text"
                value={opt}
                onChange={(e) => {
                  const options = [...form.options];
                  options[i] = e.target.value;
                  setForm({ ...form, options });
                }}
                className="flex-1 px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                placeholder={`选项 ${String.fromCharCode(65 + i)}`}
                required
              />
            </div>
          ))}
          <p className="text-xs text-gray-500">
            单选左侧圆点标记正确答案（默认为选项 A）
          </p>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm);
                setShowForm(false);
              }}
              className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded font-medium transition"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 py-2 rounded font-medium transition"
            >
              {saving ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => {
            setForm(emptyForm);
            setShowForm(true);
          }}
          className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded text-sm font-medium transition mb-6"
        >
          ➕ 新增题目
        </button>
      )}

      {/* 题目列表 */}
      {questions.length === 0 ? (
        <div className="bg-gray-800/50 rounded-lg p-8 text-center text-gray-400">
          <p className="mb-2">暂无自定义题目</p>
          <p className="text-sm">
            当前用户答题将使用内置的信息安全题库；添加自定义题后优先使用自定义题。
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <div key={q.id} className="bg-gray-800 rounded-lg p-5">
              <div className="flex justify-between items-start gap-3">
                <p className="font-medium flex-1">{q.question}</p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(q)}
                    className="bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded text-xs transition"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => handleDelete(q.id)}
                    className="bg-red-600/80 hover:bg-red-600 px-3 py-1 rounded text-xs transition"
                  >
                    删除
                  </button>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-gray-300">
                {q.options.map((opt, i) => (
                  <li
                    key={i}
                    className={i === q.correctAnswer ? 'text-green-400' : ''}
                  >
                    {String.fromCharCode(65 + i)}. {opt}
                    {i === q.correctAnswer && ' ✓'}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500 mt-6 text-center">
        共 {questions.length} 道自定义题目；每次答题随机抽取 3 题，全部答对方可解锁游戏机会
      </p>
    </div>
  );
}
