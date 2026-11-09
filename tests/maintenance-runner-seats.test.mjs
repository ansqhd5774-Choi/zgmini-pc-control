import test from 'node:test';
import assert from 'node:assert/strict';
import {dedicatedPcRunnerRows} from '../tools/update.mjs';

const seats=()=>Array.from({length:6},(_,i)=>({
 name:`zgmini-pc-0${i+1}`,status:'online',busy:false,
}));

test('six dedicated seats are verified by unique name with independent spare present',()=>{
 const original=seats();
 const withSpare=[{name:'zgmini-handoff-ci-spare-01',status:'online',busy:false},...original];
 assert.deepEqual(dedicatedPcRunnerRows(original),original);
 assert.deepEqual(dedicatedPcRunnerRows(withSpare,{requireOnline:true,requireIdle:true}),original);
});

test('independent spare busy or offline does not block dedicated maintenance drain',()=>{
 const original=seats();
 const withSpare=[...original,{name:'zgmini-handoff-ci-spare-01',status:'offline',busy:true}];
 assert.deepEqual(dedicatedPcRunnerRows(withSpare,{requireOnline:true,requireIdle:true}),original);
});

test('missing or duplicate dedicated seat is never accepted',()=>{
 assert.equal(dedicatedPcRunnerRows(null),null);
 assert.equal(dedicatedPcRunnerRows([]),null);
 assert.equal(dedicatedPcRunnerRows(seats().slice(0,5)),null);
 assert.equal(dedicatedPcRunnerRows([...seats(),seats()[0]]),null);
 assert.equal(dedicatedPcRunnerRows([{name:'other'}]),null);
});

test('required online and idle flags only apply to the six dedicated seats',()=>{
 const offline=seats();
 offline[1].status='offline';
 assert.equal(dedicatedPcRunnerRows(offline,{requireOnline:true}),null);
 assert.equal(dedicatedPcRunnerRows(offline,{requireIdle:true})?.length,6);
 const busy=seats();
 busy[4].busy=true;
 assert.equal(dedicatedPcRunnerRows(busy,{requireIdle:true}),null);
 assert.equal(dedicatedPcRunnerRows(busy,{requireOnline:true})?.length,6);
});
