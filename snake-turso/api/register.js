import { createClient } from '@libsql/client/web';
import bcrypt from 'bcryptjs';

//export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status:405 });
  const { username, password } = await req.json();
  if(!username || !password) return Response.json({ok:false,msg:"账号密码不能为空"},{status:400});

  const turso = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });

  const exist = await turso.execute({sql:"SELECT id FROM users WHERE username = ?", args:[username]});
  if(exist.rows.length>0) return Response.json({ok:false,msg:"用户名已存在"});

  const hash = bcrypt.hashSync(password, 10);
  await turso.execute({
    sql:"INSERT INTO users(username,password_hash,high_score) VALUES(?,?,0)",
    args:[username,hash]
  })
  return Response.json({ok:true,msg:"注册成功，请登录"});
}