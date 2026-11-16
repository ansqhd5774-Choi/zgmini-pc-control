import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeR44ExistingInput,inspectR44ExistingInputAudit} from
 '../controller/market-calendar-r44-input-audit-readonly.mjs';
const header='ticker,name,exchange,sector,industry,country,price,mktCap';
const csv=rows=>[header,...rows].join('\n')+'\n';
const rows=[
 'DAC,Danaos,NYSE,Industrials,Marine,US,100,2802626256',
 'META,Meta,NASDAQ,,,US,0,25000000000',
 'GOOG,Alphabet,NASDAQ,Technology,Internet,US,200,3409323404043',
 'GOOGL,Alphabet,NASDAQ,Technology,Internet,US,200,3401168208750',
 'BRK-B,Berkshire,NYSE,Financials,Insurance,US,500,860000000000',
 'OTC1,Unlisted,OTC,Finance,Banks,US,50,30000000000'
];
test('fixed source audit: separate exact market-cap grading from metadata-only exclusions',()=>{
 const x=analyzeR44ExistingInput(csv(rows),['DAC','META','GOOG','BRK.B','ABSENT']);
 assert.equal(x.rawRows,6);
 assert.equal(x.validListedTickers,4);
 assert.equal(x.metadataRejectedWithCap,1);
 assert.equal(x.metadataCandidates,1);
 assert.equal(x.aliasCandidates,1);
 assert.equal(x.maskedShareClassCandidates,1);
 assert.equal(x.coveredTickerCount,2);
 assert.deepEqual(x.counts,{one:1,two:0,three:1,missing:3,conflicting:0});
 assert.deepEqual(x.missingReasons,{
  absentFromSourceCsv:2,onlyOutsideAllowedExchanges:0,
  missingOrInvalidMarketCap:0,missingRequiredMetadata:1,
  duplicateTickerQuarantined:0,otherUnclassified:0
 });
 assert.equal(x.grades.get('DAC'),1);
 assert.equal(x.grades.get('GOOG'),3);
 assert.equal(x.grades.get('META'),null);
});
test('both share classes on calendar produce existing 2-conflict result',()=>{
 const x=analyzeR44ExistingInput(csv(rows),['GOOG','GOOGL']);
 assert.deepEqual(x.counts,{one:0,two:0,three:0,missing:0,conflicting:2});
 assert.equal(x.maskedShareClassCandidates,0);
});
test('duplicate ticker never becomes a metadata recovery candidate',()=>{
 const x=analyzeR44ExistingInput(csv([
  'AA,One,NYSE,Tech,Tech,US,5,10000000000',
  'AA,Two,NYSE,Tech,Tech,US,5,10000000000',
  'BB,NoPrice,NYSE,Tech,Tech,US,0,10000000000'
 ]),['AA','BB']);
 assert.equal(x.strictDuplicateTickerConflicts,1);
 assert.equal(x.rawCapDuplicateConflicts,1);
 assert.deepEqual(x.counts,{one:0,two:0,three:0,missing:2,conflicting:0});
 assert.equal(x.metadataCandidates,1);
 assert.equal(x.missingReasons.duplicateTickerQuarantined,1);
 assert.equal(x.missingReasons.missingRequiredMetadata,1);
});
test('missing reasons partition the existing CSV rather than imputing any star',()=>{
 const data=csv([
  'FULL,Listed,NASDAQ,Technology,Apps,US,10,15000000000',
  'OTC1,Nonlisted,OTC,Tech,Apps,US,10,15000000000',
  'NOCP,NoCap,NYSE,Tech,Apps,US,10,0',
  'NOMETA,NoMetadata,NASDAQ,,Apps,US,10,26000000000',
  'REPEAT,One,NASDAQ,Tech,Apps,US,15,36000000000',
  'REPEAT,One,NASDAQ,Tech,Apps,US,15,36000000000'
 ]);
 const a=analyzeR44ExistingInput(data,['FULL','OTC1','NOCP','NOMETA','REPEAT','ABS']);
 assert.deepEqual(a.counts,{one:1,two:0,three:0,missing:5,conflicting:0});
 assert.deepEqual(a.missingReasons,{
  absentFromSourceCsv:1,onlyOutsideAllowedExchanges:1,
  missingOrInvalidMarketCap:1,missingRequiredMetadata:1,
  duplicateTickerQuarantined:1,otherUnclassified:0
 });
 assert.equal(Object.values(a.missingReasons).reduce((sum,n)=>sum+n,0),a.counts.missing);
 assert.equal(a.grades.get('ABS'),null);
 assert.equal(a.grades.get('FULL'),1);
});
test('50B fixed scenario counts only graded unique calendar tickers at USD boundary',()=>{
 const a=analyzeR44ExistingInput(csv([
  'LOW,Low,NYSE,Tech,Apps,US,10,49999999999',
  'EDGE,Exact,NYSE,Tech,Apps,US,10,50000000000',
  'HIGH,High,NASDAQ,Tech,Apps,US,10,199999999999',
  'TOP,Top,NASDAQ,Tech,Apps,US,10,200000000000',
  'OTC1,Unlisted,OTC,Tech,Apps,US,10,999999999999',
  'DUP,One,NYSE,Tech,Apps,US,10,999999999999',
  'DUP,Two,NYSE,Tech,Apps,US,10,999999999999'
 ]),['LOW','EDGE','HIGH','TOP','OTC1','DUP','ABS']);
 assert.deepEqual(a.counts,{one:0,two:3,three:1,missing:3,conflicting:0});
 assert.deepEqual(a.threshold50B,{cutoffUsd:50000000000,calendarTickerCount:3});
 assert.equal(a.grades.get('LOW'),2);
 assert.equal(a.grades.get('EDGE'),2);
 assert.equal(a.grades.get('TOP'),3);
});
test('50B scenario excludes share-class collisions even if both caps exceed cutoff',()=>{
 const a=analyzeR44ExistingInput(csv(rows),['GOOG','GOOGL','DAC']);
 assert.deepEqual(a.counts,{one:1,two:0,three:0,missing:0,conflicting:2});
 assert.deepEqual(a.threshold50B,{cutoffUsd:50000000000,calendarTickerCount:0});
});
test('strict CSV contract refuses malformed input or unsafe ticker',()=>{
 assert.throws(()=>analyzeR44ExistingInput('ticker,mktCap\nDAC,1\n',['DAC']),
  /R44_CSV_HEADER_INVALID/);
 assert.throws(()=>analyzeR44ExistingInput(csv(rows),['../escape']),
  /R44_CALENDAR_TICKERS_INVALID/);
 assert.throws(()=>analyzeR44ExistingInput(csv(['DAC,broken']),['DAC']),
  /R44_CSV_WIDTH_INVALID/);
});
test('no root means no filesystem access or source disclosure',()=>{
 const x=inspectR44ExistingInputAudit('relative-not-authorized');
 assert.equal(x.status,'STATE_UNKNOWN');
 assert.equal(x.code,'R44_FIXED_ROOT_INVALID');
 assert.equal(x.sqliteOpened,false);
 assert.equal(x.providerCalls,0);
 assert.equal(x.dbWrites,0);
 assert.equal(x.d1Writes,0);
 assert.equal(x.operationalWrites,0);
 assert.equal(x.rawExposed,false);
 assert.equal(x.formulaModified,false);
 assert.equal(x.threshold50B,null);
 assert.ok(!Object.hasOwn(x,'grades'));
});
