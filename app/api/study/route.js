import {randomUUID} from 'node:crypto';
import {context,identity,loadSet,save,reserve,errorResponse} from '../../../lib/db.mjs';
import {Problem,requireThat,material,safeSet,publicQuestions,grade} from '../../../lib/core.mjs';
import {extract} from '../../../lib/ingest.mjs';
import {generate} from '../../../lib/ai.mjs';
import {sampleQuestions} from '../../../lib/sample-key.mjs';
export const maxDuration=300;
const uid=s=>typeof s==='string'&&/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(s);
const clean=(s,max=160)=>typeof s==='string'&&s.trim().length>0&&s.trim().length<=max;
const empty={summary:null,cards:[],questions:[],attempts:[],messages:[]};
const result=x=>Response.json(x,{headers:{'Cache-Control':'private, no-store'}});
async function remove(db,row){
 if(row.format!=='Text'){const {error}=await db.storage.from('study-sources').remove([pathFor(row)]);requireThat(!error,'Could not remove the original file. Retry deletion.',503);}
 const {error}=await db.from('study_sets').delete().eq('id',row.id).eq('user_id',row.user_id);requireThat(!error,'Deletion failed. Please retry.',503);
}
const pathFor=r=>r.user_id+'/'+r.id+'/source.'+r.format.toLowerCase();
export async function POST(req){
 try{
 const b=await req.json().catch(()=>{throw new Problem('Invalid request.')});const action=b.action;
 if(b.id==='sample'){
 if(action==='start')return result({questions:publicQuestions(sampleQuestions)});
 if(action==='grade'){const items=b.ids?sampleQuestions.filter(q=>b.ids.includes(q.id)):sampleQuestions;requireThat(items.length,'No questions selected.');return result(grade(items,b.answers));}
 throw new Problem('This action needs a private study set.');
 }
 const ctx=context(req),db=ctx.db;
 const user=await identity(ctx);
 if(action==='list'){const {data,error}=await db.from('study_sets').select('id,title,format,status,updated_at,content->cards,content->attempts').eq('user_id',user.id).order('updated_at',{ascending:false});requireThat(!error,'Could not load your library.',503);return result(data.map(({cards,attempts,...r})=>({...r,needsReview:(cards||[]).filter(c=>c.status==='review').length,attempts:(attempts||[]).map(({answered,total,correct,at})=>({answered,total,correct,at}))})));}
 if(action==='requestDeletion'){const {error}=await db.from('account_deletion_requests').upsert({user_id:user.id},{onConflict:'user_id',ignoreDuplicates:true});requireThat(!error,'Could not submit the deletion request.',503);return result({ok:true});}
 requireThat(uid(b.id),'Invalid study set identifier.');
 if(action==='create'){
 requireThat(clean(b.title)&&['PDF','TXT','Text'].includes(b.format),'Choose a title and a supported source.');
 let {data:row,error:readError}=await db.from('study_sets').select('*').eq('id',b.id).eq('user_id',user.id).maybeSingle();requireThat(!readError,'Could not prepare study set.',503);
 if(!row){
 let contents={...empty},status='queued';
 if(b.format==='Text'){requireThat(typeof b.text==='string'&&b.text.length<=30000,'Paste up to 30,000 characters.');contents={...contents,...material([b.text])};status='ready';}
 else{requireThat(process.env.RECALLIO_UPLOAD_ENABLED!=='false','File upload is paused.',503);await reserve(ctx,'upload');}
 const created=await db.from('study_sets').insert({id:b.id,title:b.title.trim(),format:b.format,user_id:user.id,status,content:contents}).select().single();
 requireThat(!created.error,'Could not save this study set. Retry with the same source.',409);row=created.data;
 }
 if(row.format!=='Text'&&row.status!=='ready'){const p=pathFor(row);const {data,error}=await db.storage.from('study-sources').createSignedUploadUrl(p,{upsert:true});requireThat(!error,'Could not prepare your private upload.',503);return result({id:row.id,path:p,uploadToken:data.token});}
 return result(safeSet(row));
 }
 let row=await loadSet(db,user,b.id);let c=row.content;
 if(action==='open')return result(safeSet(row));
 if(action==='delete'){await remove(db,row);return result({ok:true});}
 if(action==='rename'){requireThat(clean(b.title),'Enter a title of up to 160 characters.');return result(safeSet(await save(db,row,{title:b.title.trim()})));}
 if(action==='extract'){
 if(row.status==='ready')return result(safeSet(row));
 row=await save(db,row,{status:'processing'});
 try{const {data,error}=await db.storage.from('study-sources').download(pathFor(row));requireThat(!error&&data,'Original file unavailable. Upload it again.');const m=await extract(new Uint8Array(await data.arrayBuffer()),row.format);return result(safeSet(await save(db,row,{content:{...c,...m},status:'ready'})));}
 catch(err){await save(db,row,{status:'failed'});throw err;}
 }
 requireThat(row.status==='ready','Finish uploading the source first.');
 if(action==='generate'){
 requireThat(['summary','cards','quiz'].includes(b.kind)&&uid(b.requestId),'Invalid generation request.');
 const count=Number(b.count||5);requireThat(Number.isInteger(count)&&count>=5&&count<=(b.kind==='cards'?30:20)&&['short','medium','detailed'].includes(b.length||'medium'),'Choose a supported length and count.');
 const {data:prior}=await db.from('study_jobs').select('status,created_at').eq('user_id',user.id).eq('request_id',b.requestId).eq('set_id',row.id).maybeSingle();
 if(prior?.status==='complete')return result(safeSet(row));
 if(prior?.status==='working'&&Date.now()-Date.parse(prior.created_at)<300000)throw new Problem('Generation is already running.',409);
 const {count:active}=await db.from('study_jobs').select('request_id',{head:true,count:'exact'}).eq('status','working').eq('user_id',user.id).gt('created_at',new Date(Date.now()-300000).toISOString());requireThat(active<2,'Two generations are already running.',429);
 const job={user_id:user.id,set_id:row.id,request_id:b.requestId,kind:b.kind,status:'working',created_at:new Date().toISOString()};
 const query=prior?db.from('study_jobs').update(job).eq('request_id',b.requestId).eq('created_at',prior.created_at).select().single():db.from('study_jobs').insert(job);
 const {error}=await query;requireThat(!error,'This generation is already in progress.',409);
 try{const output=await generate(ctx,b.kind,c.chunks,{count,length:b.length||'medium'},req.signal);
 const field=b.kind==='quiz'?'questions':b.kind;
 const updated={...c,[field]:b.kind==='cards'&&b.append?[...c.cards,...output]:output,coverage:{...c.coverage,[field]:{processed:c.chunks.map(x=>x.id),cited:[...new Set((Array.isArray(output)?output:output.sections).flatMap(x=>x.refs))]}}};
 row=await save(db,row,{content:updated});
 await db.from('study_jobs').update({status:'complete'}).eq('request_id',b.requestId);return result(safeSet(row));}
 catch(err){await db.from('study_jobs').update({status:'failed'}).eq('request_id',b.requestId);throw err;}
 }
 if(action==='card'){
 const card=c.cards.find(q=>q.id===b.item);requireThat(card,'Card unavailable.',404);
 if(b.op==='delete')c.cards=c.cards.filter(q=>q.id!==b.item);
 else if(b.op==='edit'){requireThat(clean(b.front,1000)&&clean(b.back,3500),'Enter a front and back.');Object.assign(card,{front:b.front.trim(),back:b.back.trim()});}
 else{requireThat(['known','review'].includes(b.op),'Unknown card action.');Object.assign(card,{status:b.op,reviewedAt:new Date().toISOString()});}
 }else if(action==='start'){
 let questions=c.questions;if(b.retry){const attempt=c.attempts.find(x=>x.id===b.retry);requireThat(attempt,'Attempt unavailable.');questions=attempt.results.filter(x=>!x.right).map(({selected,right,...q})=>q);}
 requireThat(questions.length,'Generate a quiz or select a missed question.');c.active={id:randomUUID(),mode:b.mode==='immediate'?'immediate':'final',questions,checked:{},locked:{}};
 }else if(action==='check'){
 requireThat(c.active?.id===b.attempt&&c.active.mode==='immediate','Quiz unavailable.',409);const q=c.active.questions.find(x=>x.id===b.item);
 requireThat(q&&c.active.locked[q.id]===undefined,'Answer already checked or unavailable.');grade([q],{[q.id]:b.choice});c.active.locked[q.id]=b.choice;c.active.checked[q.id]={correct:q.correct,explanation:q.explanation,refs:q.refs};
 }else if(action==='grade'){
 const done=c.attempts.find(a=>a.id===b.attempt);if(done)return result(safeSet(row));
 requireThat(c.active?.id===b.attempt,'Quiz changed. Reopen your active attempt.',409);const attempt=grade(c.active.questions,{...b.answers,...c.active.locked});attempt.id=c.active.id;c.attempts=[attempt,...c.attempts];delete c.active;
 }else if(action==='clearChat'){c.messages=[];}
 else if(action==='removeQuestion'){const q=c.questions.find(q=>q.id===b.item);requireThat(q,'Question unavailable.');c.questions=c.questions.filter(x=>x.id!==q.id);}
 else throw new Problem('Unknown workspace action.');
 return result(safeSet(await save(db,row,{content:c})));
 }catch(err){return errorResponse(err);}
}
