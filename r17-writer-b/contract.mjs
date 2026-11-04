// Pure R17 Writer five-file *preflight only* contract. No operational writes.
import {createHash} from 'node:crypto';

export const REPO = 'ansqhd5774-Choi/zgmini-pc-control';
export const OWNER = 'ansqhd5774-Choi';
export const BASE = 'a23c12cc8dd3238fa59adb417a4fdd5fce1bd57e';
export const PATCH_HASH = '728a4887bd4c81c52b01f1a8f5de6b506dd009a37d68b1d9269cd7c19ec7c706';
export const OLD = Object.freeze([
  'scripts/pc-writer/local-cycle.mjs',
  'scripts/pc-writer/run-local.mjs',
]);
export const ADDED = Object.freeze([
  'scripts/pc-writer/us-breadth-provisional-cycle.mjs',
  'scripts/pc-writer/us-breadth-provisional-publication.mjs',
  'lib/market-breadth/us-provisional-r1.mjs',
]);
export const FIVE = Object.freeze([...OLD, ...ADDED]);
export const OLD_HASHES = Object.freeze({
  'scripts/pc-writer/local-cycle.mjs':'9c3fc7788907a2f8756b7ff82c372124a2e26253557b7db8a93eb6c8428eadee',
  'scripts/pc-writer/run-local.mjs':'4370f6f725b0a9ce3d093d3c94e766624f24e8a02896afb79b063d21a9747502',
});
const SHA40=/^[0-9a-f]{40}$/;
const SHA64=/^[0-9a-f]{64}$/;
const UUID='[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const ID=new RegExp(`^pc-r17-${UUID}$`);
const CHAT=new RegExp(`^chat-${UUID}$`);
const record=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const keys=(o,allowed)=>record(o)&&Object.keys(o).length===allowed.length&&allowed.every(k=>Object.hasOwn(o,k));
const sameSet=(actual,expected)=>Array.isArray(actual)&&actual.length===expected.length&&actual.every(x=>expected.includes(x))&&new Set(actual).size===expected.length;
export const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function stop(code){throw Object.assign(new Error(code),{code});}

export function validateEvent(event,env){
  if(env?.GITHUB_REPOSITORY!==REPO||env?.GITHUB_ACTOR!==OWNER||
    env?.GITHUB_EVENT_NAME!=='issues'||env?.GITHUB_EVENT_ACTION!=='opened'||
    !SHA40.test(env?.R17_CONTROL_SHA??'')||
    !/^zgmini-pc-0[1-6]$/.test(env?.RUNNER_NAME??'')||
    !/^\d{1,18}$/.test(env?.GITHUB_RUN_ID??'')||env?.GITHUB_RUN_ATTEMPT!=='1')
    stop('R17_B_EVENT_CONTEXT_STOP');
  if(event?.action!=='opened'||event?.repository?.private!==true||
    event?.repository?.full_name!==REPO||event?.sender?.login!==OWNER||
    event?.issue?.user?.login!==OWNER||event?.issue?.title!=='pc-r17-writer-fivefile-preflight'||
    event?.issue?.pull_request||!Number.isSafeInteger(event?.issue?.number)||event.issue.number<1||
    !event.issue.labels?.some(x=>x?.name==='pc-r17-writer-b-preflight'))
    stop('R17_B_ISSUE_AUTHORIZATION_STOP');
  const body=event.issue.body;
  if(typeof body!=='string'||Buffer.byteLength(body)>4096)stop('R17_B_REQUEST_SIZE_STOP');
  let x;try{x=JSON.parse(body)}catch{stop('R17_B_REQUEST_JSON_STOP')}
  if(!keys(x,['schema','requestId','chatId','operation','controlRepository','candidateSourceSha','approvalManifestSha256'])||
    x.schema!=='ZGMINI_R17_WRITER_B_PREFLIGHT_REQUEST_V1'||!ID.test(x.requestId)||
    !CHAT.test(x.chatId)||x.operation!=='r17-writer-fivefile-preflight-only'||
    x.controlRepository!==REPO||!SHA40.test(x.candidateSourceSha)||
    !SHA64.test(x.approvalManifestSha256))stop('R17_B_REQUEST_SCHEMA_STOP');
  return x;
}

export function validateManifest(raw,request){
  if(!Buffer.isBuffer(raw)||raw.length<200||raw.length>16_384||
     digest(raw)!==request.approvalManifestSha256)stop('R17_B_APPROVAL_BYTES_STOP');
  let m;try{m=JSON.parse(raw.toString('utf8'))}catch{stop('R17_B_APPROVAL_JSON_STOP')}
  if(!record(m)||m.schema!=='ZGMINI_R17_WRITER_B_PREFLIGHT_APPROVAL_V1'||
    m.status!=='APPROVED_B_PREFLIGHT_ONLY'||m.scope!=='R17_WRITER_5FILE_PREFLIGHT_ONLY'||
    m.installedHeadSha!==BASE||m.approvedConfigSourceSha!==BASE||
    m.candidateSourceSha!==request.candidateSourceSha||m.patchSha256!==PATCH_HASH||
    !SHA64.test(m.coreTaskXmlSha256??'')||
    !sameSet(m.existingFiles,OLD)||!sameSet(m.absentFiles,ADDED)||
    !keys(m.beforeSha256,OLD)||!OLD.every(p=>m.beforeSha256[p]===OLD_HASHES[p])||
    !keys(m.newSha256,ADDED)||!ADDED.every(p=>SHA64.test(m.newSha256[p]))||
    m.pcDataRoot!==String.raw`E:\ZGmini\data\pc-writer`||
    typeof m.pcSourceRoot!=='string'||!/^E:\\ZGmini\\projects\\[A-Za-z0-9_.-]+(?:\\[A-Za-z0-9_.-]+)*$/.test(m.pcSourceRoot)||
    m.allowOperationalWrites!==false||m.allowProviderCalls!==false||m.allowD1Writes!==false||
    m.allowConfigChanges!==false||m.allowTaskChanges!==false||m.runCount!==1)
      stop('R17_B_APPROVAL_SCOPE_STOP');
  return m;
}

/** Parse and apply plain unified Git text patches IN MEMORY; reject modes/renames/binary. */
export function applyTwoFilePatch(rawPatch,originals){
  const body=rawPatch.toString('utf8');
  if(body.includes('\r')||body.includes('GIT binary patch')||
    /(?:^|\n)(?:rename from|rename to|new file mode|deleted file mode|old mode|new mode) /.test(body))
    stop('R17_B_PATCH_FORMAT_STOP');
  const sections=body.split(/(?=^diff --git )/m).filter(Boolean);
  const outputs={};
  if(sections.length!==2)stop('R17_B_PATCH_FILESET_STOP');
  for(const section of sections){
    const lines=section.split('\n');
    const head=/^diff --git a\/(\S+) b\/(\S+)$/.exec(lines[0]);
    if(!head||head[1]!==head[2]||!OLD.includes(head[1])||outputs[head[1]])
      stop('R17_B_PATCH_FILESET_STOP');
    const original=originals[head[1]];
    if(typeof original!=='string')stop('R17_B_PATCH_BASE_MISSING_STOP');
    // The approved Windows worktree may be checked out with CRLF. Git's own
    // apply --check handles that checkout convention; validate against LF
    // patch context without altering the source file's original EOL style.
    const hasCRLF=original.includes('\r\n');
    if(hasCRLF&&/(^|[^\r])\n/.test(original))stop('R17_B_PATCH_CONTEXT_STOP');
    const eol=hasCRLF?'\r\n':'\n';
    const source=original.replace(/\r\n/g,'\n').split('\n');
    const output=[];
    let cursor=0;
    let i=lines.findIndex(x=>/^@@ -/.test(x));
    if(i<0||!lines.some(x=>x===`--- a/${head[1]}`)||!lines.some(x=>x===`+++ b/${head[1]}`))
      stop('R17_B_PATCH_HEADER_STOP');
    let declaredDelta=0;
    while(i<lines.length&&/^@@ -/.test(lines[i])){
      const h=/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(lines[i]);
      if(!h)stop('R17_B_PATCH_HUNK_STOP');
      const oldStart=Number(h[1])-1,newStart=Number(h[3])-1;
      if(oldStart<0||oldStart>source.length||newStart!==oldStart+declaredDelta)
        stop('R17_B_PATCH_OFFSET_STOP');
      const before=[],after=[]; i++;
      while(i<lines.length&&!/^@@ -/.test(lines[i])&&!/^diff --git /.test(lines[i])){
        const l=lines[i];
        if(l==='')break;
        const op=l[0],data=l.slice(1);
        if(op===' '||op==='-')before.push(data);
        if(op===' '||op==='+')after.push(data);
        if(!' +-'.includes(op))stop('R17_B_PATCH_LINE_STOP');
        i++;
      }
      if(before.length!==Number(h[2]??1)||after.length!==Number(h[4]??1)||!before.length)
        stop('R17_B_PATCH_HUNK_COUNT_STOP');
      // Git apply --check accepts shifted hunk positions when the entire old
      // context still matches. Require one unique, exact match within a bounded
      // displacement; never accept fuzz, omitted context or wrong base bytes.
      const matchAt=k=>k>=cursor&&k+before.length<=source.length&&
        before.every((line,j)=>source[k+j]===line);
      let found=oldStart;
      if(!matchAt(found)){
        const matches=[];
        for(let k=Math.max(cursor,oldStart-250);k<=Math.min(source.length-before.length,oldStart+250);k++){
          if(matchAt(k))matches.push(k);
          if(matches.length>1)break;
        }
        if(matches.length!==1)stop('R17_B_PATCH_CONTEXT_STOP');
        found=matches[0];
      }
      output.push(...source.slice(cursor,found),...after);
      cursor=found+before.length;
      declaredDelta+=after.length-before.length;
    }
    output.push(...source.slice(cursor));
    outputs[head[1]]=output.join('\n').replace(/\n/g,eol);
  }
  if(!OLD.every(p=>Object.hasOwn(outputs,p)))stop('R17_B_PATCH_FILESET_STOP');
  return outputs;
}

/** The published PR may have unrelated OLD bytes; only the a23 patch determines them. */
export function buildCandidateOverlay({originals,patchBytes,newFiles,newSha256}){
  const old=applyTwoFilePatch(patchBytes,originals);
  const overlay=new Map();
  for(const p of OLD)overlay.set(p,Buffer.from(old[p],'utf8'));
  for(const p of ADDED){
    const b=newFiles[p];
    if(!Buffer.isBuffer(b)||digest(b)!==newSha256[p])stop('R17_B_CANDIDATE_SHA_STOP');
    overlay.set(p,b);
  }
  return {overlay,oldTargetSha256:Object.fromEntries(OLD.map(p=>[p,digest(overlay.get(p))]))};
}
