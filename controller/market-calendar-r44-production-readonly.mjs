// Fixed public R44 API and static market-calendar page check, read-only.
// Never forwards raw HTML, credentials, D1/private data or arbitrary URLs.
const API='https://zgmini.kr/api/earnings-calendar-display?start=2026-11-16&end=2026-11-18&importance=1';
const PAGE='https://zgmini.kr/market-calendar/';
const MAX_BYTES=1200000;
const fail=(code,received=0)=>({status:'STATE_UNKNOWN',code,
 apiHeaderVerified:false,dacOneStarVerified:false,sourceAsOfVerified:false,
 publicPageServed:false,publicUiHydratedVerified:false,
 publicGetCount:received,providerCalls:0,d1Writes:0,
 operationalWrites:0,sqliteOpened:false});
const safeGet=async(fetchImpl,url)=>{
 const res=await fetchImpl(url,{method:'GET',redirect:'error',headers:{accept:'text/html'},
  signal:AbortSignal.timeout(12000)});
 if(!res||res.status!==200||!res.ok||res.url!==url)
  throw Error('R44_PUBLIC_HTTP_NOT_VERIFIED');
 const size=Number(res.headers?.get?.('content-length')??0);
 if(Number.isFinite(size)&&size>MAX_BYTES)throw Error('R44_PUBLIC_RESPONSE_TOO_LARGE');
 const body=await res.text();
 if(Buffer.byteLength(body,'utf8')>MAX_BYTES)throw Error('R44_PUBLIC_RESPONSE_TOO_LARGE');
 return {body,header:res.headers?.get?.('x-zgmini-earnings-grade-reader')??null,
  type:res.headers?.get?.('content-type')??null};
};
export async function inspectR44ProductionReadonly({fetchImpl=globalThis.fetch}={}){
 if(typeof fetchImpl!=='function')return fail('R44_PUBLIC_FETCH_UNAVAILABLE');
 let data;
 try{data=await safeGet(fetchImpl,API);}
 catch{return fail('R44_PUBLIC_API_UNAVAILABLE',1);}
 const apiHeaderVerified=data.header==='ZGMINI-R44-USD-CAP';
 const typeVerified=typeof data.type==='string'&&/text\/html/i.test(data.type);
 // Ensure DAC's exact event article, not an unrelated 1-star event.
 const dac=data.body.match(/<article class="mc-row mc-vendor-row" data-search="dac [^"]*">[\s\S]*?<\/article>/i)?.[0]??'';
 const dacOneStarVerified=dac.includes('aria-label="시총 기준 중요도 별 1개"');
 const sourceAsOfVerified=dac.includes('DeltaScreener')&&dac.includes('2026-11-03');
 let publicPageServed=false;
 try{
  const page=await safeGet(fetchImpl,PAGE);
  publicPageServed=page.body.includes('시장 캘린더')&&
   page.body.includes('기업 실적');
 }catch{}
 const apiVerified=apiHeaderVerified&&typeVerified&&dacOneStarVerified&&sourceAsOfVerified;
 return {status:apiVerified&&publicPageServed?'PASS':'STATE_UNKNOWN',
  code:apiVerified&&publicPageServed?'R44_PRODUCTION_API_HTML_VERIFIED':
   'R44_PRODUCTION_PRESENTATION_NOT_VERIFIED',
  apiHeaderVerified,dacOneStarVerified,sourceAsOfVerified,
  publicPageServed,publicUiHydratedVerified:false,
  verificationScope:'FIXED_PUBLIC_HTML_API_AND_STATIC_PAGE_ONLY',
  publicGetCount:2,providerCalls:0,d1Writes:0,operationalWrites:0,sqliteOpened:false};
}
