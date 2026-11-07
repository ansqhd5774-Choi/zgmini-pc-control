// Pure, deterministic insertion overlay for an approved local Writer preimage.
// This module never reads or writes PC files. The caller verifies exact
// before/after SHA-256 and pins the complete insertion list in the manifest.
import {TextDecoder} from 'node:util';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
const keys=(obj,list)=>obj!==null&&typeof obj==='object'&&
 !Array.isArray(obj)&&Object.keys(obj).length===list.length&&
 list.every(k=>Object.hasOwn(obj,k));

export function validateInsertions(insertions){
 need(Array.isArray(insertions)&&insertions.length>=1&&insertions.length<=16,
  'WRITER_B_INSERT_COUNT_STOP');
 let total=0;
 const seen=new Set();
 for(const op of insertions){
  need(keys(op,['anchor','position','text'])&&
   ['before','after'].includes(op.position)&&
   typeof op.anchor==='string'&&op.anchor.length>=8&&op.anchor.length<=500&&
   !/[\r\n\0]/.test(op.anchor)&&
   typeof op.text==='string'&&op.text.length>=2&&op.text.length<=4096&&
   op.text.endsWith('\n')&&!op.text.includes('\r')&&!op.text.includes('\0'),
   'WRITER_B_INSERT_CONTRACT_STOP');
  total+=Buffer.byteLength(op.anchor)+Buffer.byteLength(op.text);
  need(total<=12000,'WRITER_B_INSERT_BYTES_STOP');
  need(!seen.has(op.anchor),'WRITER_B_INSERT_DUPLICATE_ANCHOR_STOP');
  seen.add(op.anchor);
 }
 return insertions;
}

export function applyApprovedInsertions(original,insertions){
 need(Buffer.isBuffer(original)&&original.length>=1&&original.length<=2_000_000,
  'WRITER_B_INSERT_PREIMAGE_BYTES_STOP');
 validateInsertions(insertions);
 let source;
 try{source=new TextDecoder('utf-8',{fatal:true}).decode(original);}
 catch{stop('WRITER_B_INSERT_PREIMAGE_UTF8_STOP');}
 need(!source.includes('\0'),'WRITER_B_INSERT_PREIMAGE_UTF8_STOP');
 const crlf=source.includes('\r\n');
 need(!crlf||!source.replaceAll('\r\n','').includes('\r'),
  'WRITER_B_INSERT_MIXED_NEWLINE_STOP');
 need(crlf||!source.includes('\r'),'WRITER_B_INSERT_MIXED_NEWLINE_STOP');
 const newline=crlf?'\r\n':'\n';
 need(source.endsWith(newline),'WRITER_B_INSERT_PREIMAGE_NEWLINE_STOP');
 const lines=source.split(newline);
 const prepared=[];
 const positions=new Set();
 for(const op of insertions){
  const matches=[];
  for(let i=0;i<lines.length;i++)if(lines[i]===op.anchor)matches.push(i);
  need(matches.length===1,'WRITER_B_INSERT_ANCHOR_MATCH_STOP');
  const index=matches[0];
  need(!positions.has(index),'WRITER_B_INSERT_ANCHOR_OVERLAP_STOP');
  positions.add(index);
  prepared.push({index:index+(op.position==='after'?1:0),
   text:op.text.slice(0,-1).split('\n')});
 }
 // Splice from the bottom so original line offsets never drift.
 prepared.sort((a,b)=>b.index-a.index);
 for(const op of prepared)lines.splice(op.index,0,...op.text);
 const patched=Buffer.from(lines.join(newline),'utf8');
 need(patched.length>original.length&&patched.length<=2_000_000,
  'WRITER_B_INSERT_RESULT_BYTES_STOP');
 return patched;
}
