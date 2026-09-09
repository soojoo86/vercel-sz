import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { quizQuestions, checkAnswers } from '@/lib/quiz';
import { recordQuizAttempt } from '@/lib/game';
import { z } from 'zod';

const submitSchema = z.object({
  answers: z.array(z.number()).length(5),
  questionIds: z.array(z.number()).length(5),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 });
    }

    const body = await request.json();
    const validated = submitSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json({ error: '提交格式错误' }, { status: 400 });
    }

    const { answers, questionIds } = validated.data;
    const userId = session.user.id;

    // 根据ID获取完整题目（含正确答案）
    const questions = questionIds.map(id => 
      quizQuestions.find(q => q.id === id)
    ).filter(Boolean);

    if (questions.length !== 5) {
      return NextResponse.json({ error: '题目数据错误' }, { status: 400 });
    }

    const result = checkAnswers(questions as any, answers);
    const passed = await recordQuizAttempt(userId, result.correct, result.total);

    return NextResponse.json({
      passed,
      correct: result.correct,
      total: result.total,
      results: result.results,
      message: passed ? '恭喜！答题通过，已解锁今日游戏' : '答题未通过，答对3题及以上才能解锁',
    });
  } catch (error) {
    console.error('提交答案错误:', error);
    return NextResponse.json(
      { error: '提交失败，请稍后重试' },
      { status: 500 }
    );
  }
}
