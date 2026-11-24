import test from 'node:test';
import assert from 'node:assert/strict';
import {readFixedW05InventoryChunk,verifyFixedW05InventoryReport} from '../controller/w05-writer-inventory-chunk-readonly.mjs';

test('fixed W05 inventory retrieval rejects any caller-selected path or unregistered chunk',()=>{
 for(const operation of [null,'pc-source-preflight','w05-writer-inventory-chunk-5-readonly',
  'w05-writer-inventory-chunk-0-readonly/../../secrets',
  'w05-writer-inventory-chunk--1-readonly']){
  const out=readFixedW05InventoryChunk(operation);
  assert.equal(out.status,'UNVERIFIED');
  assert.equal(out.fullInventoryTransferVerified,false);
  assert.equal(out.operationalWrites,0);
 }
});

test('fixed inventory reader cannot promote a mismatched report or index to PASS',()=>{
 const wrong={requestId:'pc-4d7319f8-f308-4d10-8244-bc21026f45ae',
  operation:'pc-source-preflight',result:{historicalCheckoutCandidate:{
   writerSourceInventory:{files:[]},moduleSourceInventory:{files:[]}}}};
 for(const index of [-1,0,4,5]){
  const out=verifyFixedW05InventoryReport(wrong,index);
  assert.equal(out.status,'UNVERIFIED');
  assert.equal(out.fullInventoryTransferVerified,false);
 }
});
