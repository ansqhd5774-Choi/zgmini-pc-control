// No candidate checkout before owner-opened exact one-shot authorization.
import fs from 'node:fs';
import {authorize,APPROVED_SOURCE_SHA} from './w03-gmh-seven-manual-once.mjs';
try{
 const env=process.env;
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const req=authorize(event,env);
 if(!env.GITHUB_OUTPUT)throw Error('NO_OUTPUT');
 fs.appendFileSync(env.GITHUB_OUTPUT,
  'candidateSourceSha='+APPROVED_SOURCE_SHA+'\n');
 process.stdout.write('W03_GMH_MANUAL_APPROVED_SOURCE_PIN\n');
}catch{
 process.stderr.write('W03_GMH_MANUAL_PREFLIGHT_DENIED\n');
 process.exitCode=1;
}
