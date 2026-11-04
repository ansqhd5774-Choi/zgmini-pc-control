import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync as ex,spawn,spawnSync} from 'node:child_process';
import {TextDecoder} from 'node:util';import {fileURLToPath} from 'node:url';
const home='E:/ZGmini/automation/pc-watchdog',repo='E:/ZGmini/projects/zgmini-pc-control';
const startup=()=>path.join(process.env.APPDATA,'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_CONTROL.vbs');
const hash=b=>createHash('sha256').update(b).digest('hex');
const retiredIran='ZGMINI-PC-Iran-Progress-R13';
const scheduler='C:/Windows/System32/schtasks.exe';
const fail=code=>{throw Object.assign(Error(code),{code});};
const decode=bytes=>new TextDecoder('euc-kr').decode(bytes??Buffer.alloc(0));
const notFound=message=>/cannot find the file|cannot find the specified|does not exist|지정.*(?:파일|작업|경로).*찾을 수 없|찾을 수 없.*(?:파일|작업|경로)/i.test(message);
export function verifyRetiredIranAbsent(run=(args)=>spawnSync(scheduler,args,{windowsHide:true,timeout:15000,maxBuffer:4000000})){
 const exact=run(['/Query','/TN',retiredIran,'/XML']);
 if(!exact||exact.error||exact.signal)fail('WATCHDOG_IRAN_TASK_QUERY_UNCERTAIN');
 if(exact.status===0)fail('WATCHDOG_IRAN_TASK_REAPPEARED');
 if(exact.status!==1||!notFound(decode(exact.stderr)))fail('WATCHDOG_IRAN_TASK_QUERY_UNCERTAIN');
 const inventory=run(['/Query','/FO','CSV','/NH']);
 if(!inventory||inventory.error||inventory.signal||inventory.status!==0)fail('WATCHDOG_IRAN_TASK_INVENTORY_UNAVAILABLE');
 const names=decode(inventory.stdout).split(/\r?\n/)
  .map(line=>line.match(/^\s*"([^"]+)"\s*,/)?.[1]??null).filter(Boolean);
 if(names.length===0)fail('WATCHDOG_IRAN_TASK_INVENTORY_UNAVAILABLE');
 if(names.some(name=>/ZGMINI-PC-Iran/i.test(name)))fail('WATCHDOG_IRAN_TASK_REAPPEARED');
 return 'APPROVED_RETIRED_ABSENT';
}
export function protection({queryXml=(name)=>ex(scheduler,['/Query','/TN',name,'/XML'],{windowsHide:true}),
 retiredProof=verifyRetiredIranAbsent,exists=fs.existsSync,read=fs.readFileSync}={}){
 const out={};
 for(const t of ['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea'])out[t]=hash(queryXml(t));
 out[retiredIran]=retiredProof();
 for(const p of ['E:/ZGmini/data/pc-writer/config.json','E:/ZGmini/data/pc-writer/quota-runner.cmd','E:/ZGmini/data/pc-writer/run-local.cmd','E:/ZGmini/automation/pc-control/host.json'])if(exists(p))out[p]=hash(read(p));
 return out;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
if(process.argv[2]==='--verify'){
 const before=JSON.parse(fs.readFileSync(home+'/PROTECTION_BEFORE.json'));
 console.log(JSON.stringify({protectionUnchanged:JSON.stringify(before)===JSON.stringify(protection()),status:JSON.parse(fs.readFileSync(home+'/STATUS.json'))}));
}else{
 if(fs.existsSync(home))throw Error('EXISTING_WATCHDOG_STOP');
 const before=protection(),source=fs.readFileSync(repo+'/tools/runner-watchdog.mjs'),vbs=fs.readFileSync(repo+'/tools/runner-watchdog-startup.vbs');
 if(!fs.existsSync(startup()))throw Error('EXISTING_STARTUP_REQUIRED');
 const original=fs.readFileSync(startup());
 fs.mkdirSync(home);
 fs.writeFileSync(home+'/PROTECTION_BEFORE.json',JSON.stringify(before,null,2));
 fs.writeFileSync(home+'/STARTUP_BEFORE.vbs',original,{flag:'wx'});
 fs.writeFileSync(home+'/runner-watchdog.mjs',source,{flag:'wx'});
 fs.writeFileSync(home+'/INSTALL.json',JSON.stringify({sha256:hash(source),startupSha256:hash(vbs),at:new Date().toISOString(),scope:'RUNNER_RECOVERY_ONLY',priorStartupSha256:hash(original)},null,2),{flag:'wx'});
 fs.writeFileSync(startup(),vbs);
 const guardian=spawn('C:/Windows/System32/wscript.exe',[startup()],{windowsHide:true,detached:true,stdio:'ignore'});guardian.unref();
 console.log(JSON.stringify({status:'WATCHDOG_STARTED',controllerUnchanged:true,protectionUnchanged:JSON.stringify(before)===JSON.stringify(protection())}));
}
}

