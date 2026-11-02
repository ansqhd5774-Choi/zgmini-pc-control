import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';
export const digest=x=>createHash('sha256').update(x).digest('hex');
export const need=(condition,code)=>{if(!condition)throw Object.assign(new Error(code),{code});};
export function exclusive(root,id){
 const p=path.join(root,id);fs.mkdirSync(root,{recursive:true});
 try{fs.mkdirSync(p);}catch(e){if(e.code==='EEXIST')throw Object.assign(new Error('LEASE_BUSY'),{code:'LEASE_BUSY'});throw e;}
 const nonce=crypto.randomUUID();fs.writeFileSync(path.join(p,'owner.json'),JSON.stringify({pid:process.pid,nonce,at:new Date().toISOString(),bootAt:Date.now()-os.uptime()*1000}),{flag:'wx'});
 return ()=>{const f=path.join(p,'owner.json');need(JSON.parse(fs.readFileSync(f)).nonce===nonce,'LEASE_OWNER_CHANGED');fs.unlinkSync(f);fs.rmdirSync(p);};
}
export function validateRequest(request,policy){
 need(request&&typeof request==='object'&&!Array.isArray(request),'REQUEST_OBJECT');
 const keys=['schema','requestId','chatId','operation','sourceRepository','sourceBranch','sourceSha'];
 need(Object.keys(request).length===keys.length&&keys.every(k=>Object.hasOwn(request,k)),'REQUEST_FIELDS');
 need(request.schema==='ZGMINI_PC_JOB_V1','REQUEST_SCHEMA');
 need(/^[a-z0-9][a-z0-9-]{7,79}$/.test(request.requestId),'REQUEST_ID');
 need(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(request.chatId),'CHAT_ID');
 need(Object.hasOwn(policy.operations,request.operation),'OPERATION_NOT_ALLOWED');
 need(request.sourceRepository===policy.sourceRepository,'SOURCE_REPOSITORY');
 need(typeof request.sourceBranch==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_./-]{0,159}$/.test(request.sourceBranch)&&!request.sourceBranch.includes('..')&&!request.sourceBranch.endsWith('.lock'),'SOURCE_BRANCH');
 need(/^[a-f0-9]{40}$/.test(request.sourceSha),'SOURCE_SHA');return request;
}
export function under(root,relative){const resolved=path.resolve(root,relative);need(resolved.startsWith(path.resolve(root)+path.sep),'PATH_OUTSIDE_JOB');return resolved;}
export function writeJson(file,value){const tmp=file+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});fs.renameSync(tmp,file);}
export function errorCode(error){return /^[A-Z0-9_]{1,100}$/.test(error?.code??'')?error.code:'INTERNAL_EXECUTION_ERROR';}
