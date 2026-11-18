import fs from 'node:fs';
import {authorize} from './w03-gmh-seven-d1-seed-a.mjs';
import {APPROVED_SOURCE_SHA} from './w03-gmh-seven-manual-once.mjs';
try{
 const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 authorize(event,env);
 if(!env.GITHUB_OUTPUT)throw Error('NO_OUTPUT');
 fs.appendFileSync(env.GITHUB_OUTPUT,'candidateSourceSha='+APPROVED_SOURCE_SHA+'\n');
 process.stdout.write('W03_GMH_D1_READ_ONLY_SOURCE_PIN\n');
}catch(error){
 // Return only the closed set of existing authorization denials. Never echo
 // the Issue body, the event, the token, source paths or exception messages.
 const allowed=new Set(['W03_GMH_D1_EVENT_STOP','W03_GMH_D1_JSON_STOP',
  'W03_GMH_D1_REQUEST_STOP']);
 const safe=allowed.has(error?.code)?error.code:
  error?.message==='NO_OUTPUT'?'W03_GMH_D1_OUTPUT_MISSING':
  'W03_GMH_D1_PREFLIGHT_UNEXPECTED_STOP';
 process.stderr.write(safe+'\n');
 process.exitCode=1;
}
