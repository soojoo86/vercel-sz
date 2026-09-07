import { createClient } from '@libsql/client/web';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { serialize } from 'cookie';

//export const config = { runtime: 'edge' };

export default async function handler(req) {
  if(req.method!=='POST') return new Response('',{status:405});
  const {username,password}=await req.json();
  const turso = createClient({
    url:process.env.TURSO_DATABASE_URL, authToken:process.env.TURSO_AUTH_TOKEN
  })
  const res = await turso.execute({sql:"SELECT id,username,password_hash,high_score FROM users WHERE username=?",args:[username]});
  if(res.rows.length===0) return Response.json({ok:false,msg:"账号不存在"});
  const user = res.rows[0];
  if(!bcrypt.compareSync(password, user.password_hash)){
    return Response.json({ok:false,msg:"密码错误"})
  }
  const token = jwt.sign({uid:user.id,username:user.username}, process.env.JWT_SECRET, {expiresIn:'7d'});
  const cookie = serialize('snake_token', token, {
    httpOnly:true, secure:true, sameSite:'strict', path:'/', maxAge:60*60*24*7
  })
  return Response.json({ok:true, user:{id:user.id,username:user.username,high_score:user.high_score}},{
    headers:{"Set‑Cookie":cookie}
  })
}