// Authenticate the fixed W03 read-only result before checking out any source.
import fs from 'node:fs';
import {authorize,SOURCE_SHA}
 from './w03-gmh-seven-collection-time-a.mjs';
try{
 const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 authorize(event,env);
 if(!env.GITHUB_OUTPUT)throw Error('NO_OUTPUT');
 fs.appendFileSync(env.GITHUB_OUTPUT,'candidateSourceSha='+SOURCE_SHA+'\n');
 process.stdout.write('W03_GMH_TIME_SOURCE_AUTHORIZED_READONLY\n');
}catch(e){
 const known=new Set(['W03_GMH_TIME_EVENT_STOP','W03_GMH_TIME_JSON_STOP',
  'W03_GMH_TIME_REQUEST_STOP','W03_GMH_TIME_CONTROL_DRIFT_STOP']);
 const code=known.has(e?.code)?e.code:e?.message==='NO_OUTPUT'?
  'W03_GMH_TIME_OUTPUT_MISSING_STOP':'W03_GMH_TIME_PREFLIGHT_STOP';
 process.stderr.write(code+'\n');
 process.exitCode=1;
}
