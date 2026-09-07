import { createClient } from '@libsql/client/web';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';

//export const config = { runtime:'edge' };
export default async function handler(req){
  if(req.method!=='POST') return new Response('',{status:405});
  const cookies = parse(req.headers.get('cookie')||'');
  const token = cookies.snake_token;
  if(!token) return Response.json({ok:false,msg:"请登录"},{status:401});
  const {score} = await req.json();
  try{
    const payload = jwt.verify(token,process.env.JWT_SECRET);
    const turso = createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN})
    const userRes = await turso.execute({sql:"SELECT high_score FROM users WHERE id=?",args:[payload.uid]});
    const old = userRes.rows[0].high_score;
    if(score>old){
      await turso.execute({sql:"UPDATE users SET high_score=? WHERE id=?",args:[score, payload.uid]})
    }
    return Response.json({ok:true, newHigh: Math.max(score,old)})
  }catch(e){
    return Response.json({ok:false},{status:401})
  }
}