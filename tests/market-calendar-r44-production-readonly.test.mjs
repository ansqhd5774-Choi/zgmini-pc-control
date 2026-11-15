import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectR44ProductionReadonly} from '../controller/market-calendar-r44-production-readonly.mjs';
const api='https://zgmini.kr/api/earnings-calendar-display?start=2026-11-16&end=2026-11-18&importance=1';
const page='https://zgmini.kr/market-calendar/';
const good='<article class="mc-row mc-vendor-row" data-search="dac dan">'+
 '<div class=mc-importance aria-label="시총 기준 중요도 별 1개">★</div>'+
 '<small>DeltaScreener (2026-11-03)</small></article>';
function mockFetch({header='ZGMINI-R44-USD-CAP',html=good,publicPage=true}={}){
 const hits=[]; const f=async(u,options)=>{
  hits.push({u,options});
  if(u!==api&&u!==page)throw Error('OUTSIDE_FIXED_URL');
  const isApi=u===api;const body=isApi?html:
   publicPage?'<html><body>시장 캘린더 · 기업 실적</body></html>':'EMPTY';
  return {ok:true,status:200,url:u,headers:{get:k=>
   k==='content-type'?'text/html; charset=utf-8':
   k==='x-zgmini-earnings-grade-reader'&&isApi?header:null},
   text:async()=>body};
 };return {f,hits};
}
test('R44 fixed public GET verifies DAC grade, source date, static page, no raw HTML',async()=>{
 const {f,hits}=mockFetch();const r=await inspectR44ProductionReadonly({fetchImpl:f});
 assert.equal(r.status,'PASS');assert.equal(r.code,'R44_PRODUCTION_API_HTML_VERIFIED');
 assert.equal(r.dacOneStarVerified,true);assert.equal(r.publicUiHydratedVerified,false);
 assert.equal(r.publicGetCount,2);assert.equal(r.providerCalls,0);
 assert.equal(JSON.stringify(r).includes('data-search'),false);
 assert.deepEqual(hits.map(x=>x.u),[api,page]);
 assert.ok(hits.every(x=>x.options.method==='GET'&&x.options.redirect==='error'));
});
test('legacy ER1 header never becomes public R44 verified',async()=>{
 const {f}=mockFetch({header:'ZGMINI-ER1-97'});
 const r=await inspectR44ProductionReadonly({fetchImpl:f});
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.apiHeaderVerified,false);
});
test('wrong ticker or grade cannot be replaced by another event',async()=>{
 const {f}=mockFetch({html:good.replace('data-search="dac dan"','data-search="abc dan"')});
 assert.equal((await inspectR44ProductionReadonly({fetchImpl:f})).dacOneStarVerified,false);
});
test('network refusal is unverified, not an asserted Production data failure',async()=>{
 const r=await inspectR44ProductionReadonly({fetchImpl:async()=>{throw Error('NETWORK')}});
 assert.equal(r.status,'STATE_UNKNOWN');assert.equal(r.code,'R44_PUBLIC_API_UNAVAILABLE');
 assert.equal(r.operationalWrites,0);
});
