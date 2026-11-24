import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sha256,validateManifest,PREIMAGE} from './contract.mjs';

const DIGEST='b541446c1c2a49a85e0af0df248b117b58b968e6938985b47ce99cbc7eed9cc7';
const AFTER='583297b451f168a32a2a5de4b0b04c9b14449aab9a041c954a420203cf04f188';
const PREVIOUS='a7051e99990a1781b1cdda83398b1d01aefc7885f0e23863abb4279c5bb5b548';
const OLD='24077edc2fb4196e83ba202fdd9681b1fe841447';
const NEW='e4b768530335182f422ebd51d163a6f5b754361c';
test('CNN #1521 B R2 uses exact A #3280 preimage and only replaces approved source pin',()=>{
 const manifestBytes=fs.readFileSync(new URL('../approvals/sidecar-b/cnn1521-onefile-20261124-r2.json',import.meta.url));
 assert.equal(manifestBytes.length,919);
 assert.equal(sha256(manifestBytes),DIGEST);
 const m=JSON.parse(manifestBytes.toString('utf8'));
 assert.equal(validateManifest(m),m);
 assert.equal(m.requestId,'5e0f8b3e-1e94-452a-92d1-f3c6ba9f74ac');
 assert.equal(m.approvedSourceSha,'37795e97bc90d8c43fbd7bb3b2e382184e72ea48');
 assert.equal(m.installedHead,NEW);
 assert.equal(m.installedConfigSource,NEW);
 assert.equal(m.beforeSha256,PREIMAGE);
 assert.equal(m.afterSha256,AFTER);
 assert.equal(m.approvedContentSha256,AFTER);
 assert.equal(m.taskDefinitionSha256,'dd81987c7efa4b1e343af30329a580613bb920dec89c1aa7a436ef935f0bb028');
 assert.equal(m.wrapperSha256,'9d5bc3429cd74813207cfc393eb04eff11a78106096964b80bf7833440385b7c');
 assert.equal(m.runCount,1);
 for(const key of ['allowProviderCalls','allowDbChanges','allowD1Writes','allowTaskChanges'])
  assert.equal(m[key],false);
 const legacy=fs.readFileSync(new URL('./approved/archive-run-r1-20261124.mjs',import.meta.url));
 const next=fs.readFileSync(new URL('./approved/archive-run.mjs',import.meta.url));
 assert.equal(legacy.length,11478);
 assert.equal(next.length,legacy.length);
 assert.equal(sha256(legacy),PREVIOUS);
 assert.equal(sha256(next),AFTER);
 const former=legacy.toString('utf8');
 assert.equal(former.split(OLD).length,2);
 assert.equal(next.toString('utf8'),former.replace(OLD,NEW));
});
