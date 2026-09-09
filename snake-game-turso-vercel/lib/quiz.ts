import { getDb } from './db';
import { ensureSchema } from './db/schema';

export interface QuizQuestion {
  id: string; // 统一字符串 id：内置题 builtin-<n>，自定义题 db-<n>
  question: string;
  options: string[];
  correctAnswer: number; // 索引 0-3
}

// 内置信息安全主题题库（admin 可通过 /admin 追加自定义题）
export const builtinQuizQuestions: QuizQuestion[] = [
  {
    id: 'builtin-1',
    question: '以下哪个密码的安全性最高？',
    options: ['123456789', 'zhangsan1990', 'Gt7#pQ2$mVx9', 'password'],
    correctAnswer: 2,
  },
  {
    id: 'builtin-2',
    question: '收到一封"银行"发来的邮件，要求点击链接验证账户信息，最稳妥的做法是？',
    options: [
      '立即点击链接并输入密码',
      '不点击链接，通过银行官方渠道核实',
      '把邮件转发给朋友帮忙判断',
      '回复邮件询问真假',
    ],
    correctAnswer: 1,
  },
  {
    id: 'builtin-3',
    question: '网址前缀 HTTPS 中的 "S" 代表什么含义？',
    options: [
      '网站速度更快（Speed）',
      '传输内容经过加密（Secure）',
      '网站经过安全认证无任何风险',
      '仅代表服务器在欧洲',
    ],
    correctAnswer: 1,
  },
  {
    id: 'builtin-4',
    question: '攻击者通过电话冒充 IT 支持，诱导员工透露密码，这类攻击属于？',
    options: ['DDoS 攻击', 'SQL 注入', '社会工程学攻击', '蠕虫病毒'],
    correctAnswer: 2,
  },
  {
    id: 'builtin-5',
    question: '双因素认证（2FA）指的是？',
    options: [
      '输入两次相同的密码',
      '密码 + 另一种验证方式（如手机验证码）',
      '两个不同的账号同时登录',
      '设置两个密码备选',
    ],
    correctAnswer: 1,
  },
  {
    id: 'builtin-6',
    question: '防范 SQL 注入最有效的做法是？',
    options: [
      '把密码设置得更复杂',
      '使用参数化查询 / 预编译语句',
      '关闭数据库日志',
      '定期重启服务器',
    ],
    correctAnswer: 1,
  },
  {
    id: 'builtin-7',
    question: 'XSS（跨站脚本攻击）的主要危害是？',
    options: [
      '占满服务器硬盘空间',
      '在受害者浏览器中执行恶意脚本（如窃取 Cookie）',
      '让网页加载速度变慢',
      '修改操作系统的注册表',
    ],
    correctAnswer: 1,
  },
  {
    id: 'builtin-8',
    question: '连接公共免费 WiFi 时，以下哪种行为风险最高？',
    options: [
      '浏览新闻资讯',
      '在未使用加密通道的情况下登录网银账号',
      '查看天气',
      '观看在线视频',
    ],
    correctAnswer: 1,
  },
  {
    id: 'builtin-9',
    question: '勒索软件（Ransomware）的典型行为是？',
    options: [
      '偷偷加速电脑风扇',
      '加密用户文件并索要赎金',
      '篡改浏览器主页',
      '删除回收站文件',
    ],
    correctAnswer: 1,
  },
  {
    id: 'builtin-10',
    question: '"3-2-1 备份原则"指的是？',
    options: [
      '每天备份 3 次、保留 2 天、1 人负责',
      '3 份数据副本、2 种不同介质、1 份异地存放',
      '3 块硬盘、2 个分区、1 个密码',
      '3 个账号、2 层验证、1 台服务器',
    ],
    correctAnswer: 1,
  },
  {
    id: 'builtin-11',
    question: '关于个人敏感信息保护，以下做法正确的是？',
    options: [
      '在社交平台晒出含身份证号的火车票',
      '快递单丢弃前撕毁或涂抹个人信息',
      '用生日作为所有网站的密码方便记忆',
      '把密码写在便签贴在显示器上',
    ],
    correctAnswer: 1,
  },
  {
    id: 'builtin-12',
    question: '软件为什么建议及时更新到最新版本？',
    options: [
      '新版界面更好看',
      '新版本通常会修复已发现的安全漏洞',
      '旧版本无法继续使用',
      '更新可以增加磁盘空间',
    ],
    correctAnswer: 1,
  },
];

/** 从数据库读取 admin 自定义题目 */
async function getCustomQuestions(): Promise<QuizQuestion[]> {
  try {
    await ensureSchema();
    const db = getDb();
    const result = await db.execute(
      'SELECT id, question, option_a, option_b, option_c, option_d, correct_index FROM quiz_questions'
    );
    return result.rows.map((row) => ({
      id: `db-${row.id}`,
      question: row.question as string,
      options: [
        row.option_a as string,
        row.option_b as string,
        row.option_c as string,
        row.option_d as string,
      ],
      correctAnswer: Number(row.correct_index),
    }));
  } catch (error) {
    console.error('读取自定义题目失败，回退到内置题库:', error);
    return [];
  }
}

/** 随机获取 n 道题：优先使用 admin 自定义题，不足时用内置信息安全题补齐 */
export async function getRandomQuestions(count: number = 3): Promise<QuizQuestion[]> {
  const custom = await getCustomQuestions();

  const shuffle = <T>(arr: T[]): T[] =>
    [...arr].sort(() => Math.random() - 0.5);

  const picked = shuffle(custom).slice(0, count);

  if (picked.length < count) {
    const pickedIds = new Set(picked.map((q) => q.id));
    const builtinPool = shuffle(
      builtinQuizQuestions.filter((q) => !pickedIds.has(q.id))
    );
    picked.push(...builtinPool.slice(0, count - picked.length));
  }

  return picked;
}

/** 根据统一字符串 id（db-n / builtin-n）查找题目完整信息 */
export async function findQuestionById(id: string): Promise<QuizQuestion | null> {
  if (id.startsWith('db-')) {
    const numericId = Number(id.slice(3));
    if (!Number.isInteger(numericId)) return null;
    try {
      await ensureSchema();
      const db = getDb();
      const result = await db.execute({
        sql: 'SELECT id, question, option_a, option_b, option_c, option_d, correct_index FROM quiz_questions WHERE id = ?',
        args: [numericId],
      });
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: `db-${row.id}`,
        question: row.question as string,
        options: [
          row.option_a as string,
          row.option_b as string,
          row.option_c as string,
          row.option_d as string,
        ],
        correctAnswer: Number(row.correct_index),
      };
    } catch (error) {
      console.error('查询自定义题目失败:', error);
      return null;
    }
  }

  if (id.startsWith('builtin-')) {
    return builtinQuizQuestions.find((q) => q.id === id) ?? null;
  }

  return null;
}

// 检查答案
export function checkAnswers(
  questions: QuizQuestion[],
  answers: number[]
): { correct: number; total: number; results: boolean[] } {
  let correct = 0;
  const results = questions.map((q, i) => {
    const isCorrect = answers[i] === q.correctAnswer;
    if (isCorrect) correct++;
    return isCorrect;
  });
  return { correct, total: questions.length, results };
}
