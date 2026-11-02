// ONE-TIME, operator-run bootstrap. Not callable from a pc-job Actions step.
// Installs an independent user-Startup maintainer; existing controller and six
// Runner registrations are never replaced here.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repoRoot=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const maintenanceRoot='E:/ZGmini/automation/pc-maintenance';
const controlRoot='E:/ZGmini/automation/pc-control';
const sourceFiles=[
  'tools/maintenance-contract.mjs','tools/maintenance-apply.mjs',
  'tools/maintenance-agent.mjs','tools/maintenance-lock.mjs','tools/update.mjs'
];
const testFiles=[
  'tests/maintenance-contract.test.mjs','tests/maintenance-apply.test.mjs',
  'tests/maintenance-agent.test.mjs','tests/maintenance-lock.test.mjs'
];
const sha256=b=>createHash('sha256').update(b).digest('hex');
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{code});};
const requested=process.argv.slice(2);

function startupVbs() {
  const runtime='E:\\ZGmini\\runtime\\node.exe';
  const script='E:\\ZGmini\\automation\\pc-maintenance\\tools\\maintenance-agent.mjs';
  const home='E:\\ZGmini\\automation\\pc-maintenance';
  return [
    'Set WshShell = CreateObject("WScript.Shell")',
    'WshShell.Environment("PROCESS")("ZGMINI_PC_MAINTENANCE_ROOT") = "'+home+'"',
    'WshShell.Run Chr(34) & "'+runtime+'" & Chr(34) & " " & Chr(34) & "'+script+'" & Chr(34) & " --poll", 0, False',
    ''
  ].join('\r\n');
}

export function preflightBootstrap({args=requested,platform=process.platform,appData=process.env.APPDATA}={}){
 need(platform==='win32','BOOTSTRAP_WINDOWS_REQUIRED');
 need(!process.env.GITHUB_ACTIONS&&!process.env.RUNNER_NAME,'BOOTSTRAP_FROM_RUNNER_DENIED');
 need(args.length===2&&args[0]==='--source-sha'&&/^[a-f0-9]{40}$/.test(args[1]??''),'BOOTSTRAP_PINNED_SHA_REQUIRED');
 need(path.isAbsolute(appData??'')&&fs.existsSync(appData),'BOOTSTRAP_APPDATA_REQUIRED');
 need(fs.existsSync(controlRoot)&&!fs.existsSync(maintenanceRoot),'BOOTSTRAP_EXISTING_INSTALL_STOP');
 const startup=path.join(appData,'Microsoft/Windows/Start Menu/Programs/Startup/ZGMINI_PC_MAINTENANCE.vbs');
 need(!fs.existsSync(startup),'BOOTSTRAP_STARTUP_CONFLICT');
 const gh='C:/Program Files/GitHub CLI/gh.exe',node='E:/ZGmini/runtime/node.exe';
 need(fs.existsSync(gh)&&fs.existsSync(node),'BOOTSTRAP_TOOLS_MISSING');
  const metadata=JSON.parse(execFileSync(gh,['repo','view','ansqhd5774-Choi/zgmini-pc-control','--json','nameWithOwner,isPrivate'],{windowsHide:true,encoding:'utf8',timeout:30000}));
  need(metadata.nameWithOwner==='ansqhd5774-Choi/zgmini-pc-control'&&metadata.isPrivate===true,'BOOTSTRAP_PRIVATE_REPO_REQUIRED');
 const g=args=>execFileSync('git',args,{cwd:repoRoot,windowsHide:true,encoding:'utf8',timeout:30000}).trim();
 need(g(['status','--porcelain'])==='','BOOTSTRAP_CHECKOUT_DIRTY');
 need(g(['rev-parse','HEAD'])===args[1]&&g(['rev-parse','--abbrev-ref','HEAD'])==='main','BOOTSTRAP_SOURCE_SHA_OR_BRANCH');
 const groups=execFileSync('whoami.exe',['/groups'],{windowsHide:true,encoding:'utf8'});
 need(groups.includes('S-1-16-8192')&&!groups.includes('S-1-16-12288'),'BOOTSTRAP_MEDIUM_TOKEN_REQUIRED');
 for(const rel of [...sourceFiles,...testFiles])need(fs.existsSync(path.join(repoRoot,rel)),'BOOTSTRAP_FILE_MISSING');
 execFileSync(node,['--test',...testFiles],{cwd:repoRoot,windowsHide:true,timeout:120000,stdio:'ignore'});
 return {sourceSha:args[1],startup,node,gh};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const plan=preflightBootstrap();
    fs.mkdirSync(path.join(maintenanceRoot,'tools'),{recursive:true});
    for(const rel of sourceFiles){
      const destination=path.join(maintenanceRoot,rel);
      fs.copyFileSync(path.join(repoRoot,rel),destination,fs.constants.COPYFILE_EXCL);
      need(sha256(fs.readFileSync(destination))===sha256(fs.readFileSync(path.join(repoRoot,rel))),'BOOTSTRAP_COPY_DRIFT');
    }
    for(const name of ['ledger','approved','requests','reports'])fs.mkdirSync(path.join(maintenanceRoot,name),{recursive:true});
    const manifest={schema:'ZGMINI_PC_MAINTENANCE_INSTALL_V1',sourceSha:plan.sourceSha,
      files:Object.fromEntries(sourceFiles.map(rel=>[rel,sha256(fs.readFileSync(path.join(maintenanceRoot,rel)))])),
      controllerRootUnchanged:true,runnerRegistrationsUntouched:true,installedAt:new Date().toISOString()};
    fs.writeFileSync(path.join(maintenanceRoot,'MAINTENANCE_INSTALL.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
    const labels=JSON.parse(execFileSync(plan.gh,['label','list','--repo','ansqhd5774-Choi/zgmini-pc-control','--json','name','--limit','100'],{windowsHide:true,encoding:'utf8',timeout:30000}));
    if(!labels.some(x=>x.name==='pc-maintenance')){
      execFileSync(plan.gh,['label','create','pc-maintenance','--repo','ansqhd5774-Choi/zgmini-pc-control','--color','0052CC','--description','Approved independent Controller maintenance queue'],{windowsHide:true,stdio:'ignore',timeout:30000});
    }
    fs.writeFileSync(plan.startup,startupVbs(),{flag:'wx'});
    // Calling the independent Startup VBS is the only new process here.
    execFileSync('wscript.exe',[plan.startup],{windowsHide:true,timeout:10000});
    console.log(JSON.stringify({status:'BOOTSTRAP_STARTED',sourceSha:plan.sourceSha,
      startup:'ZGMINI_PC_MAINTENANCE.vbs',controllerUntouched:true,
      next:'VERIFY_PROCESS_AND_GITHUB_REQUEST_RESULT'}));
  }catch(e){console.log(JSON.stringify({status:'AUTOMATION_BLOCKED',code:e?.code??'BOOTSTRAP_ENVIRONMENT_ERROR',
    instruction:'INSPECT_PARTIAL_BOOTSTRAP_BEFORE_ANY_RETRY'}));process.exitCode=1;}
}
