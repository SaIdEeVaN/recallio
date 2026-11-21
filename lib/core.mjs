import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
export class Problem extends Error { constructor(message,status=400){super(message);this.status=status;} }
export function requireThat(condition,message,status=400){if(!condition)throw new Problem(message,status)}
export function material(pages){
 requireThat(pages.length<=100,'This file exceeds the 100-page limit.');
 const normalized=pages.map(s=>s.normalize('NFC').replace(/\r\n?/g,'\n').replace(/[^\S\n]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim());
 const full=normalized.join('\n\n');requireThat(full.length<=100000,'Extracted text exceeds 100,000 characters.');
 requireThat((full.match(/[\p{L}\p{N}]/gu)||[]).length>=30,'Too little readable text. Use a text-based PDF, TXT file, or paste your notes. Scanned PDFs need OCR first.');
 const chunks=[]; let offset=0;
 normalized.forEach((page,p)=>{let start=0;while(start<page.length){let end=Math.min(start+1800,page.length);
 if(end<page.length){const split=page.lastIndexOf(' ',end);if(split>start+1200)end=split;}
 const id='S'+(chunks.length+1);chunks.push({id,title:'Section '+(chunks.length+1),page:pages.length>1?p+1:null,start:offset+start,end:offset+end,text:page.slice(start,end)});if(end===page.length)break;start=end-120;}
 offset+=page.length+2;});
 return {chunks,words:full.split(/\s+/u).length,pages:pages.length,emptyPages:normalized.filter(x=>!x).length,hash:createHash('sha256').update(full).digest('hex')};
}
export function retrieve(chunks,query){
 if(chunks.reduce((n,c)=>n+c.text.length,0)<=14000)return chunks;
 const terms=[...new Set(query.toLowerCase().match(/[\p{L}\d]{3,}/gu)||[])];
 return chunks.map(c=>({c,score:terms.reduce((s,t)=>s+Number(c.text.toLowerCase().includes(t)),0)})).sort((a,b)=>b.score-a.score).slice(0,8).map(x=>x.c);
}
const str=z.string().trim().min(1).max(3500),refs=z.array(z.string()).min(1).max(12);
export const shapes={
 summary:z.object({sections:z.array(z.object({title:str,text:str,refs})).min(1).max(12),terms:z.array(z.object({term:str,definition:str,refs})).max(15)}),
 cards:z.object({cards:z.array(z.object({front:str,back:str,hint:z.string().max(500),refs})).min(5).max(30)}),
 quiz:z.object({questions:z.array(z.object({prompt:str,options:z.array(str).length(4),correct:z.number().int().min(0).max(3),explanation:str,refs})).min(5).max(20)}),
 tutor:z.object({answer:str,supported:z.boolean(),evidence:z.array(z.object({ref:z.string(),quote:str})).max(8)})
};
export function validate(kind,raw,chunks,count){
 const out=shapes[kind].parse(raw),ids=new Map(chunks.map(c=>[c.id,c.text]));
 if(kind==='tutor'){
 if(!out.supported)return {answer:"I couldn't find enough information in this study set to answer that reliably.",refs:[]};
 requireThat(out.evidence.length>0&&out.evidence.every(e=>e.quote.trim().length>=8&&ids.get(e.ref)?.includes(e.quote)),'The cited evidence could not be verified.',422);
 return {answer:out.answer,refs:[...new Set(out.evidence.map(x=>x.ref))]};
 }
 const rows=kind==='summary'?[...out.sections,...out.terms]:out.cards||out.questions;
 requireThat(rows.every(r=>r.refs.every(id=>ids.has(id))),'A citation did not resolve.',422);
 const labels=rows.map(r=>(r.front||r.prompt||r.term||r.title).toLowerCase().trim());requireThat(new Set(labels).size===labels.length,'Duplicate study items.',422);
 if(kind==='summary')return out;
 requireThat(!count||rows.length===count,'Unexpected number of study items.',422);
 if(kind==='quiz')requireThat(rows.every(q=>new Set(q.options.map(o=>o.toLowerCase().trim())).size===4),'Quiz choices must be distinct.',422);
 return rows.map(row=>({...row,id:randomUUID(),...(kind==='cards'?{status:'new'}:{})}));
}
export function publicQuestions(questions){return questions.map(({id,prompt,options})=>({id,prompt,options}))}
export function grade(questions,answers){
 requireThat(answers&&typeof answers==='object'&&!Array.isArray(answers),'Invalid answers.');
 requireThat(Object.entries(answers).every(([id,a])=>questions.some(q=>q.id===id)&&Number.isInteger(a)&&a>=0&&a<=3),'Invalid quiz choice.');
 const results=questions.map(q=>({...q,selected:answers[q.id]??null,right:answers[q.id]===q.correct}));
 const answered=Object.keys(answers).length,correct=results.filter(q=>q.right).length;
 return {id:randomUUID(),at:new Date().toISOString(),correct,answered,total:questions.length,score:answered?Math.round(100*correct/answered):0,results};
}
export function safeSet(row){ const {questions=[],active,...rest}=row.content??{};return {...rest,id:row.id,title:row.title,format:row.format,status:row.status,updated_at:row.updated_at,revision:row.revision,questionsCount:questions.length,active:active?{id:active.id,mode:active.mode,questions:publicQuestions(active.questions),checked:active.checked||{},locked:active.locked||{}}:null};}
