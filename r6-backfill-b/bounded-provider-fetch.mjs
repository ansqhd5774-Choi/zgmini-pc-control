// R6 B one-shot physical-network boundary. SOURCE ONLY; the trusted host must
// pass this as *originalFetch* exactly once into the approved shared quota
// wrapper. Every call represents one attempted physical request; a timeout
// or unknown response is NEVER subtracted or retried automatically.
import {R6_ONE_SHOT} from './contract.mjs';

const URL_BLS='https://api.bls.gov/publicAPI/v1/timeseries/data/';
const URL_DOL_NATIONAL='https://oui.doleta.gov/unemploy/wkclaims/report.asp';
const URL_DOL_ETA539='https://oui.doleta.gov/unemploy/csv/ar539.csv';
const error=code=>Object.assign(Error(code),{code});

export function createR6BBoundedPhysicalFetch({originalFetch,
  heldCoreLock,allowPhysicalNetwork=false}={}){
  if(typeof originalFetch!=='function')throw error('R6_B_PHYSICAL_FETCH_REQUIRED');
  const counters={bls:0,dol:0,total:0};
  const snapshot=()=>Object.freeze({...counters});
  const fetch=async(input,init={})=>{
    if(!allowPhysicalNetwork||heldCoreLock?.verifyHeld?.()!==true)
      throw error('R6_B_PHYSICAL_NETWORK_NOT_AUTHORIZED');
    if(typeof input!=='string'||!init||typeof init!=='object'||
      Array.isArray(init))throw error('R6_B_PHYSICAL_REQUEST_SHAPE_STOP');
    const verb=String(init.method??'GET').toUpperCase();
    let category;
    if(input===URL_BLS&&verb==='POST'&&typeof init.body==='string'){
      let body;
      try{body=JSON.parse(init.body);}catch{throw error('R6_B_BLS_BODY_STOP');}
      if(!body||typeof body!=='object'||Array.isArray(body)||
         Object.keys(body).sort().join('|')!==['seriesid','startyear','endyear'].sort().join('|')||
         !Array.isArray(body.seriesid)||body.seriesid.length<1||body.seriesid.length>25||
         !body.seriesid.every(x=>typeof x==='string'&&/^[A-Z0-9_-]{1,80}$/.test(x))||
         !/^20\d\d$/.test(body.startyear)||!/^20\d\d$/.test(body.endyear)||
         Number(body.endyear)<Number(body.startyear)||
         Number(body.endyear)-Number(body.startyear)>9)
        throw error('R6_B_BLS_BODY_STOP');
      category='bls';
    }else if(input===URL_DOL_NATIONAL&&verb==='POST'&&typeof init.body==='string'){
      const params=new URLSearchParams(init.body);
      if([...params.keys()].sort().join('|')!==
          ['level','final_yr','strtdate','enddate','filetype','submit'].sort().join('|')||
         params.get('level')!=='us'||params.get('filetype')!=='xml'||
         params.get('submit')!=='Submit'||
         !['final_yr','strtdate','enddate'].every(k=>/^20\d\d$/.test(params.get(k)??'')))
        throw error('R6_B_DOL_BODY_STOP');
      category='dol';
    }else if(input===URL_DOL_ETA539&&verb==='GET'&&
      (init.body===undefined||init.body===null)){
      category='dol';
    }else throw error('R6_B_PROVIDER_URL_OR_METHOD_STOP');
    if(counters.total>=R6_ONE_SHOT.maxTotalRequests||
       category==='bls'&&counters.bls>=R6_ONE_SHOT.maxBlsRequests||
       category==='dol'&&counters.dol>=R6_ONE_SHOT.maxDolRequests)
      throw error('R6_B_PROVIDER_REQUEST_CAP_STOP');
    // Count before attempting I/O, never after the response. This is an
    // independent host check of the physical fetch boundary, not the quota
    // journal itself; the latter reserves/spends its own durable slots first.
    counters[category]++;
    counters.total++;
    // Following a redirect would silently send a second physical request to
    // an origin outside this exact allowlist. Count the attempt but fail the
    // redirected response instead of following it.
    return originalFetch(input,{...init,redirect:'error'});
  };
  return Object.freeze({fetch,snapshot});
}
