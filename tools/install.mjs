import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync,spawn} from 'node:child_process';import {createHash} from 'node:crypto';import {pipeline} from 'node:stream/promises';import {Readable} from 'node:stream';
import {protectedState,nativeTaskXml} from '../controller/operations.mjs';
const gh='C:/Program Files/GitHub CLI/gh.exe',repo='E:/ZGmini/projects/zgmini-pc-control',root='E:/ZGmini/automation/pc-control',remote='ansqhd5774-Choi/zgmini-pc-control',source='E:/ZGmini/projects/zgmini-theme-recovery',approved='a735e4edff07409f952dcb6cd09a03791a95c094';
const run=(program,args,cwd=repo)=>execFileSync(program,args,{cwd,encoding:'utf8',windowsHide:true,timeout:120000,maxBuffer:8000000});
const api=(route,args=[])=>JSON.parse(run(gh,['api',route,...args]));const sha=b=>createHash('sha256').update(b).digest('hex');const need=(x,c)=>{if(!x)throw Object.assign(Error(c),{code:c});};
try{
 need(!fs.existsSync(path.join(root,'INSTALL_RESULT.json')),'ALREADY_INSTALLED');need(!fs.existsSync(root),'HOST_ROOT_EXISTS_STOP');
 const groups=run('whoami.exe',['/groups','/FO','CSV','/NH']);const integrity=Number(groups.match(/S-1-16-(\d+)/)?.[1]);need(integrity===8192,'NONSTANDARD_OR_ELEVATED_TOKEN_STOP');
 const repository=api('repos/'+remote);need(repository.private===true,'CONTROL_NOT_PRIVATE');need(api('repos/'+remote+'/actions/runners').total_count===0,'PREEXISTING_RUNNERS_STOP');
 need(run('git',['status','--porcelain']).trim()==='','CONTROL_CHECKOUT_DIRTY');const controlSha=run('git',['rev-parse','HEAD']).trim();
 const before=protectedState('E:/ZGmini/data',{queryTask:nativeTaskXml});fs.mkdirSync(root,{recursive:true});
 const disk=fs.statfsSync(root);need(disk.bavail*disk.bsize>4*2**30,'INSUFFICIENT_DISK');
 const list=run('git',['ls-files']).trim().split(/\r?\n/);const controllerFiles={};
 for(const rel of list.filter(f=>f.startsWith('controller/')||f==='config/operations.json')){const bytes=execFileSync('git',['show',controlSha+':'+rel],{cwd:repo,windowsHide:true});const dest=path.join(root,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});controllerFiles[rel]=sha(bytes);}
 const bundle=path.join(root,'approved',approved);fs.mkdirSync(path.join(bundle,'source'),{recursive:true});const tar=path.join(bundle,'source.tar');
 execFileSync('git',['archive','--format=tar','--output',tar,approved],{cwd:source,windowsHide:true});run('tar.exe',['-xf',tar,'-C',path.join(bundle,'source')]);
 const sourceFiles={};function walk(dir,rel=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const r=rel?rel+'/'+e.name:e.name;need(!e.isSymbolicLink(),'APPROVED_SOURCE_SYMLINK_STOP');if(e.isDirectory())walk(path.join(dir,e.name),r);else sourceFiles[r]=sha(fs.readFileSync(path.join(dir,e.name)));}}walk(path.join(bundle,'source'));
 fs.writeFileSync(path.join(bundle,'manifest.json'),JSON.stringify({sourceSha:approved,files:sourceFiles},null,2));
 const host={schema:'ZGMINI_PC_HOST_V1',controllerSourceSha:controlSha,dataRoot:'E:/ZGmini/data',controllerFiles,approvedSources:{[approved]:{root:bundle,branch:'codex/theme-fear-greed-integration-20261025',manifestSha256:sha(JSON.stringify(sourceFiles)),tests:['tests/theme-platform.test.mjs','tests/theme-platform-policy.test.mjs','tests/theme-platform-store.test.mjs']}}};fs.writeFileSync(path.join(root,'host.json'),JSON.stringify(host,null,2));
 const release=api('repos/actions/runner/releases/latest');const asset=release.assets.find(a=>/^actions-runner-win-x64-.*\.zip$/.test(a.name));need(asset&&/^sha256:[a-f0-9]{64}$/.test(asset.digest),'OFFICIAL_RUNNER_DIGEST_MISSING');
 const cache=path.join(root,'download');fs.mkdirSync(cache);const archive=path.join(cache,asset.name);const response=await fetch(asset.browser_download_url,{signal:AbortSignal.timeout(180000)});need(response.ok,'RUNNER_DOWNLOAD_FAILED');await pipeline(Readable.fromWeb(response.body),fs.createWriteStream(archive,{flags:'wx'}));need(sha(fs.readFileSync(archive))===asset.digest.slice(7),'RUNNER_DOWNLOAD_SHA_MISMATCH');
 const template=path.join(root,'runner-template');fs.mkdirSync(template);run('tar.exe',['-xf',archive,'-C',template]);
 const registrations=[];
 for(let i=1;i<=6;i++){
  const seat=String(i).padStart(2,'0'),name='zgmini-pc-'+seat,dir=path.join(root,'runners',seat);fs.cpSync(template,dir,{recursive:true,errorOnExist:true,force:false});
  const registration=api('repos/'+remote+'/actions/runners/registration-token',['--method','POST']);need(/^[A-Za-z0-9_-]+$/.test(registration.token),'REGISTRATION_TOKEN_FORMAT');
  const command=[path.join(dir,'config.cmd'),'--unattended','--url','https://github.com/'+remote,'--token',registration.token,'--name',name,'--labels','zgmini-pc-control,zgmini-seat-'+seat,'--work','_work'].join(' ');
  try{execFileSync(process.env.ComSpec||'cmd.exe',['/d','/s','/c',command],{cwd:dir,windowsHide:true,timeout:120000,stdio:['ignore','pipe','pipe']});}catch{throw Object.assign(Error('RUNNER_CONFIG_FAILED_'+seat),{code:'RUNNER_CONFIG_FAILED_'+seat});}
  registrations.push({seat:i,name,configured:true});console.log(JSON.stringify({phase:'RUNNER_REGISTERED',seat:i,name}));
 }
 try{api('repos/'+remote+'/labels',['--method','POST','-f','name=pc-job','-f','color=0e8a16','-f','description=Approved PC allowlist request']);}catch{}
 const startup=path.join(process.env.APPDATA,'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_CONTROL.vbs');need(!fs.existsSync(startup),'STARTUP_ENTRY_EXISTS_STOP');
 const vbs='Set s = CreateObject("WScript.Shell")\r\ns.Run """'+process.execPath+'"" ""'+path.join(root,'controller/supervisor.mjs')+'""", 0, False\r\n';fs.writeFileSync(startup,vbs,{flag:'wx'});
 const after=protectedState('E:/ZGmini/data',{queryTask:nativeTaskXml});need(JSON.stringify(before)===JSON.stringify(after),'PROTECTED_STATE_CHANGED_DURING_INSTALL');
 const result={status:'SIX_RUNNERS_CONFIGURED_STARTUP_INSTALLED',at:new Date().toISOString(),controlRepository:remote,controlSourceSha:controlSha,runnerVersion:release.tag_name,runnerArchiveSha256:asset.digest.slice(7),registrations,integrityLevel:'MEDIUM_NON_ELEVATED',autoStart:'CURRENT_USER_LOGON_STARTUP',beforeHash:sha(JSON.stringify(before)),afterHash:sha(JSON.stringify(after)),protectedStateUnchanged:true,existingTasksChanged:0,operationalSourceChanged:false,providerCalls:0,d1Writes:0,serviceInstalled:false};
 fs.writeFileSync(path.join(root,'INSTALL_RESULT.json'),JSON.stringify(result,null,2));
 const child=spawn(process.execPath,[path.join(root,'controller/supervisor.mjs')],{cwd:root,detached:true,windowsHide:true,stdio:'ignore'});child.unref();console.log(JSON.stringify({...result,supervisorPid:child.pid},null,2));
}catch(error){console.error(JSON.stringify({status:'INSTALL_STOP',code:/^[A-Z0-9_]+$/.test(error.code??'')?error.code:'INSTALLATION_ENVIRONMENT_ERROR',partialHostRoot:fs.existsSync(root),instruction:'INSPECT_CURRENT_STATE_BEFORE_RETRY_NO_REPLACE_OR_TOKEN_OUTPUT'}));process.exitCode=1;}
