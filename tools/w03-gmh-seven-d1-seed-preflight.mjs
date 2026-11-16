import fs from 'node:fs';
import {authorize} from './w03-gmh-seven-d1-seed-a.mjs';
import {APPROVED_SOURCE_SHA} from './w03-gmh-seven-manual-once.mjs';
try{
 const env=process.env,event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 authorize(event,env);
 if(!env.GITHUB_OUTPUT)throw Error('NO_OUTPUT');
 fs.appendFileSync(env.GITHUB_OUTPUT,'candidateSourceSha='+APPROVED_SOURCE_SHA+'\n');
 process.stdout.write('W03_GMH_D1_READ_ONLY_SOURCE_PIN\n');
}catch{
 process.stderr.write('W03_GMH_D1_READ_ONLY_PREFLIGHT_DENIED\n');
 process.exitCode=1;
}
