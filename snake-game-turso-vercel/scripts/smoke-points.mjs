/* 冒烟：注册开关 → 注册 → 登录 → 积分结算(首局/答题/第二局) → 排行榜 → 答题积分上限 */
const BASE = 'http://localhost:3214';
const EMAIL = 'smoke-test@example.com';
const PASSWORD = 'test123456';

const json = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });
const getCookie = (res) => res.headers.getSetCookie()[0].split(';')[0];

async function main() {
  // ---- 1. 注册开关：默认开放
  let r = await json(await fetch(`${BASE}/api/settings/registration`));
  console.log('1.注册开关(默认):', r.body.enabled);
  if (r.body.enabled !== true) throw new Error('注册开关默认应为 true');

  // ---- admin 登录
  let res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin112233sz' }),
  });
  const adminCookie = getCookie(res);
  console.log('admin登录:', res.status);

  // ---- 2. 关闭注册 → 注册应 403
  r = await json(await fetch(`${BASE}/api/admin/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ registrationEnabled: false }),
  }));
  console.log('2.关闭注册:', r.body.registrationEnabled);
  r = await json(await fetch(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'blocked-user@example.com', password: 'test123456', name: 'Blocked' }),
  }));
  console.log('  关闭后注册:', r.status, r.body.error);
  if (r.status !== 403) throw new Error('关闭注册后应返回 403');

  // ---- 3. 重新开启 → 注册成功
  await fetch(`${BASE}/api/admin/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
    body: JSON.stringify({ registrationEnabled: true }),
  });
  r = await json(await fetch(`${BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: '冒烟测试员' }),
  }));
  console.log('3.开启后注册:', r.status, r.body.message || r.body.error);
  if (r.status !== 201 && !/已注册/.test(r.body.error || '')) {
    // 201=新注册；若上一轮残留用户则也放行
    if (r.status !== 201) throw new Error('注册失败: ' + JSON.stringify(r.body));
  }

  // ---- 用户登录
  res = await fetch(`${BASE}/api/auth/csrf`);
  const csrf = (await res.json()).csrfToken;
  const jar = [getCookie(res)];
  const cookie = () => [...new Set(jar)].join('; ');
  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie() },
    body: new URLSearchParams({ csrfToken: csrf, email: EMAIL, password: PASSWORD }),
    redirect: 'manual',
  });
  for (const c of res.headers.getSetCookie()) jar.push(c.split(';')[0]);
  console.log('用户登录:', res.status);

  // ---- 4. 首局积分：120 分 → 120(基础) +10(首局) +5(连续第1天) +50(破纪录) = 185
  r = await json(await fetch(`${BASE}/api/game/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie() },
    body: JSON.stringify({ score: 120 }),
  }));
  console.log('4.首局积分:', r.body.pointsEarned, JSON.stringify(r.body.pointsBreakdown));
  if (r.body.pointsEarned !== 185) throw new Error('首局积分应为 185');

  // ---- 状态：累计积分 / 连续天数 / 排名
  r = await json(await fetch(`${BASE}/api/game/status`, { headers: { Cookie: cookie() } }));
  console.log('5.状态: totalPoints=', r.body.totalPoints, 'streak=', r.body.streak, 'rank=', r.body.rank);
  if (r.body.totalPoints !== 185 || r.body.streak !== 1) throw new Error('积分/连续天数不正确');

  // ---- 6. 排行榜：应包含该用户及积分
  r = await json(await fetch(`${BASE}/api/game/leaderboard`, { headers: { Cookie: cookie() } }));
  const me = r.body.entries.find((e) => e.name === '冒烟测试员' || e.totalPoints === 185);
  console.log('6.排行榜: 共', r.body.entries.length, '名玩家; 我: myRank=', r.body.myRank, 'myPoints=', r.body.myPoints, '条目=', me && `${me.rank}/${me.name}/${me.totalPoints}分`);
  if (!me || me.totalPoints !== 185) throw new Error('排行榜未正确显示积分');

  // ---- 7. 补充自定义题并答题全对 → +5 积分 + 1 次机会
  res = await fetch(`${BASE}/api/admin/questions`, { headers: { Cookie: adminCookie } });
  const existing = (await res.json()).questions || [];
  const addedIds = [];
  for (const [q, correct] of [
    ['下列哪项属于强密码？', 0],
    ['电脑中毒后第一步应该？', 1],
  ]) {
    if (existing.some((e) => e.question === q)) continue;
    const add = await json(await fetch(`${BASE}/api/admin/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({
        question: q,
        options: correct === 0
          ? ['F!9k#2mQz@Lp', '12345678', 'abcdef', '111111']
          : ['继续下载更多软件', '断网并使用杀毒软件查杀', '重启就好', '不管它'],
        correctAnswer: correct,
      }),
    }));
    console.log('  补充题目:', add.body.message);
  }

  res = await fetch(`${BASE}/api/quiz/questions`, { headers: { Cookie: cookie() } });
  const quiz = (await res.json()).questions;
  res = await fetch(`${BASE}/api/admin/questions`, { headers: { Cookie: adminCookie } });
  const dbQuestions = (await res.json()).questions;
  const answerMap = new Map(dbQuestions.map((q) => [`db-${q.id}`, q.correctAnswer]));
  // builtin 题答案从源码解析
  const src = await (await import('node:fs/promises')).readFile('lib/quiz.ts', 'utf8');
  for (const m of src.matchAll(/id: '(builtin-\d+)'[\s\S]*?correctAnswer: (\d+)/g)) {
    answerMap.set(m[1], Number(m[2]));
  }
  const correct = quiz.map((q) => answerMap.get(q.id));
  r = await json(await fetch(`${BASE}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie() },
    body: JSON.stringify({ answers: correct, questionIds: quiz.map((q) => q.id) }),
  }));
  console.log('7.答题全对:', r.body.passed, r.body.message);

  // ---- 8. 第二局（消耗机会）：50 分 → 50(基础，无首局/连续/破纪录加成)
  r = await json(await fetch(`${BASE}/api/game/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie() },
    body: JSON.stringify({ score: 50 }),
  }));
  console.log('8.第二局积分:', r.body.pointsEarned, JSON.stringify(r.body.pointsBreakdown));
  if (r.body.pointsEarned !== 50) throw new Error('第二局积分应为 50');

  // ---- 9. 答题积分每日上限 15：再全对 3 次（已得 5，应 +5 +5 +0）
  let quizPoints = 5;
  for (let i = 0; i < 3; i++) {
    res = await fetch(`${BASE}/api/quiz/questions`, { headers: { Cookie: cookie() } });
    const qs = (await res.json()).questions;
    const ans = qs.map((q) => answerMap.get(q.id));
    r = await json(await fetch(`${BASE}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ answers: ans, questionIds: qs.map((q) => q.id) }),
    }));
    console.log(`9.第${i + 2}次全对: passed=${r.body.passed}`);
  }
  r = await json(await fetch(`${BASE}/api/game/status`, { headers: { Cookie: cookie() } }));
  // 总分 = 185(首局) + 50(第二局) + 15(答题每日上限: 5+5+5+0) = 250
  console.log('9.最终状态: totalPoints=', r.body.totalPoints, '(期望 250) credits=', r.body.credits);
  if (r.body.totalPoints !== 250) throw new Error('最终积分应为 250，实际 ' + r.body.totalPoints);

  // ---- 10. 排行榜终态
  r = await json(await fetch(`${BASE}/api/game/leaderboard`, { headers: { Cookie: cookie() } }));
  console.log('10.排行榜Top3:', r.body.entries.slice(0, 3).map((e) => `${e.rank}.${e.name}:${e.totalPoints}分`).join('  '));

  console.log('\n✅ 全部冒烟测试通过');
}

main().catch((e) => {
  console.error('冒烟测试失败:', e.message);
  process.exit(1);
});
