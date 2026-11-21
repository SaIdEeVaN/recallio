import {createClient} from '@supabase/supabase-js';
import {createHmac} from 'node:crypto';
import {Problem,requireThat} from './core.mjs';
export const url=process.env.NEXT_PUBLIC_SUPABASE_URL, publishable=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export function context(req){
 const token=req.headers.get('authorization')||'';
 const secret=process.env.RECALLIO_SERVER_KEY;
 requireThat(url&&publishable&&secret,'Account services are temporarily unavailable.',503);
 const db=createClient(url,publishable,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{'x-recallio-server':secret,...(token?{Authorization:token}:{})}}});
 const ip=req.headers.get('x-vercel-forwarded-for')?.split(',')[0]||req.headers.get('x-real-ip')||'local';
 return {db,token,ip:createHmac('sha256',secret).update(ip).digest('hex')};
}
export async function identity(ctx){
 const {data,error}=await ctx.db.auth.getUser(ctx.token.replace(/^Bearer /i,''));
 requireThat(!error&&data.user,'Sign in to use your private workspace.',401);return data.user;
}
export async function reserve(ctx,kind){const {error}=await ctx.db.rpc('recallio_reserve',{kind,fingerprint:ctx.ip});if(error)throw new Problem(error.message.includes('quota')?'Daily limit reached. Quotas reset at 00:00 UTC.':'Usage checks are temporarily unavailable.',error.message.includes('quota')?429:503);}
export async function loadSet(db,user,id){const {data,error}=await db.from('study_sets').select('*').eq('id',id).eq('user_id',user.id).maybeSingle();if(error)throw new Problem('Could not load the study set.',503);requireThat(data,'Study set unavailable.',404);return data;}
export async function save(db,row,patch){
 const {data,error}=await db.from('study_sets').update({...patch,revision:row.revision+1,updated_at:new Date().toISOString()}).eq('user_id',row.user_id).eq('id',row.id).eq('revision',row.revision).select().maybeSingle();
 requireThat(!error,'Could not save changes.',503);requireThat(data,'Your set changed in another session. Reopen it and retry.',409);return data;
}
export function errorResponse(err){return Response.json({error:err instanceof Problem?err.message:'The request could not be completed. Please try again.'},{status:err.status||500,headers:{'Cache-Control':'no-store'}})}
