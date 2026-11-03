import test from'node:test';import assert from'node:assert/strict';
import{readAllPages}from'../controller/common.mjs';
import{readAllMaintenancePages}from'../tools/maintenance-contract.mjs';
for(const [name,collect]of [['controller',readAllPages],['maintainer',readAllMaintenancePages]]){
 test(name+' finds result beyond first hundred comments',async()=>{
  const rows=await collect(page=>page===1?Array.from({length:100},(_,i)=>({id:i})): [{id:100,body:'verified-result'}]);
  assert.equal(rows.length,101);assert.equal(rows.at(-1).body,'verified-result');
 });
 test(name+' fails closed when pagination budget is exhausted',async()=>{
  await assert.rejects(async()=>collect(()=>Array(100).fill({}),{maxPages:2}),/PAGINATION_INCOMPLETE/);
 });
}
