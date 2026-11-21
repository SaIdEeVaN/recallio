'use client';
import {useState,useRef} from 'react';
import {FileUp,Mail,FileText} from 'lucide-react';
import {supabase,request} from '../lib/client';
import {Modal} from './ui';
export function SignIn({close}){
 const [email,E]=useState(''),[status,S]=useState(''),[busy,B]=useState(false);
 async function submit(e){e.preventDefault();B(true);S('');try{const client=supabase();if(!client)throw new Error('Sign-in is unavailable.');const {error}=await client.auth.signInWithOtp({email:email.trim(),options:{emailRedirectTo:location.origin}});if(error)throw error;S('Check your inbox for your sign-in link. You can close this window.');}catch(e){S(e.message)}finally{B(false)}}
 return <Modal title="Sign in to Recallio" onClose={close}><p>Save your own sources, generate study tools, and return to your progress on any device.</p><form onSubmit={submit}><label>Email address<input autoComplete="email" required type="email" placeholder="you@example.com" value={email} onChange={e=>E(e.target.value)}/></label><button className="primary" disabled={busy}><Mail size={17}/>{busy?'Sending…':'Email me a sign-in link'}</button></form><p className="notice" role="status">{status}</p></Modal>
}
export function Privacy({close}){return <Modal title="Privacy & usage" onClose={close}><div className="prose"><h3>Your study material</h3><p>Supabase stores your original file in a private bucket, along with extracted text, study tools, quiz attempts and tutor history in your account. The sample saves practice in this browser.</p><h3>AI processing</h3><p>Generating a tool or asking the tutor sends relevant excerpts and recent conversation to OpenAI through Vercel AI Gateway. Review generated material against its citations.</p><p><a href="https://vercel.com/docs/ai-gateway" target="_blank" rel="noreferrer">Vercel AI Gateway</a> · <a href="https://platform.openai.com/docs/guides/your-data" target="_blank" rel="noreferrer">OpenAI data handling</a></p><h3>Limits & deletion</h3><p>Each account can make 20 model calls and upload 5 files per UTC day. Long sources and retries can use multiple calls. Delete a set from your library to remove its live original and derived data. If backups exist, copies expire on the hosting provider’s backup schedule. Submit an account deletion request in Account.</p></div></Modal>}
export function NewSet({close,onReady}){
 const [type,T]=useState('paste'),[file,F]=useState(null),[title,N]=useState(''),[text,V]=useState(''),[busy,B]=useState(''),[error,E]=useState('');
 const id=useRef(crypto.randomUUID());
 function changed(){id.current=crypto.randomUUID();E('')}
 async function submit(e){e.preventDefault();E('');B('Preparing source…');try{
 const format=type==='paste'?'Text':file?.name.split('.').pop().toUpperCase();
 if(type==='file'&&(!file||!['TXT','PDF'].includes(format)||file.size>5242880))throw new Error('Choose a PDF or UTF-8 TXT file up to 5 MB.');
 const data=await request('create',{id:id.current,title:title.trim(),format,text:type==='paste'?text:undefined});
 if(data.uploadToken){B('Uploading private file…');const {error}=await supabase().storage.from('study-sources').uploadToSignedUrl(data.path,data.uploadToken,file,{contentType:format==='PDF'?'application/pdf':'text/plain'});if(error)throw error;
 B('Extracting text…');onReady(await request('extract',{id:id.current}));}else onReady(data);
 }catch(e){E(e.message)}finally{B('')}}
 return <Modal title="New study set" onClose={busy?()=>{}:close}><p>Add one source. You’ll preview the extracted text before generating study tools.</p><form onSubmit={submit}><label>Study set title<input required maxLength="160" placeholder="e.g. Week 3 lecture notes" value={title} onChange={e=>{N(e.target.value);changed()}}/></label><div className="seg">{[['paste','Paste notes',FileText],['file','Upload a file',FileUp]].map(([k,t,I])=><button type="button" aria-pressed={k===type} key={k} onClick={()=>{T(k);changed()}}><I size={16}/>{t}</button>)}</div>{type==='paste'?<label>Source text<textarea required rows="8" maxLength="30000" value={text} placeholder="Paste your source material here…" onChange={e=>{V(e.target.value);changed()}}/><small>{text.length.toLocaleString()} / 30,000 characters</small></label>:<label className="upload">Text-based PDF or TXT · Up to 5 MB<input type="file" accept=".pdf,.txt,application/pdf,text/plain" required onChange={e=>{const f=e.target.files[0];F(f);if(!title&&f)N(f.name.replace(/\.[^.]+$/,''));changed()}}/></label>}<small>Private sources are saved to Supabase. Generating study tools sends excerpts to OpenAI via Vercel AI Gateway.</small><button className="primary" disabled={!!busy}>{busy||'Preview source'}</button>{error&&<p className="notice" role="alert">{error}</p>}</form></Modal>
}
