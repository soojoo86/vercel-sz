/* 验证每日 5 次上限 */
const BASE = 'http://localhost:3213';
const json = async (res) => ({ status: res.status, body: await res.json().catch(() => null) });

async function main() {
  let res = await fetch(`${BASE}/api/auth/csrf`);
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

  // 当前已玩 3 次，答题 → 玩第4、5 次 → 第6次应被拒
  for (let round = 4; round <= 6; round++) {
    // 答题（用 admin 答案）
    let r = await json(await fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin112233sz' }),
    }));
    const adminCookie = r.body && (await 0, null) || null; // 忽略，下面重新拿
    const loginRes = await fetch(`${BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'admin112233sz' }),
    });
    const ac = loginRes.headers.getSetCookie()[0].split(';')[0];
    const qRes = await fetch(`${BASE}/api/quiz/questions`, { headers: { Cookie: cookie() } });
    const quiz = (await qRes.json()).questions;
    const listRes = await fetch(`${BASE}/api/admin/questions`, { headers: { Cookie: ac } });
    const dbQ = (await listRes.json()).questions;
    const answerMap = new Map(dbQ.map((q) => [`db-${q.id}`, q.correctAnswer]));
    const answers = quiz.map((q) => answerMap.get(q.id));

    r = await json(await fetch(`${BASE}/api/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ answers, questionIds: quiz.map((q) => q.id) }),
    }));

    r = await json(await fetch(`${BASE}/api/game/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie() },
      body: JSON.stringify({ score: round * 10 }),
    }));
    console.log(`第 ${round} 次提交:`, r.status, r.body.error || r.body.message);

    r = await json(await fetch(`${BASE}/api/game/status`, { headers: { Cookie: cookie() } }));
    console.log(`  状态: ${r.body.reason} 已玩${r.body.playCount}次 credits=${r.body.credits}`);
  }
}

main().catch((e) => {
  console.error('失败:', e);
  process.exit(1);
});
