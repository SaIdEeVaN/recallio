import {requireThat,material,Problem} from './core.mjs';
export async function extract(bytes,format){
 requireThat(bytes.length>0&&bytes.length<=5242880,'Files must be between 1 byte and 5 MB.');
 if(format==='TXT'){
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new Problem('Please save this TXT file using UTF-8.')}
 requireThat(!/[\u0000-\u0008\u000e-\u001f]/u.test(text)&&!text.startsWith('%PDF-'),'This file is not plain text.');return material([text]);
 }
 requireThat(Buffer.from(bytes.subarray(0,5)).toString()==='%PDF-','The file signature does not match a PDF.');
 const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const task=pdfjs.getDocument({data:Uint8Array.from(bytes),isEvalSupported:false,useSystemFonts:false,disableFontFace:true,stopAtErrors:true});
 const timeout=setTimeout(()=>{void task.destroy()},20000);
 try{const pdf=await task.promise;requireThat(pdf.numPages<=100,'PDF exceeds 100 pages.');
 const pages=[];let length=0;
 for(let i=1;i<=pdf.numPages;i++){const p=await pdf.getPage(i);const t=await p.getTextContent();const text=t.items.map(x=>('str' in x?x.str+(x.hasEOL?'\n':' '):'')).join('');length+=text.length;requireThat(length<=100000,'Extracted text exceeds 100,000 characters.');pages.push(text);p.cleanup();}
 const result=material(pages);return {...result,chunks:result.chunks.map(c=>({...c,page:c.page??1}))};
 }catch(e){if(e instanceof Problem)throw e;throw new Problem('Could not read this PDF. Remove password protection or paste the text.');}finally{clearTimeout(timeout);await task.destroy().catch(()=>{})}
}
