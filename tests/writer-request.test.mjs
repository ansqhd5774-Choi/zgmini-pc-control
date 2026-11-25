import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sha256,CONTROL_REPO,ACTOR,ISSUE_TITLE,ISSUE_LABEL,EXTENDED_DRAIN_LABEL,DRAIN_1200_LABEL} from '../writer-b/contract.mjs';
import {submitPreparedWriterIssue as submit,reconcileWriterSubmission as reconcile,main} from '../tools/writer-request.mjs';
const manifestPath='approvals/writer-updates/w05-r304-maintenance-window-20261119.json';
function fixture(mode){
 const m=JSON.parse(readFileSync(new URL('../'+manifestPath,import.meta.url),'utf8'));
 if(mode===null)delete m.coreMaintenance;else if(mode)m.coreMaintenance=mode;
 const bytes=Buffer.from(JSON.stringify(m)),labels=[ISSUE_LABEL];
 if(m.coreMaintenance==='PAUSE_NEW_STARTS_DRAIN_2400S_V1')labels.push(EXTENDED_DRAIN_LABEL);
 if(m.coreMaintenance==='PAUSE_NEW_STARTS_DRAIN_1200S_V1')labels.push(DRAIN_1200_LABEL);
 const q={schema:'ZGMINI_PC_WRITER_SOURCE_B_REQUEST_V1',requestId:'12345678-1234-4234-8234-123456789abc',chatId:'12345678-1234-4234-8234-123456789abd',operation:ISSUE_TITLE,controlRepository:CONTROL_REPO,approvalManifestPath:manifestPath,approvalManifestSha256:sha256(bytes)};
 const e={repository_full_name:CONTROL_REPO,title:ISSUE_TITLE,labels,body:JSON.stringify(q)};
 const actual={number:42,title:e.title,body:e.body,labels:labels.map(name=>({name})),user:{login:ACTOR},state:'open'};
 const f={e,q,actual,bytes,posts:0,saved:null};
 f.p={observedHead:m.baseHead,observedConfigSha:m.baseConfigSourceSha,readIdentity:async()=>({login:ACTOR}),readRepository:async()=>({private:true}),readManifest:async p=>{assert.equal(p,manifestPath);return bytes;},saveReceipt:async(r,{exclusive=false}={})=>{if(exclusive&&f.saved)throw Error('EEXIST');f.saved=structuredClone(r);},createIssue:async x=>{assert.equal(f.saved.phase,'CREATING');assert.deepEqual(x,e);f.posts++;return {number:42}},readIssue:async()=>actual};
 return f;
}
for(const mode of [null,'PAUSE_NEW_STARTS_DRAIN_1200S_V1','PAUSE_NEW_STARTS_DRAIN_2400S_V1'])test('existing approved mode '+mode,async()=>{const f=fixture(mode);assert.equal((await submit(f.e,f.p)).requestId,f.q.requestId);assert.equal(f.saved.expected.body,f.e.body);await assert.rejects(()=>submit(f.e,f.p),/EEXIST/);assert.equal(f.posts,1);});
test('bot and public repository blocked before POST',async()=>{const f=fixture();await assert.rejects(()=>submit(f.e,{...f.p,readIdentity:async()=>({login:'github-actions[bot]'})}),/IDENTITY_DENIED/);await assert.rejects(()=>submit(f.e,{...f.p,readRepository:async()=>({private:false})}),/IDENTITY_DENIED/);assert.equal(f.posts,0);});
test('manifest hash and PC CAS must match',async()=>{const f=fixture();await assert.rejects(()=>submit(f.e,{...f.p,readManifest:async()=>Buffer.from(f.bytes.toString()+' ')}),/MANIFEST_HASH_STOP/);await assert.rejects(()=>submit(f.e,{...f.p,observedHead:'0'.repeat(40)}),/LOCAL_CAS_MISMATCH/);assert.equal(f.posts,0);});
test('missing extended label is rejected by shared contract',async()=>{const f=fixture('PAUSE_NEW_STARTS_DRAIN_2400S_V1');await assert.rejects(()=>submit({...f.e,labels:[ISSUE_LABEL]},f.p),/EXTENDED_DRAIN_LABEL_STOP/);assert.equal(f.posts,0);});
test('uncertain creation never repeats POST; closed original reconciles',async()=>{const f=fixture();f.p.createIssue=async()=>{f.posts++;throw Error('unknown')};assert.equal((await submit(f.e,f.p)).status,'STATE_UNKNOWN');f.actual.state='closed';assert.equal((await reconcile(f.saved,{...f.p,findIssues:async()=>[f.actual]})).issueNumber,42);assert.equal(f.posts,1);});
test('incomplete CLI and candidate wrapper denied',async()=>{const f=fixture();await assert.rejects(()=>submit({...f.e,canPublish:false},f.p),/ENVELOPE_INVALID/);await assert.rejects(()=>main(['submit-prepared','--prepared-file','x']),/USAGE/);assert.equal(f.posts,0);});
