import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inspectPcSourceOrigin} from '../controller/pc-source-origin-readonly.mjs';

const W=path.win32;
const ROOT=String.raw`E:\ZGmini`;
const DATA=W.join(ROOT,'data');
const PROJECTS=W.join(ROOT,'projects');
const SHA_A='a'.repeat(40),SHA_B='b'.repeat(40);
const hash=b=>createHash('sha256').update(b).digest('hex');

class FakeWindowsFS{
 constructor(){
  this.entries=new Map();this.aliases=new Map();this.reads=[];
  this.realpathSync=this.realpathSync.bind(this);
  this.realpathSync.native=this.realpathSync;
  this.dir(ROOT);this.dir(DATA);this.dir(PROJECTS);
 }
 norm(p){return W.normalize(p).toLowerCase();}
 dir(p){
  p=W.normalize(p);const parent=W.dirname(p);
  if(parent!==p&&!this.entries.has(this.norm(parent)))this.dir(parent);
  this.entries.set(this.norm(p),{path:p,kind:'dir'});
 }
 file(p,body=''){
  p=W.normalize(p);this.dir(W.dirname(p));
  this.entries.set(this.norm(p),{path:p,kind:'file',body:Buffer.from(body)});
 }
 alias(from,to){this.aliases.set(this.norm(from),W.normalize(to));}
 realpathSync(p){
  const resolved=this.aliases.get(this.norm(p))??p;
  const entry=this.entries.get(this.norm(resolved));
  if(!entry)throw Error('ENOENT');
  return entry.path;
 }
 existsSync(p){return this.entries.has(this.norm(p));}
 statSync(p){
  const entry=this.entries.get(this.norm(p));if(!entry)throw Error('ENOENT');
  return {size:entry.body?.length??0,isFile:()=>entry.kind==='file',
   isDirectory:()=>entry.kind==='dir'};
 }
 readFileSync(p){
  const entry=this.entries.get(this.norm(p));if(entry?.kind!=='file')throw Error('EISDIR');
  this.reads.push(entry.path);return Buffer.from(entry.body);
 }
 readdirSync(dir){
  if(this.statSync(dir).isDirectory()!==true)throw Error('ENOTDIR');
  return [...this.entries.values()].filter(e=>this.norm(W.dirname(e.path))===this.norm(dir))
   .map(e=>({name:W.basename(e.path),isDirectory:()=>e.kind==='dir',
     isSymbolicLink:()=>this.aliases.has(this.norm(e.path))}));
 }
 }
const fixture=()=>{
 const fsOps=new FakeWindowsFS();
 fsOps.file(W.join(DATA,'pc-writer','config.json'),JSON.stringify({
  source:SHA_A,core:'PRIVATE_DATABASE_ID',providers:{secret:'DO_NOT_LOG'}}));
 const addRepo=(name,sha=SHA_A,{dirty='',d1='D1_MODULE'}={})=>{
  const dir=W.join(PROJECTS,name);
  fsOps.dir(W.join(dir,'.git'));
  fsOps.file(W.join(dir,'scripts','pc-writer','local-cycle.mjs'),'local cycle');
  fsOps.file(W.join(dir,'scripts','pc-writer','d1.mjs'),d1);
  return {dir,sha,dirty};
 };
 const repos=[];
 const git=(cwd,args)=>{
  const repo=repos.find(r=>fsOps.norm(r.dir)===fsOps.norm(cwd));
  if(!repo)throw Error('GIT_NOT_ALLOWLISTED');
  assert.ok([['rev-parse','--absolute-git-dir'],['rev-parse','--verify','HEAD'],
   ['status','--porcelain','--untracked-files=no']].some(a=>JSON.stringify(a)===JSON.stringify(args)));
  if(args[1]==='--absolute-git-dir')return W.join(repo.dir,'.git')+'\n';
  return args[0]==='rev-parse'?repo.sha+'\n':repo.dirty;
 };
 return {fsOps,repos,addRepo,git,inspect:()=>inspectPcSourceOrigin({dataRoot:DATA,fsOps,pathOps:W,git})};
};

test('one matching repo returns digest only, never secrets or Runtime PASS',()=>{
 const f=fixture();f.repos.push(f.addRepo('zgmini',SHA_A));
 const result=f.inspect();
 assert.equal(result.status,'PASS');
 assert.equal(result.code,'PC_SOURCE_ORIGIN_CANDIDATE_INVENTORY');
 assert.equal(result.runtimeSourceVerified,false);
 assert.equal(result.configApprovedSha,SHA_A);
 assert.equal(result.configSourceIsString,true);
 assert.equal(result.configMatchingCandidate,'projects/zgmini');
 assert.equal(result.candidateCount,1);
 assert.equal(result.candidates[0].head,SHA_A);
 assert.equal(result.candidates[0].d1Sha256,hash('D1_MODULE'));
 assert.equal(result.candidates[0].trackedDirty,false);
 assert.equal(result.operationalWrites,0);
 assert.equal(result.d1Writes,0);
 assert.equal(result.providerCalls,0);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_DATABASE_ID|DO_NOT_LOG|D1_MODULE/);
});

test('legacy nesting and dirty state are detected without contents',()=>{
 const f=fixture();f.repos.push(f.addRepo('legacy\\zgmini-old',SHA_A,{dirty:' M scripts/pc-writer/run-local.mjs\n'}));
 const result=f.inspect();
 assert.equal(result.configMatchingCandidate,'projects/legacy/zgmini-old');
 assert.equal(result.candidates[0].trackedDirty,true);
 assert.doesNotMatch(JSON.stringify(result),/run-local\.mjs/);
});

test('multiple matching candidates fail closed',()=>{
 const f=fixture();f.repos.push(f.addRepo('A',SHA_A),f.addRepo('B',SHA_A));
 const result=f.inspect();
 assert.equal(result.configMatchCount,2);
 assert.equal(result.configMatchingCandidate,null);
 assert.equal(result.runtimeSourceVerified,false);
});

test('unmatched HEAD is not promoted to operational source',()=>{
 const f=fixture();f.repos.push(f.addRepo('A',SHA_B));
 const result=f.inspect();
 assert.equal(result.configMatchCount,0);
 assert.equal(result.configMatchingCandidate,null);
 assert.equal(result.candidates[0].configShaMatches,false);
});

test('junction escaping E:\\ZGmini is rejected even when not flagged as symlink',()=>{
 const f=fixture();f.repos.push(f.addRepo('safe',SHA_A));
 const out=String.raw`C:\outside\secret`;
 f.fsOps.dir(out);
 f.fsOps.alias(W.join(PROJECTS,'safe'),out);
 const original=f.fsOps.readdirSync.bind(f.fsOps);
 f.fsOps.readdirSync=dir=>original(dir).map(e=>({...e,isSymbolicLink:()=>false}));
 const result=f.inspect();
 assert.equal(result.candidateCount,0);
 assert.ok(result.outsideRootRejected>0);
 assert.ok(f.fsOps.reads.every(p=>W.relative(ROOT,p).startsWith('..')===false));
});

test('git worktree pointer outside project root is not followed',()=>{
 const f=fixture();const repo=f.addRepo('A',SHA_A);f.repos.push(repo);
 f.fsOps.file(W.join(repo.dir,'.git'),String.raw`gitdir: C:\outside\secret\.git`);
 f.fsOps.dir(String.raw`C:\outside\secret\.git`);
 const result=f.inspect();
 assert.equal(result.candidateCount,0);
 assert.ok(result.outsideRootRejected>0);
 assert.equal(result.configMatchingCandidate,null);
});

test('a malicious Git resolver pointing outside E:\\ZGmini is rejected before status',()=>{
 const f=fixture();f.repos.push(f.addRepo('A',SHA_A));
 let calls=0;
 const git=(cwd,args)=>{
  calls++;
  if(args[1]==='--absolute-git-dir')return String.raw`C:\outside\secret\.git`;
  throw Error('UNEXPECTED_GIT_COMMAND');
 };
 const result=inspectPcSourceOrigin({dataRoot:DATA,fsOps:f.fsOps,pathOps:W,git});
 assert.equal(calls,1);
 assert.equal(result.candidateCount,1);
 assert.equal(result.candidates[0].gitVerified,false);
 assert.equal(result.configMatchingCandidate,null);
});

test('invalid or missing config SHA never selects a candidate',()=>{
 const f=fixture();f.repos.push(f.addRepo('A',SHA_A));
 f.fsOps.file(W.join(DATA,'pc-writer','config.json'),JSON.stringify({source:'not_a_sha',secret:'SECRET'}));
 const result=f.inspect();
 assert.equal(result.configApprovedSha,null);
 assert.equal(result.configMatchCount,0);
 assert.equal(result.configSourceIsString,false);
 assert.doesNotMatch(JSON.stringify(result),/SECRET|not_a_sha/);
});

test('more than 64 unrelated folders do not hide the approved checkout',()=>{
 const f=fixture();f.repos.push(f.addRepo('zgmini-approved',SHA_A));
 for(let i=0;i<65;i++)f.fsOps.dir(W.join(PROJECTS,'empty'+i));
 const result=f.inspect();
 assert.equal(result.inventoryTruncated,false);
 assert.equal(result.candidateCount,1);
 assert.equal(result.configMatchingCandidate,'projects/zgmini-approved');
 assert.equal(result.operationalWrites,0);
});

test('candidate traversal remains bounded and incomplete inventories are not promoted',()=>{
 const f=fixture();f.repos.push(f.addRepo('A',SHA_A));
 for(let i=0;i<150;i++)f.fsOps.dir(W.join(PROJECTS,'empty'+i));
 const result=f.inspect();
 assert.equal(result.inventoryTruncated,true);
 assert.ok(result.candidateCount<=130);
 assert.equal(result.configMatchCount,1);
 assert.equal(result.configMatchingCandidate,null);
 assert.equal(result.runtimeSourceVerified,false);
 assert.equal(result.operationalWrites,0);
});

test('git read failure yields candidate without trusted HEAD',()=>{
 const f=fixture();f.repos.push(f.addRepo('A',SHA_A));
 const result=inspectPcSourceOrigin({dataRoot:DATA,fsOps:f.fsOps,pathOps:W,git:()=>{throw Error('git unavailable')}});
 assert.equal(result.candidateCount,1);
 assert.equal(result.candidates[0].gitVerified,false);
 assert.equal(result.candidates[0].head,null);
 assert.equal(result.configMatchingCandidate,null);
});

test('unexpected dataRoot cannot trigger broad filesystem traversal',()=>{
 const f=fixture();const result=inspectPcSourceOrigin({dataRoot:PROJECTS,fsOps:f.fsOps,pathOps:W,git:f.git});
 assert.equal(result.code,'PC_SOURCE_ORIGIN_DATA_ROOT_UNVERIFIED');
 assert.equal(result.candidateCount,0);
});
