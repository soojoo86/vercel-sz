/** @type {import('vercel').EdgeFunctionConfig} */
export const config = {
  runtime: 'vercel-edge@1'
};

import { createClient } from '@libsql/client/web';
import bcrypt from 'bcryptjs';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return Response.json({ ok: false, msg: "只允许POST请求" }, { status:405 });
  }

  try {
    const payload = await req.json();
    const { username, password } = payload;

    if(!username || !password) {
      return Response.json({ok:false,msg:"账号密码不能为空"},{status:400});
    }

    const turso = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN
    });

    // 测试数据库连通性
    await turso.execute("SELECT 1");

    const exist = await turso.execute({sql:"SELECT id FROM users WHERE username = ?", args:[username]});
    if(exist.rows.length>0) {
      return Response.json({ok:false,msg:"用户名已存在"});
    }

    const hash = bcrypt.hashSync(password, 10);
    await turso.execute({
      sql:"INSERT INTO users(username,password_hash,high_score) VALUES(?,?,0)",
      args:[username,hash]
    })
    return Response.json({ok:true,msg:"注册完成"});

  } catch(err) {
    console.error("register后端异常:", err);
    // 将后端异常message透传给前端页面展示
    return Response.json({
      ok:false,
      msg:`后端服务异常: ${err.message}`
    }, { status:500 });
  }
}
