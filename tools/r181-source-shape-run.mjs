#!/usr/bin/env node
// Fixed, no-network PC inspection. Never executes R181 collector.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {authenticateR181InspectEvent,inspectPinnedR181WindowsFile}
  from './r181-source-shape-readonly.mjs';

const fail=code=>{throw Object.assign(Error(code),{code});};
const need=(v,code)=>{if(!v)fail(code);};
const safeError=e=>/^R181_INSPECT_[A-Z0-9_]{3,80}$/.test(e?.code??'')?
  e.code:'R181_INSPECT_UNCLASSIFIED_STOP';
export async function runR181SourceShapeOnce({event,env,inspect=inspectPinnedR181WindowsFile}={}){
  const request=authenticateR181InspectEvent(event,env);
  const shape=inspect();
  need(shape?.schema==='ZGMINI_R181_URL_SHAPE_V1'&&
    shape.status==='STATIC_SOURCE_ONLY'&&
    shape.providerCalls===0&&shape.operationalWrites===0&&shape.d1Writes===0,
    'R181_INSPECT_SHAPE_UNVERIFIED_STOP');
  return {schema:'ZGMINI_R181_SHAPE_RESULT_V1',
    status:'PASS',code:'R181_SOURCE_SHAPE_READONLY',
    requestId:request.requestId,shape};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  let output;
  try{
    const env=process.env;
    const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
    output=await runR181SourceShapeOnce({event,env});
  }catch(e){
    output={schema:'ZGMINI_R181_SHAPE_RESULT_V1',status:'STOP',
      code:safeError(e),requestId:null};
  }
  try{
    const dir=process.env.RUNNER_TEMP;
    need(typeof dir==='string'&&path.isAbsolute(dir),
      'R181_INSPECT_TEMP_DENIED');
    fs.writeFileSync(path.join(dir,'r181-source-shape-result.json'),
      JSON.stringify(output)+'\n',{flag:'wx',encoding:'utf8'});
  }catch{process.exitCode=1;}
  process.stdout.write(output.status+' '+output.code+'\n');
  if(output.status!=='PASS')process.exitCode=1;
}
