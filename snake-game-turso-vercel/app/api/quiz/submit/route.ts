import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { findQuestionById, checkAnswers, type QuizQuestion } from '@/lib/quiz';
import { recordQuizAttempt, QUIZ_QUESTION_COUNT } from '@/lib/game';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const submitSchema = z.object({
  answers: z.array(z.number()).length(QUIZ_QUESTION_COUNT),
  questionIds: z.array(z.string()).length(QUIZ_QUESTION_COUNT),
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
    const questions: QuizQuestion[] = [];
    for (const id of questionIds) {
      const q = await findQuestionById(id);
      if (!q) {
        return NextResponse.json(
          { error: '题目数据错误，请刷新重试' },
          { status: 400 }
        );
      }
      questions.push(q);
    }

    const result = checkAnswers(questions, answers);
    const passed = await recordQuizAttempt(userId, result.correct, result.total);

    return NextResponse.json({
      passed,
      correct: result.correct,
      total: result.total,
      results: result.results,
      message: passed
        ? '恭喜！3 题全部答对，获得 1 次游戏机会'
        : `未通过：答对 ${result.correct}/${result.total} 题，需全部答对才能获得游戏机会`,
    });
  } catch (error) {
    console.error('提交答案错误:', error);
    return NextResponse.json(
      { error: '提交失败，请稍后重试' },
      { status: 500 }
    );
  }
}
