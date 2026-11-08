#!/usr/bin/env node
// Read-only Actions bridge: verified owner Issue + immutable control manifest
// -> exact candidate source SHA for the standard pinned actions/checkout.
// No network access, shell or operational PC write.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadApprovedRaw} from './run.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(ok,code)=>{if(!ok)fail(code);};

export function resolveConfiguredSourcePin({event,env,controlRoot,
  loadAuth=loadApprovedRaw}={}){
  const auth=loadAuth({event,env,controlRoot});
  if(auth.mode!=='CONFIGURED_THEMES_REPEAT_UPGRADE')return '';
  need(auth.manifest.sourceRepository==='ansqhd5774-Choi/zgmini'&&
    /^[a-f0-9]{40}$/.test(auth.manifest.sourceSha??'')&&
    auth.manifest.runnerPath===
      'scripts/pc-writer/theme-config-package-runner.mjs',
  'DIRECT_B_CONFIGURED_SOURCE_PIN_STOP');
  return auth.manifest.sourceSha;
}

if(process.argv[1]&&path.resolve(process.argv[1])===
  fileURLToPath(import.meta.url)){
  try{
    need(process.platform==='win32','DIRECT_B_CONFIGURED_WINDOWS_REQUIRED');
    const env=process.env;
    need(typeof env.GITHUB_OUTPUT==='string'&&
      path.isAbsolute(env.GITHUB_OUTPUT),'DIRECT_B_GITHUB_OUTPUT_STOP');
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    const controlRoot=path.join(env.GITHUB_WORKSPACE??'','generic-b-control');
    const sourceSha=resolveConfiguredSourcePin({event,env,controlRoot});
    fs.appendFileSync(env.GITHUB_OUTPUT,`sourceSha=${sourceSha}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT,
      `candidateCheckoutRequired=${sourceSha!==''?'true':'false'}\n`);
    process.stdout.write('DIRECT_B_APPROVED_SOURCE_PIN_VERIFIED\n');
  }catch(error){
    process.stderr.write(/^DIRECT_B_[A-Z0-9_]+$/.test(error?.code??'')?
      error.code+'\n':'DIRECT_B_SOURCE_PIN_STOP\n');
    process.exitCode=2;
  }
}
