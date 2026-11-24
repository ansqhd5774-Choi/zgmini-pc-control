// Fixed replay of the already completed #3324 PC source-inventory receipt.
// No user-supplied paths, remote calls, provider/DB access, or new inventory scan.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const REQUEST_ID='pc-4d7319f8-f308-4d10-8244-bc21026f45ae';
const REPORT_SHA='d386412ceb331ce75c5b3d6b0fb521215e4286d3cc80fddf0810e50fb3f36078';
const WRITER_SHA='b4fc869caea2624969ac9dca94de608db43302eb72f075e029199befdd59ad11';
const MODULE_SHA='67d8dce6408b75a6f57b48028c52e59a6146e3da8006b24fc6745a57fba155be';
const CHUNK_SIZE=81;
const sha=value=>createHash('sha256').update(value).digest('hex');
const fail=code=>({status:'UNVERIFIED',code,fullInventoryTransferVerified:false,
  operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false});
export function verifyFixedW05InventoryReport(report,index){
 if(!Number.isInteger(index)||index<0||index>4)return fail('W05_INVENTORY_CHUNK_NOT_ALLOWED');
 if(!report||report.requestId!==REQUEST_ID||report.operation!=='pc-source-preflight'||
   sha(JSON.stringify(report))!==REPORT_SHA)return fail('W05_INVENTORY_REPORT_SHA_MISMATCH');
 const candidate=report.result?.historicalCheckoutCandidate;
 const writer=candidate?.writerSourceInventory?.files;
 const module=candidate?.moduleSourceInventory?.files;
 if(!Array.isArray(writer)||!Array.isArray(module)||writer.length!==219||module.length!==186||
   sha(JSON.stringify(writer))!==WRITER_SHA||sha(JSON.stringify(module))!==MODULE_SHA)
   return fail('W05_INVENTORY_FILE_LIST_MISMATCH');
 const all=[...writer,...module];
 const chunk=all.slice(index*CHUNK_SIZE,(index+1)*CHUNK_SIZE);
 if(chunk.length!==CHUNK_SIZE)return fail('W05_INVENTORY_CHUNK_INCOMPLETE');
 return {status:'PASS',code:'W05_FIXED_WRITER_INVENTORY_CHUNK_VERIFIED',
  evidenceLevel:'HISTORICAL_CHECKOUT_FILESYSTEM_NOT_CORE_RUNTIME',
  sourceRequestId:REQUEST_ID,originalReportSha256:REPORT_SHA,
  writerFilesCount:writer.length,moduleFilesCount:module.length,
  writerFilesSha256:WRITER_SHA,moduleFilesSha256:MODULE_SHA,
  chunkIndex:index,chunkCount:5,chunkSize:chunk.length,
  chunkSha256:sha(JSON.stringify(chunk)),files:chunk,
  fullInventoryTransferVerified:false,
  operationalWrites:0,providerCalls:0,d1Writes:0,sqliteOpened:false};
}
export function readFixedW05InventoryChunk(operation){
 const match=/^w05-writer-inventory-chunk-([0-4])-readonly$/.exec(operation??'');
 if(!match)return fail('W05_INVENTORY_OPERATION_NOT_ALLOWED');
 try{
  const file=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..','ledger',REQUEST_ID+'.json');
  const stat=fs.lstatSync(file);
  if(!stat.isFile()||stat.isSymbolicLink()||stat.size<100||stat.size>1024*1024)
   return fail('W05_INVENTORY_LEDGER_INVALID');
  const ledger=JSON.parse(fs.readFileSync(file,'utf8'));
  return verifyFixedW05InventoryReport(ledger.report,Number(match[1]));
 }catch{return fail('W05_INVENTORY_LEDGER_UNAVAILABLE');}
}
