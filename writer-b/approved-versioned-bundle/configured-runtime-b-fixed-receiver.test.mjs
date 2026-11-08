import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createFixedConfiguredReceiver}
  from './configured-runtime-b-fixed-receiver.mjs';

const sourceSha='a'.repeat(40),approvalSha='b'.repeat(64);
const requestId='abeb79fe-03b3-4f7c-9df3-f521bff31c50';
function setup(t,{wrongManifest=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'fixed-configured-b-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'configured-feature-source'));
  fs.mkdirSync(path.join(root,'generic-b-control'));
  const eventFile=path.join(root,'event.json');
  fs.writeFileSync(eventFile,'{}');
  const temp=path.join(root,'temp');fs.mkdirSync(temp);
  const env={GITHUB_WORKSPACE:root,RUNNER_TEMP:temp,GITHUB_EVENT_PATH:eventFile};
  const auth={mode:'CONFIGURED_THEMES_REPEAT_UPGRADE',
    request:{requestId},raw:Buffer.from('approved fixed origin'),
    manifest:{sourceSha,packageManifestSha256:approvalSha}};
  const called=[];
  const receiver=createFixedConfiguredReceiver({env,platform:'win32',
    authorize:()=>{called.push('authorize');return auth;},
    pinCheckout:(_,pin)=>{
      called.push('pin');assert.equal(pin.sourceRoot,
        path.join(root,'configured-feature-source'));
    },
    importModule:async(_,rel)=>{
      called.push(rel);
      assert.equal(rel,'scripts/pc-writer/theme-config-package-build.mjs');
      return {buildConfiguredPackage:({sourceSha:sha,outputDir})=>{
        called.push('build');assert.equal(sha,sourceSha);
        const packageRoot=path.join(outputDir,'THEME_CONFIG_PACKAGE');
        fs.mkdirSync(packageRoot);
        return {status:'PACKAGE_BUILT_NO_PC_WRITES',sourceSha:sha,
          packageRoot,manifestSha256:wrongManifest?'c'.repeat(64):approvalSha};
      }};
    },
    claim:()=>{throw Error('claim must never run during package staging');},
  });
  return {receiver,called};
}

test('fixed receiver authorizes pinned checkout and stages only under temp',async t=>{
  const {receiver,called}=setup(t);
  const proof=await receiver.verifyApprovedPackage(requestId);
  assert.equal(proof.repository,'ansqhd5774-Choi/zgmini');
  assert.equal(proof.sourceSha,sourceSha);
  assert.equal(proof.packageManifestSha256,approvalSha);
  assert.match(proof.packageRoot,/zgmini-runtime-b-/);
  assert.deepEqual(called,['authorize','pin',
    'scripts/pc-writer/theme-config-package-build.mjs','build']);
});

test('wrong package manifest hash rejects before Windows operation',async t=>{
  const {receiver,called}=setup(t,{wrongManifest:true});
  await assert.rejects(receiver.verifyApprovedPackage(requestId),
    /B_FIXED_PACKAGE_APPROVAL_MISMATCH/);
  assert.equal(called.at(-1),'build');
});

test('unknown request identity and non-Windows platform never stage package',async t=>{
  const a=setup(t);
  await assert.rejects(a.receiver.verifyApprovedPackage('other'),
    /B_FIXED_APPROVAL_SCOPE/);
  assert.equal(a.called.includes('build'),false);
  const b=createFixedConfiguredReceiver({platform:'linux'});
  await assert.rejects(b.verifyApprovedPackage(requestId),
    /B_FIXED_WINDOWS_REQUIRED/);
});
