'use client';

import { useState, useEffect } from 'react';

interface TestResult {
  success: boolean;
  message: string;
  errorCode?: string;
  errorDetails?: string;
  troubleshooting?: string[];
  connectionInfo?: {
    databaseUrl: string;
    hasAuthToken: boolean;
  };
  latency?: string;
  databaseInfo?: {
    sqliteVersion?: string;
    tables?: string[];
  };
}

export default function Home() {
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(true);

  const runTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/test-connection', {
        cache: 'no-store'
      });
      const data = await res.json();
      setResult(data);
    } catch (error) {
      setResult({
        success: false,
        message: '❌ 无法连接到API端点',
        errorCode: 'API_UNREACHABLE',
        errorDetails: error instanceof Error ? error.message : String(error),
        troubleshooting: [
          'Vercel 函数可能尚未部署完成',
          '检查部署日志是否有构建错误',
          '确认函数执行没有超时'
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runTest();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Turso 数据库连接测试</h1>
          <p className="text-slate-600">部署于 Vercel 环境</p>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-600">正在测试数据库连接...</p>
          </div>
        ) : result && (
          <div className="space-y-6">
            {/* 主要结果卡片 */}
            <div className={`rounded-2xl shadow-lg p-8 ${
              result.success ? 'bg-green-50 border-2 border-green-200' : 'bg-red-50 border-2 border-red-200'
            }`}>
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${
                  result.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {result.success ? '✓' : '✕'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{result.message}</h2>
                  {result.latency && (
                    <p className="text-slate-500 text-sm">响应延迟: {result.latency}</p>
                  )}
                </div>
              </div>

              {result.errorCode && (
                <div className="bg-white/70 rounded-lg p-4 mb-4">
                  <p className="text-sm font-semibold text-slate-700 mb-1">错误代码</p>
                  <code className="text-red-600 font-mono">{result.errorCode}</code>
                </div>
              )}

              {result.errorDetails && (
                <div className="bg-white/70 rounded-lg p-4">
                  <p className="text-sm font-semibold text-slate-700 mb-1">详细信息</p>
                  <p className="text-slate-600 font-mono text-sm">{result.errorDetails}</p>
                </div>
              )}

              {result.success && result.databaseInfo && (
                <div className="mt-6 space-y-3">
                  <div className="bg-white/70 rounded-lg p-4">
                    <p className="text-sm font-semibold text-slate-700 mb-1">SQLite 版本</p>
                    <p className="text-slate-600">{result.databaseInfo.sqliteVersion}</p>
                  </div>
                  <div className="bg-white/70 rounded-lg p-4">
                    <p className="text-sm font-semibold text-slate-700 mb-2">数据库表列表</p>
                    <div className="flex flex-wrap gap-2">
                      {result.databaseInfo.tables?.map(table => (
                        <span key={table} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                          {table}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 连接信息 */}
            {result.connectionInfo && (
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-slate-800 mb-4">连接配置信息</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-slate-100">
                    <span className="text-slate-600">数据库地址</span>
                    <code className="text-sm bg-slate-100 px-2 py-1 rounded text-slate-700 max-w-md truncate">
                      {result.connectionInfo.databaseUrl}
                    </code>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-slate-600">认证令牌</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      result.connectionInfo.hasAuthToken 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {result.connectionInfo.hasAuthToken ? '✓ 已配置' : '✕ 未配置'}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* 故障排查建议 */}
            {!result.success && result.troubleshooting && result.troubleshooting.length > 0 && (
              <div className="bg-amber-50 rounded-2xl shadow-lg p-6 border border-amber-200">
                <h3 className="text-lg font-semibold text-amber-800 mb-4 flex items-center gap-2">
                  <span>💡</span> 故障排查建议
                </h3>
                <ul className="space-y-3">
                  {result.troubleshooting.map((tip, index) => (
                    <li key={index} className="flex gap-3 text-amber-900">
                      <span className="flex-shrink-0 w-6 h-6 bg-amber-200 text-amber-800 rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* 重新测试按钮 */}
            <div className="text-center">
              <button
                onClick={runTest}
                disabled={loading}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-xl transition-colors shadow-lg shadow-blue-200"
              >
                {loading ? '测试中...' : '重新测试连接'}
              </button>
            </div>
          </div>
        )}

        {/* 底部说明 */}
        <div className="mt-10 text-center text-sm text-slate-500">
          <p>此工具通过执行 SELECT 查询测试 Turso 数据库连通性</p>
          <p className="mt-1">API 端点: <code className="bg-slate-200 px-2 py-0.5 rounded">/api/test-connection</code></p>
        </div>
      </div>
    </main>
  );
}
