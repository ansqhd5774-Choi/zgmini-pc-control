import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync as ex,spawn} from 'node:child_process';
const home='E:/ZGmini/automation/pc-watchdog',repo='E:/ZGmini/projects/zgmini-pc-control';
const startup=path.join(process.env.APPDATA,'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_CONTROL.vbs');
const hash=b=>createHash('sha256').update(b).digest('hex');
export function protection(){const out={};for(const t of ['ZGMINI-PC-Local-Core','ZGMINI-PC-Local-Korea','ZGMINI-PC-Iran-Progress-R13'])out[t]=hash(ex('C:/Windows/System32/schtasks.exe',['/Query','/TN',t,'/XML'],{windowsHide:true}));for(const p of ['E:/ZGmini/data/pc-writer/config.json','E:/ZGmini/data/pc-writer/quota-runner.cmd','E:/ZGmini/data/pc-writer/run-local.cmd','E:/ZGmini/automation/pc-control/host.json'])if(fs.existsSync(p))out[p]=hash(fs.readFileSync(p));return out;}
if(process.argv[2]==='--verify'){
 const before=JSON.parse(fs.readFileSync(home+'/PROTECTION_BEFORE.json'));
 console.log(JSON.stringify({protectionUnchanged:JSON.stringify(before)===JSON.stringify(protection()),status:JSON.parse(fs.readFileSync(home+'/STATUS.json'))}));
}else{
 if(fs.existsSync(home))throw Error('EXISTING_WATCHDOG_STOP');
 const before=protection(),source=fs.readFileSync(repo+'/tools/runner-watchdog.mjs'),vbs=fs.readFileSync(repo+'/tools/runner-watchdog-startup.vbs');
 if(!fs.existsSync(startup))throw Error('EXISTING_STARTUP_REQUIRED');
 const original=fs.readFileSync(startup);
 fs.mkdirSync(home);
 fs.writeFileSync(home+'/PROTECTION_BEFORE.json',JSON.stringify(before,null,2));
 fs.writeFileSync(home+'/STARTUP_BEFORE.vbs',original,{flag:'wx'});
 fs.writeFileSync(home+'/runner-watchdog.mjs',source,{flag:'wx'});
 fs.writeFileSync(home+'/INSTALL.json',JSON.stringify({sha256:hash(source),startupSha256:hash(vbs),at:new Date().toISOString(),scope:'RUNNER_RECOVERY_ONLY',priorStartupSha256:hash(original)},null,2),{flag:'wx'});
 fs.writeFileSync(startup,vbs);
 const guardian=spawn('C:/Windows/System32/wscript.exe',[startup],{windowsHide:true,detached:true,stdio:'ignore'});guardian.unref();
 console.log(JSON.stringify({status:'WATCHDOG_STARTED',controllerUnchanged:true,protectionUnchanged:JSON.stringify(before)===JSON.stringify(protection())}));
}
