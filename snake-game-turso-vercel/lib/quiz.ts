export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number; // 索引
}

// 贪吃蛇相关知识题库
export const quizQuestions: QuizQuestion[] = [
  {
    id: 1,
    question: '经典贪吃蛇游戏中，蛇吃到什么会变长？',
    options: ['石头', '食物/果实', '水', '空气'],
    correctAnswer: 1,
  },
  {
    id: 2,
    question: '贪吃蛇撞到什么会导致游戏结束？',
    options: ['食物', '自己的身体或墙壁', '云朵', '地面'],
    correctAnswer: 1,
  },
  {
    id: 3,
    question: '贪吃蛇游戏的主要目标是什么？',
    options: ['尽可能短', '吃食物获得高分', '找到出口', '躲避所有东西'],
    correctAnswer: 1,
  },
  {
    id: 4,
    question: '蛇移动时，新食物会出现在什么位置？',
    options: ['固定位置', '蛇的头部', '随机空位置', '屏幕中央'],
    correctAnswer: 2,
  },
  {
    id: 5,
    question: '随着分数提高，贪吃蛇游戏通常会有什么变化？',
    options: ['蛇变短', '速度加快', '食物变小', '屏幕变大'],
    correctAnswer: 1,
  },
  {
    id: 6,
    question: '最早的贪吃蛇游戏诞生于哪个年代？',
    options: ['1950年代', '1970年代', '1990年代', '2010年代'],
    correctAnswer: 1,
  },
  {
    id: 7,
    question: '在诺基亚手机上经典的贪吃蛇游戏叫什么？',
    options: ['Snake', 'Worm', 'Python', 'Serpent'],
    correctAnswer: 0,
  },
  {
    id: 8,
    question: '贪吃蛇游戏中，蛇的长度增加意味着什么？',
    options: ['游戏更简单', '难度增加', '分数降低', '速度变慢'],
    correctAnswer: 1,
  },
  {
    id: 9,
    question: '控制贪吃蛇通常使用什么按键？',
    options: ['鼠标点击', '方向键或WASD', '数字键', '空格键'],
    correctAnswer: 1,
  },
  {
    id: 10,
    question: '贪吃蛇游戏属于哪种类型？',
    options: ['射击游戏', '益智/街机游戏', '角色扮演', '模拟经营'],
    correctAnswer: 1,
  },
];

// 随机获取5道题目
export function getRandomQuestions(count: number = 5): QuizQuestion[] {
  const shuffled = [...quizQuestions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
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
