import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {main as sourceResult} from './result-broker.mjs';
import {main as diagnosisResult} from './diagnosis-broker.mjs';
import {DIAGNOSIS_SCHEMA} from './diagnosis-result.mjs';
export async function main(env=process.env){
 const event=JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH,'utf8'));
 const result=JSON.parse(event.comment?.body??'');
 if(result.schema===DIAGNOSIS_SCHEMA)return diagnosisResult(env);
 return sourceResult(env);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)
 main().catch(e=>{process.stderr.write(e.message+'\n');process.exitCode=1;});
