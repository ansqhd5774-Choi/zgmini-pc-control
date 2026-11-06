import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeCycleCheckpoint} from './cycle-checkpoint-summary.mjs';
test('publication failure reason projection includes only exact allowed fields',()=>{
 const raw={status:'PUBLICATION_NOT_VERIFIED',publishRequested:true,
  publicationExit:1,collectionExit:0,collectionStatus:'COMPLETE',
  publicationPolicy:{publishAllowed:true,collectionDegraded:false,
   inputPolicy:'NORMAL_STORED_INPUTS',collectionReason:null},
  progressive:{enabled:true,earlyExit:1,finalSkipped:false,
   reason:'CHECKPOINT_UNAVAILABLE_OR_EARLY_NOT_VERIFIED'},
  providerRaw:{secret:'TOKEN_SECRET'}};
 const result=summarizeCycleCheckpoint(JSON.stringify(raw));
 assert.equal(result.status,'PUBLICATION_NOT_VERIFIED');
 assert.equal(result.publicationExit,1);
 assert.equal(result.progressiveReason,'CHECKPOINT_UNAVAILABLE_OR_EARLY_NOT_VERIFIED');
 assert.equal(JSON.stringify(result).includes('TOKEN_SECRET'),false);
});
test('arbitrary error/path strings never leave the whitelist',()=>{
 const result=summarizeCycleCheckpoint(JSON.stringify({status:'Bearer secret',
  publicationExit:'runtime detailed exception',
  progressive:{reason:'E:\\secret\\token.txt'},
  collectionStatus:'path to private key'}));
 assert.equal(result.status,'UNKNOWN');
 assert.equal(result.publicationExit,null);
 assert.equal(result.progressiveReason,'UNKNOWN');
 assert.equal(JSON.stringify(result).includes('secret'),false);
});
