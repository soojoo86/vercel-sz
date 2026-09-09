import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/admin';
import { getDb } from '@/lib/db';
import { ensureSchema } from '@/lib/db/schema';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const questionSchema = z.object({
  question: z.string().trim().min(2, '题干至少2个字符'),
  options: z.array(z.string().trim().min(1, '选项不能为空')).length(4, '必须提供4个选项'),
  correctAnswer: z.number().int().min(0).max(3),
});

// 获取全部自定义题目（含正确答案）
export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    await ensureSchema();
    const db = getDb();
    const result = await db.execute(
      'SELECT id, question, option_a, option_b, option_c, option_d, correct_index, created_at FROM quiz_questions ORDER BY id DESC'
    );

    const questions = result.rows.map((row) => ({
      id: row.id as number,
      question: row.question as string,
      options: [
        row.option_a as string,
        row.option_b as string,
        row.option_c as string,
        row.option_d as string,
      ],
      correctAnswer: Number(row.correct_index),
      createdAt: row.created_at as string,
    }));

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('获取题目列表错误:', error);
    return NextResponse.json({ error: '获取题目失败' }, { status: 500 });
  }
}

// 新增题目
export async function POST(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const validated = questionSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { question, options, correctAnswer } = validated.data;
    await ensureSchema();
    const db = getDb();

    await db.execute({
      sql: `INSERT INTO quiz_questions (question, option_a, option_b, option_c, option_d, correct_index)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [question, options[0], options[1], options[2], options[3], correctAnswer],
    });

    return NextResponse.json({ success: true, message: '题目已添加' });
  } catch (error) {
    console.error('新增题目错误:', error);
    return NextResponse.json({ error: '新增失败，请重试' }, { status: 500 });
  }
}

// 修改题目
export async function PUT(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const updateSchema = questionSchema.extend({ id: z.number().int().positive() });
    const validated = updateSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { id, question, options, correctAnswer } = validated.data;
    const db = getDb();

    const result = await db.execute({
      sql: `UPDATE quiz_questions
            SET question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_index = ?
            WHERE id = ?`,
      args: [question, options[0], options[1], options[2], options[3], correctAnswer, id],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '题目已更新' });
  } catch (error) {
    console.error('更新题目错误:', error);
    return NextResponse.json({ error: '更新失败，请重试' }, { status: 500 });
  }
}

// 删除题目
export async function DELETE(request: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: '未授权' }, { status: 401 });
  }

  try {
    const id = Number(new URL(request.url).searchParams.get('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: '题目 ID 无效' }, { status: 400 });
    }

    const db = getDb();
    const result = await db.execute({
      sql: 'DELETE FROM quiz_questions WHERE id = ?',
      args: [id],
    });

    if (result.rowsAffected === 0) {
      return NextResponse.json({ error: '题目不存在' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: '题目已删除' });
  } catch (error) {
    console.error('删除题目错误:', error);
    return NextResponse.json({ error: '删除失败，请重试' }, { status: 500 });
  }
}
