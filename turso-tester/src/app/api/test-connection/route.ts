import { NextResponse } from 'next/server';
import { testTursoConnection } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await testTursoConnection();
    return NextResponse.json(result, {
      status: result.success ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      message: '❌ 测试过程中发生未知错误',
      errorCode: 'UNEXPECTED_ERROR',
      errorDetails: error instanceof Error ? error.message : String(error),
      troubleshooting: [
        '这可能是代码运行时异常',
        '检查 Vercel 函数日志获取完整错误堆栈',
        '确认依赖包版本兼容性'
      ]
    }, { status: 500 });
  }
}
