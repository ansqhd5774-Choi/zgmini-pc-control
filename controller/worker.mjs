import fs from 'node:fs';import {runOperation} from './operations.mjs';import {writeJson,errorCode} from './common.mjs';
const input=JSON.parse(fs.readFileSync(process.argv[2]));
try{const result=await runOperation(input.request,input.context);writeJson(process.argv[3],result);process.exitCode=result.status==='FAIL'?1:0;}
catch(error){const code=errorCode(error),blocked=['SOURCE_NOT_APPROVED_FOR_EXECUTION','APPROVED_SOURCE_BRANCH_MISMATCH','APPROVED_SOURCE_FILE_DRIFT','APPROVED_MANIFEST_DRIFT'].includes(code);writeJson(process.argv[3],{status:blocked?'BLOCKED':'FAIL',code});process.exitCode=blocked?0:1;}
