import { createClient } from '@libsql/client/web';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

export const config = { runtime:'edge' };
export default async function handler(req){
  if(req.method!=='GET') return new Response('',{status:405});
  const cookies = parse(req.headers.get('cookie')||'');
  const token = cookies.snake_token;
  if(!token) return Response.json({ok:false,msg:"未登录"},{status:401});
  try{
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const turso = createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN})
    const row = await turso.execute({sql:"SELECT id,username,high_score FROM users WHERE id=?",args:[payload.uid]});
    if(row.rows.length===0) return Response.json({ok:false},{status:401});
    return Response.json({ok:true, user:row.rows[0]})
  }catch(e){
    return Response.json({ok:false,msg:"token失效"},{status:401})
  }
}