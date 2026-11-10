// #996 C continuation: narrowly scoped authenticated GitHub GET adapter.
// READ ONLY: no POST, PUT, PATCH, DELETE, workflow dispatch, issue mutation,
// retries, or self-authorizing C operator are implemented here.
// A successful authentication is evidence of GitHub GET provenance only;
// it does NOT attest to the effective token's server-side write permissions,
// physical Windows state, a valid owner consent, or authority to mutate E:.

const REPO='ansqhd5774-Choi/zgmini-pc-control';
const OWNER='ansqhd5774-Choi';
const OWNER_ID=327938088;
const REPO_ID=1442936296;
const ORIGIN='https://api.github.com/';
const API_VERSION='2022-11-28';
const MANIFEST='docs/CONTROLLER_996_C_CONTINUATION_APPROVAL_V1.json';
const ISSUES='(?:996|1217|1219|1226|1227)';
const NATIVE_FETCH=globalThis.fetch;
const MAX_BODY_BYTES=8_000_000;
const FAIL=(code)=>Object.assign(new Error(code),{code});
const need=(condition,code)=>{if(!condition)throw FAIL(code);};
const allowPath=path=>{
  if(new RegExp(`^issues/${ISSUES}$`).test(path))return true;
  if(new RegExp(`^issues/${ISSUES}/comments\\?per_page=100&page=(?:[1-9]|[1-9][0-9]|100)$`).test(path))return true;
  return new RegExp(`^contents/${MANIFEST.replaceAll('.','\\.')}\\?ref=[a-f0-9]{40}$`).test(path);
};

/**
 * This module is library-only; it never reads an environment variable or
 * initiates a request on import. A future separately approved reader may
 * pass an owner-authenticated, read-limited token to read new consent.
 * The one-use consent reader still makes its own exact-body decision.
 */
export function create996AuthenticatedGithubGet({token,fetchImpl=NATIVE_FETCH,
  testOnly=false,identityMode='installation',timeoutMs=15_000}={}){
  need(typeof token==='string'&&token.length>=16&&token.length<=1000&&
    /^[A-Za-z0-9_.-]+$/.test(token),
  'C_996_GITHUB_GET_TOKEN_UNAVAILABLE');
  need(typeof fetchImpl==='function'&&Number.isSafeInteger(timeoutMs)&&
    timeoutMs>=1000&&timeoutMs<=60_000,
  'C_996_GITHUB_GET_CLIENT_INVALID');
  // The injected network port exists for synthetic unit tests only.
  // A future real reader must bind the captured native fetch, not a caller's
  // function returning arbitrary supposed GitHub proof objects.
  need(testOnly===true||(testOnly===false&&fetchImpl===NATIVE_FETCH),
    'C_996_GITHUB_GET_INJECTED_PORT_NOT_APPROVED');
  need(identityMode==='installation'||identityMode==='owner-user',
    'C_996_GITHUB_GET_IDENTITY_MODE_INVALID');
  let authenticated=false;
  let authenticating=false;
  let attempted=false;

  async function request(path){
    const url=new URL(path,ORIGIN);
    need(url.origin==='https://api.github.com'&&
      url.href===ORIGIN+path,
    'C_996_GITHUB_GET_URL_INVALID');
    let res;
    try{
      res=await fetchImpl(url.href,{
        method:'GET',
        redirect:'error',
        cache:'no-store',
        headers:{
          Accept:'application/vnd.github+json',
          Authorization:`Bearer ${token}`,
          'X-GitHub-Api-Version':API_VERSION,
          'User-Agent':'zgmini-controller-996-c-consent-get',
        },
        signal:AbortSignal.timeout(timeoutMs),
      });
    }catch{throw FAIL('C_996_GITHUB_GET_TRANSPORT_UNVERIFIED');}
    need(res?.status===200&&typeof res.text==='function'&&
      res.url===url.href,
    'C_996_GITHUB_GET_RESPONSE_UNVERIFIED');
    const declared=res.headers?.get?.('content-length');
    if(declared!==null&&declared!==undefined){
      need(/^\d+$/.test(declared)&&Number(declared)<=MAX_BODY_BYTES,
        'C_996_GITHUB_GET_BODY_BOUNDS');
    }
    let raw;
    try{
      if(typeof res.body?.getReader==='function'){
        const reader=res.body.getReader();
        const chunks=[];
        let length=0;
        try{
          for(;;){
            const part=await reader.read();
            if(part.done)break;
            need(part.value instanceof Uint8Array,
              'C_996_GITHUB_GET_BODY_BOUNDS');
            length+=part.value.byteLength;
            need(length<=MAX_BODY_BYTES,'C_996_GITHUB_GET_BODY_BOUNDS');
            chunks.push(Buffer.from(part.value));
          }
        }finally{
          if(length>MAX_BODY_BYTES)await reader.cancel().catch(()=>{});
          reader.releaseLock();
        }
        raw=Buffer.concat(chunks,length).toString('utf8');
      }else raw=await res.text(); // Synthetic test-port path only.
    }catch(e){
      if(e?.code==='C_996_GITHUB_GET_BODY_BOUNDS')throw e;
      throw FAIL('C_996_GITHUB_GET_BODY_UNAVAILABLE');
    }
    need(typeof raw==='string'&&raw.length>0&&
      Buffer.byteLength(raw,'utf8')<=MAX_BODY_BYTES,
      'C_996_GITHUB_GET_BODY_BOUNDS');
    let data;
    try{data=JSON.parse(raw);}
    catch{throw FAIL('C_996_GITHUB_GET_JSON_INVALID');}
    return Object.freeze({status:200,data});
  }

  return Object.freeze({
    async authenticateReadOnly(){
      need(!authenticated&&!authenticating&&!attempted,
        'C_996_GITHUB_GET_SESSION_REUSE_DENIED');
      attempted=true;
      authenticating=true;
      try{
        const repo=await request(`repos/${REPO}`);
        need(repo.data?.id===REPO_ID&&
          repo.data?.full_name===REPO&&repo.data?.private===true&&
          repo.data?.owner?.login===OWNER&&repo.data?.owner?.id===OWNER_ID,
        'C_996_GITHUB_GET_ORIGIN_IDENTITY_MISMATCH');
        let kind,actor;
        if(identityMode==='owner-user'){
          const user=await request('user');
          need(user.data?.login===OWNER&&user.data?.id===OWNER_ID,
            'C_996_GITHUB_GET_ORIGIN_IDENTITY_MISMATCH');
          kind='OWNER_USER_GET';
          actor=OWNER;
        }else{
          // Standard Actions GITHUB_TOKEN is an installation access token,
          // NOT a personal owner token. Never demand an owner PAT or mistake
          // this service identity for the author of an approval comment.
          const seen=new Set();
          let count=null,found=false,complete=false;
          for(let page=1;page<=100;page++){
            const res=await request(
              `installation/repositories?per_page=100&page=${page}`);
            const data=res.data;
            need(Number.isSafeInteger(data?.total_count)&&
              data.total_count>=1&&data.total_count<=10_000&&
              Array.isArray(data.repositories)&&data.repositories.length<=100&&
              (count===null||count===data.total_count),
            'C_996_GITHUB_GET_INSTALLATION_LIST_INVALID');
            count=data.total_count;
            for(const entry of data.repositories){
              need(Number.isSafeInteger(entry?.id)&&entry.id>0&&
                !seen.has(entry.id),
              'C_996_GITHUB_GET_INSTALLATION_REPOSITORY_DUPLICATE');
              seen.add(entry.id);
              if(entry.id===REPO_ID){
                need(entry.full_name===REPO&&entry.private===true&&
                  entry.owner?.id===OWNER_ID&&entry.owner?.login===OWNER,
                'C_996_GITHUB_GET_INSTALLATION_REPOSITORY_DRIFT');
                found=true;
              }
            }
            if(data.repositories.length<100){complete=true;break;}
          }
          need(complete&&seen.size===count&&found,
            'C_996_GITHUB_GET_INSTALLATION_REPOSITORY_INCOMPLETE');
          kind='INSTALLATION_REPOSITORY_GET';
          actor='github-app-installation';
        }
        authenticated=true;
        return Object.freeze({kind,actor,ownerAccountId:OWNER_ID,
          repository:REPO,repositoryId:REPO_ID,private:true,
          // This describes the GET-only implementation, not token scopes.
          readOnly:true,executionAuthorized:false,
          testOnly:testOnly===true});
      }finally{authenticating=false;}
    },
    async get(path){
      need(authenticated,'C_996_GITHUB_GET_NOT_AUTHENTICATED');
      need(typeof path==='string'&&allowPath(path),
        'C_996_GITHUB_GET_ENDPOINT_NOT_ALLOWED');
      return request('repos/'+REPO+'/'+path);
    },
  });
}
