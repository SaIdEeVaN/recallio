import {context,identity,loadSet,save,errorResponse} from '../../../lib/db.mjs';
import {requireThat} from '../../../lib/core.mjs';
import {generate} from '../../../lib/ai.mjs';
export const maxDuration=120;
export async function POST(req){
 try{
 const ctx=context(req),user=await identity(ctx);
 const {id,question,requestId}=await req.json();
 requireThat(typeof question==='string'&&question.trim().length>0&&question.length<=1500,'Ask a question of up to 1,500 characters.');
 requireThat(typeof requestId==='string'&&requestId.length===36,'Invalid request identifier.');
 const row=await loadSet(ctx.db,user,id);requireThat(row.status==='ready','Finish processing the source first.');
 const history=row.content.messages||[];const existing=history.find(x=>x.id===requestId&&x.role==='assistant');
 const encoder=new TextEncoder();
 const stream=new ReadableStream({async start(controller){
 const send=obj=>controller.enqueue(encoder.encode(JSON.stringify(obj)+'\n'));
 try{send({status:'Finding supporting passages…'});
 let message=existing;
 if(!message){const ans=await generate(ctx,'tutor',row.content.chunks,{question,messages:history},req.signal);
 req.signal.throwIfAborted();message={role:'assistant',id:requestId,text:ans.answer,refs:ans.refs,at:new Date().toISOString()};
 const messages=[...history,{role:'user',id:requestId+'-q',text:question.trim()},message];await save(ctx.db,row,{content:{...row.content,messages}});}
 // Only evidence-validated text may leave the server.
 for(const piece of message.text.match(/.{1,70}(?:\s|$)|\S+/gs)||[message.text]){send({text:piece});}
 send({complete:true,message});}
 catch(e){if(!req.signal.aborted)send({error:e.status?e.message:'The reply was interrupted. Please retry.'});}
 finally{controller.close();}
 }});
 return new Response(stream,{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){return errorResponse(e);}
}
