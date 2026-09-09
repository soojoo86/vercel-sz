import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getRandomQuestions } from '@/lib/quiz';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const questions = getRandomQuestions(5);
    // 不返回正确答案给前端
    const safeQuestions = questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
    }));

    return NextResponse.json({ questions: safeQuestions });
  } catch (error) {
    console.error('获取题目错误:', error);
    return NextResponse.json(
      { error: '获取题目失败' },
      { status: 500 }
    );
  }
}
