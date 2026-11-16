import fs from 'node:fs';
import {authorize} from './w03-gmh-seven-private-score-once.mjs';
try{
 const env=process.env;
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const req=authorize(event,env);
 if(!env.GITHUB_OUTPUT)throw Error('NO_GITHUB_OUTPUT');
 fs.appendFileSync(env.GITHUB_OUTPUT,'candidateSourceSha='+req.candidateSourceSha+'\n');
 process.stdout.write('W03_GMH_SCORE_EXACT_SOURCE_APPROVED\n');
}catch{
 process.stderr.write('W03_GMH_SCORE_PREFLIGHT_DENIED\n');
 process.exitCode=1;
}
