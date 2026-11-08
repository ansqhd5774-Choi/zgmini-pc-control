#!/usr/bin/env node
// Record the native Node process exit without changing its exit status.
// This is a create-only TEMP diagnostic, never an approval or effect signal.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const DIRECT_B_EXIT_FILE='approved-runtime-b-apply-exit.json';
export const DIRECT_B_EXIT_SCHEMA='ZGMINI_APPROVED_RUNTIME_B_APPLY_EXIT_V1';
const RUN=/^[0-9]{1,18}$/;
const CODE=/^(?:0|[1-9][0-9]{0,2})$/;

export function recordApplyExit({env=process.env,exitText,
  writeFile=fs.writeFileSync}={}){
  if(!RUN.test(env?.GITHUB_RUN_ID??'')||
    !/^[a-z0-9-]{1,80}$/.test(env?.GITHUB_JOB??'')||
    !CODE.test(exitText??'')||Number(exitText)>255||
    typeof env.RUNNER_TEMP!=='string'||!path.isAbsolute(env.RUNNER_TEMP))
    throw Error('DIRECT_B_APPLY_EXIT_RECORD_INVALID');
  const evidence={schema:DIRECT_B_EXIT_SCHEMA,runId:env.GITHUB_RUN_ID,
    jobName:env.GITHUB_JOB,step:'apply',nodeExitCode:Number(exitText)};
  writeFile(path.join(env.RUNNER_TEMP,DIRECT_B_EXIT_FILE),
    JSON.stringify(evidence)+'\n',{flag:'wx'});
  return evidence;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    recordApplyExit({exitText:process.argv[2]});
    process.stdout.write('DIRECT_B_APPLY_EXIT_RECORDED\n');
  }catch{
    process.stderr.write('DIRECT_B_APPLY_EXIT_NOT_RECORDED\n');
    process.exitCode=1;
  }
}
