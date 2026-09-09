/* 完整流程冒烟：用户登录 → 状态 → 答题(全对/答错) → 机会消耗 → 上限 */
const BASE = 'http://localhost:3213';

const json = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });

async function main() {
  // ---- admin 登录，补 2 道自定义题（共 3 道，保证出题全部来自 DB，答案可知）
  let res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'admin112233sz' }),
  });
  const adminCookie = res.headers.getSetCookie()[0].split(';')[0];

  for (const [q, correct] of [
    ['下列哪项属于强密码？', 0],
    ['电脑中毒后第一步应该？', 1],
  ]) {
    const options = correct === 0
      ? ['F!9k#2mQz@Lp', '12345678', 'abcdef', '111111']
      : ['继续下载更多软件', '断网并使用杀毒软件查杀', '重启就好', '不管它'];
    res = await fetch(`${BASE}/api/admin/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: adminCookie },
      body: JSON.stringify({ question: q, options, correctAnswer: correct }),
    });
    console.log('新增题:', (await json(res)).body);
  }

  // ---- 用户登录
  res = await fetch(`${BASE}/api/auth/csrf`);
  const csrf = (await res.json()).csrfToken;
  const jar = [res.headers.getSetCookie()[0].split(';')[0]];
  const cookie = () => [...new Set(jar)].join('; ');

  res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie() },
    body: new URLSearchParams({ csrfToken: csrf, email: 'smoke-test@example.com', password: 'test123456' }),
    redirect: 'manual',
  });
  for (const c of res.headers.getSetCookie()) jar.push(c.split(';')[0]);
  console.log('登录:', res.status);

  // ---- 游戏状态（今天已玩 2 次）
  let r = await json(await fetch(`${BASE}/api/game/status`, { headers: { Cookie: cookie() } }));
  console.log('状态(应 quiz_required):', r.body.reason, '已玩', r.body.playCount, '次');

  // ---- 无机会时提交分数（应 403）
  r = await json(await fetch(`${BASE}/api/game/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie() },
    body: JSON.stringify({ score: 70 }),
  }));
  console.log('无机会提交:', r.status, r.body.error);

  // ---- 答题（先故意错）
  res = await fetch(`${BASE}/api/quiz/questions`, { headers: { Cookie: cookie() } });
  const quiz = (await res.json()).questions;
  console.log('题目:', quiz.map((q) => q.id).join(','));
  const wrong = quiz.map(() => 3); // 全选错误答案 D... 答案存 0/1/2，选 3 必错? 兜底用 -1
  r = await json(await fetch(`${BASE}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie() },
    body: JSON.stringify({ answers: wrong, questionIds: quiz.map((q) => q.id) }),
  }));
  console.log('全错提交:', r.body.passed, r.body.message);

  // ---- 用 admin 接口查正确答案，全部答对
  res = await fetch(`${BASE}/api/admin/questions`, { headers: { Cookie: adminCookie } });
  const dbQuestions = (await res.json()).questions;
  const answerMap = new Map(dbQuestions.map((q) => [`db-${q.id}`, q.correctAnswer]));
  const correct = quiz.map((q) => answerMap.get(q.id));
  console.log('标准答案:', correct.join(','));
  r = await json(await fetch(`${BASE}/api/quiz/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie() },
    body: JSON.stringify({ answers: correct, questionIds: quiz.map((q) => q.id) }),
  }));
  console.log('全对提交:', r.body.passed, r.body.message);

  // ---- 状态（应有 1 次机会）
  r = await json(await fetch(`${BASE}/api/game/status`, { headers: { Cookie: cookie() } }));
  console.log('状态(应 unlocked):', r.body.reason, 'credits=', r.body.credits);

  // ---- 用机会玩一局
  r = await json(await fetch(`${BASE}/api/game/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie() },
    body: JSON.stringify({ score: 100 }),
  }));
  console.log('消耗机会玩一局:', r.status, r.body.message);

  // ---- 状态（机会应清零）
  r = await json(await fetch(`${BASE}/api/game/status`, { headers: { Cookie: cookie() } }));
  console.log('状态(应 quiz_required):', r.body.reason, '已玩', r.body.playCount, '次 credits=', r.body.credits);
}

main().catch((e) => {
  console.error('冒烟测试失败:', e);
  process.exit(1);
});
