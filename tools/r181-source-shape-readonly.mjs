// W03 pinned R181 read-only source topology classification.
// Never executes collector, returns raw strings, calls provider or writes PC.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

export const OPERATION='r181-source-shape-readonly';
export const REQUEST_SCHEMA='ZGMINI_R181_SOURCE_SHAPE_READONLY_V1';
export const TARGET='E:\\ZGmini\\data\\theme-market-history-r131\\marketparquet-r167\\r181-primary-cycle.mjs';
export const PIN='be0303b112d6f4471137aa134bf98f696a8a8dfe60d1d13502646c5e0b509d62';
const REPO='ansqhd5774-Choi/zgmini-pc-control',ACTOR='ansqhd5774-Choi';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash=b=>createHash('sha256').update(b).digest('hex');
const stop=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)stop(code);};
const bucket=n=>n===0?'ZERO':n===1?'ONE':'MULTIPLE';
const KEYWORDS=new Set(['const','let','var','return','new','function','async',
  'await','try','catch','if','else','for','of','in','while','true','false',
  'null','undefined','URL','URLSearchParams','fetch','encodeURIComponent',
  'String','JSON','get','set','append','searchParams','toString','map',
  'throw','Error','status','ok','httpStatus']);
function safeShapes(source){
  return source.split(/\r?\n/).flatMap((line,i)=>{
    if(i>65)return [];
    let pattern='',state='CODE',quote='',escape=false;
    for(let j=0;j<line.length;j++){
      const c=line[j],n=line[j+1]??'';
      if(state==='COMMENT')continue;
      if(state==='BLOCK'){
        if(c==='*'&&n==='/'){state='CODE';j++;}
        continue;
      }
      if(state==='STRING'){
        if(escape){escape=false;continue;}
        if(c==='\\'){escape=true;continue;}
        if(c===quote){state='CODE';}
        continue;
      }
      if(c==='/'&&n==='/'){state='COMMENT';j++;continue;}
      if(c==='/'&&n==='*'){state='BLOCK';j++;continue;}
      if(c==='"'||c==="'"||c===String.fromCharCode(96)){
        state='STRING';quote=c;pattern+=' LIT ';continue;
      }
      if(/[A-Za-z_$]/.test(c)){
        let k=j+1;
        while(k<line.length&&/[A-Za-z0-9_$]/.test(line[k]))k++;
        const word=line.slice(j,k);
        pattern+=(KEYWORDS.has(word)?' '+word+' ':' ID ');
        j=k-1;continue;
      }
      if(/[0-9]/.test(c)){
        let k=j+1;
        while(k<line.length&&/[0-9.]/.test(line[k]))k++;
        pattern+=' NUM ';j=k-1;continue;
      }
      if(/[()[\]{}:;,.=+?!<>*/%-]/.test(c))pattern+=c;
      else if(/\s/.test(c))pattern+=' ';
    }
    return [{line:i+1,shape:pattern.replace(/\s+/g,' ').trim().slice(0,180)}];
  });
}
const LITERALS={
  BARS_PREFIX:'/api/v1/bars',
  OLD_EXACT:'/api/v1/bars/stocks/',
  MODERN_EXACT:'/api/v1/bars/stocks/us/',
  STOCKS_US:'stocks/us',
  QUERY_ROUTE:'/query/v1',
  BARS_QUERY:'/api/v1/bars?',
};
const WORDS=['source','symbol','dataset','ticker','timeframe','SPY','1h'];
const SIGNALS=Object.freeze({
  HOST_GMH:'getmarkethistory.com',
  PATH_API:'/api',PATH_V1:'/v1',PATH_V2:'/v2',
  PATH_BARS:'/bars',PATH_QUERY:'/query',PATH_STOCKS:'/stocks',
  PATH_ETF:'/etf',PATH_HOURLY:'/hour',PATH_ONE_HOUR:'/1h',
  DATASET_PARAM:'dataset=',TICKER_PARAM:'ticker=',
  SYMBOL_PARAM:'symbol=',SOURCE_PARAM:'source=',
  GRANULARITY_PARAM:'timeframe=',QUERY_QUESTION:'?',
});
function safeImportFiles(source){
  const lines=source.split(/\r?\n/);
  return lines.slice(0,15).flatMap((line,i)=>{
    const m=line.match(/^\s*import\s+(?:.*?)\s+from\s+(['"])(.*?)\1/);
    if(!m)return [];
    const dest=m[2];
    if(dest.startsWith('node:'))return [{line:i+1,kind:'NODE_BUILTIN'}];
    if(!/^(\.\.\/|\.\/)+[a-z0-9._\/-]+\.mjs$/i.test(dest))
      return [{line:i+1,kind:'OTHER_IMPORT'}];
    const name=dest.split('/').at(-1);
    return [{line:i+1,kind:'RELATIVE_MODULE',
      basename:/^[a-z0-9][a-z0-9.-]{1,72}\.mjs$/i.test(name)?name:null,
      parentDepth:(dest.match(/\.\.\//g)||[]).length}];
  });
}
// Examine only short literal-like fragments and return fixed signal names.
// Never return any original fragment, URL, API key or query value.
function fixedLiteralSignals(source){
  const lines=source.split(/\r?\n/),bt=String.fromCharCode(96),out=[];
  for(let i=0;i<Math.min(66,lines.length);i++){
    const line=lines[i],parts=[];
    for(const quote of ["'",'"',bt]){
      let at=0;
      while(at<line.length){
        const start=line.indexOf(quote,at);
        if(start<0)break;
        const end=line.indexOf(quote,start+1);
        if(end<0)break;
        parts.push(line.slice(start+1,end));
        at=end+1;
        if(parts.length>14)break;
      }
    }
    const signs=Object.entries(SIGNALS)
      .filter(([_,v])=>parts.some(part=>part.includes(v)))
      .map(([k])=>k);
    if(signs.length)out.push({line:i+1,signals:signs});
    if(out.length>=30)break;
  }
  return out;
}
export function classifyR181SourceForFixture(source){
  need(typeof source==='string'&&Buffer.byteLength(source)<=8192,
    'R181_INSPECT_UNSAFE_SOURCE_STOP');
  const n=source.split('/api/v1/bars/stocks/').length-1;
  const literalHints={
    ...Object.fromEntries(Object.entries(LITERALS).map(([k,v])=>[k,source.includes(v)])),
    ...Object.fromEntries(WORDS.map(w=>[w,
      new RegExp('(?:^|[^A-Za-z0-9_])'+w+'(?:$|[^A-Za-z0-9_])').test(source)])),
  };
  return Object.freeze({
    schema:'ZGMINI_R181_URL_SHAPE_V1',status:'STATIC_SOURCE_ONLY',
    legacyRouteCountBucket:bucket(n),
    modernRouteExactPresent:literalHints.MODERN_EXACT,
    literalHints,features:{
      usesURLConstructor:/\bnew\s+URL\s*\(/.test(source),
      usesURLSearchParams:/\bURLSearchParams\b/.test(source),
      usesEncodeURIComponent:/\bencodeURIComponent\b/.test(source),
      usesTemplateLiterals:source.includes(String.fromCharCode(96)),
      usesFetch:/\bfetch\s*\(/.test(source),
      usesDynamicConcatenation:/\+\s*(?:[A-Za-z_$]|\()/m.test(source),
      usesGetMarketHistoryHost:source.includes('getmarkethistory.com'),
    },
    safeShapeLines:safeShapes(source),
    importFiles:safeImportFiles(source),
    literalSignalsByLine:fixedLiteralSignals(source),
    runtimeUrlVerified:false,http404SubtypeVerified:false,
    providerCalls:0,operationalWrites:0,sqliteOpened:false,d1Writes:0,
  });
}
export function classifyPinnedR181Source(bytes){
  need(Buffer.isBuffer(bytes)&&bytes.length===7089,
    'R181_INSPECT_SOURCE_SIZE_STOP');
  need(hash(bytes)===PIN,'R181_INSPECT_SOURCE_PIN_STOP');
  const source=bytes.toString('utf8');
  need(Buffer.from(source,'utf8').equals(bytes)&&!source.includes('\0'),
    'R181_INSPECT_SOURCE_UTF8_STOP');
  return classifyR181SourceForFixture(source);
}
export function authenticateR181InspectEvent(event,env){
  need(env?.GITHUB_REPOSITORY===REPO&&env.GITHUB_EVENT_NAME==='issues'&&
    env.GITHUB_EVENT_ACTION==='opened'&&env.GITHUB_RUN_ATTEMPT==='1'&&
    env.GITHUB_ACTOR===ACTOR&&event?.repository?.full_name===REPO&&
    event.repository.private===true&&event.sender?.login===ACTOR&&
    event.issue?.user?.login===ACTOR&&!event.issue.pull_request&&
    event.issue.title===OPERATION&&
    event.issue.labels?.some(l=>l.name==='pc-writer-b-install')&&
    Number.isSafeInteger(event.issue.number)&&event.issue.number>0,
    'R181_INSPECT_EVENT_DENIED');
  let request;
  try{request=JSON.parse(event.issue.body);}
  catch{stop('R181_INSPECT_REQUEST_JSON_STOP');}
  need(request&&typeof request==='object'&&!Array.isArray(request)&&
    Object.keys(request).sort().join(',')===
      ['schema','requestId','chatId','operation','controlRepository','beforeSha256'].sort().join(',')&&
    request.schema===REQUEST_SCHEMA&&request.operation===OPERATION&&
    request.controlRepository===REPO&&request.beforeSha256===PIN&&
    UUID.test(request.requestId??'')&&UUID.test(request.chatId??''),
    'R181_INSPECT_REQUEST_DENIED');
  return Object.freeze(request);
}
export function inspectPinnedR181WindowsFile({read=fs.readFileSync,
  stat=fs.lstatSync,realpath=fs.realpathSync.native}={}){
  need(process.platform==='win32','R181_INSPECT_WINDOWS_ONLY_STOP');
  const st=stat(TARGET);
  need(st.isFile()&&!st.isSymbolicLink()&&st.size===7089,
    'R181_INSPECT_TARGET_DRIFT_STOP');
  need(path.win32.dirname(realpath(TARGET)).toLowerCase()===
    realpath(path.win32.dirname(TARGET)).toLowerCase(),
    'R181_INSPECT_ROOT_ESCAPE_STOP');
  const before=read(TARGET),shape=classifyPinnedR181Source(before);
  const after=read(TARGET);
  need(Buffer.isBuffer(after)&&after.equals(before),
    'R181_INSPECT_CONCURRENT_DRIFT_STOP');
  return shape;
}
