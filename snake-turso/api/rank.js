import { createClient } from '@libsql/client/web';
export const config = { runtime:'edge' };

export default async function handler(req){
  if(req.method!=='GET') return new Response('',{status:405});
  const turso = createClient({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN})
  const result = await turso.execute({
    sql:"SELECT username,high_score FROM users WHERE high_score>0 ORDER BY high_score DESC LIMIT 10"
  })
  return Response.json({ok:true, list: result.rows})
}