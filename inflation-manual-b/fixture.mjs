import {
 APPROVAL_SCHEMA,CONTROL_REPO,ISSUE_LABEL,ISSUE_TITLE,MAX_BYTES,
 OPERATION,REQUEST_SCHEMA,SCOPE,SOURCE_FILES,SOURCE_ROOT,TARGETS,URLS,
 sha256,
} from './contract.mjs';

export const REQUEST_ID='bd435d7c-2939-457f-907c-98d551f6b8cf';
export const CHAT_ID='d9ff52d2-960a-4e6c-9d6b-ee63cc76b2f1';
export const CONTROL_SHA='a'.repeat(40);
export function manifest(){return {
 schema:APPROVAL_SCHEMA,status:'APPROVED_B',scope:SCOPE,
 sourceRoot:SOURCE_ROOT,sourceSha:'b'.repeat(40),
 sourceFiles:SOURCE_FILES.map((path,i)=>({path,sha256:String(i+1).repeat(64)})),
 providerUrls:{...URLS},targetFiles:{...TARGETS},maxBytes:{...MAX_BYTES},
 timeoutMs:40_000,runCount:1,
 coreLeaseMode:'EXCLUSIVE_EXISTING_LOCAL_CYCLE_LOCK',
 allowDbWrites:false,allowD1Writes:false,
 allowTaskChanges:false,allowSourceChanges:false,allowOtherWrites:false,
};}
export function authorizationFixture(){
 const bytes=Buffer.from(JSON.stringify(manifest()));
 const request={schema:REQUEST_SCHEMA,requestId:REQUEST_ID,chatId:CHAT_ID,
  operation:OPERATION,controlRepository:CONTROL_REPO,
  approvalManifestPath:'approvals/inflation-manual-b/inflation-official-20261110.json',
  approvalManifestSha256:sha256(bytes)};
 const event={action:'opened',repository:{full_name:CONTROL_REPO,private:true},
  sender:{login:'ansqhd5774-Choi'},issue:{number:1106,
   user:{login:'ansqhd5774-Choi'},title:ISSUE_TITLE,
   labels:[{name:ISSUE_LABEL}],body:JSON.stringify(request)}};
 const env={GITHUB_REPOSITORY:CONTROL_REPO,GITHUB_EVENT_NAME:'issues',
  GITHUB_EVENT_ACTION:'opened',GITHUB_ACTOR:'ansqhd5774-Choi',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:CONTROL_SHA};
 return {event,env,bytes,request};
}
