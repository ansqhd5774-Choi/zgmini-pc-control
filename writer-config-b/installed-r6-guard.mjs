// A fixed, read-only installed-source gate before enabling Core's two R6 flags.
// The approved Writer B postimage is checked again *inside the shared lock*.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {SOURCE_ROOT,sha256} from './contract.mjs';
import {readFixedReadonlyBytes} from '../controller/fixed-readonly-bytes.mjs';

const stop=code=>{throw Object.assign(new Error(code),{code});};
const need=(ok,code)=>{if(!ok)stop(code);};
function gitBinary(){
 const exe=[String.raw`C:\Program Files\Git\cmd\git.exe`,
  String.raw`C:\Program Files\Git\bin\git.exe`].find(fs.existsSync);
 need(exe,'CONFIG_B_SOURCE_GIT_UNAVAILABLE_STOP');
 return exe;
}
function readGitHead(root){
 const x=spawnSync(gitBinary(),['-C',root,'rev-parse','HEAD'],{
  encoding:'utf8',shell:false,windowsHide:true,timeout:15000});
 need(x.status===0&&/^[a-f0-9]{40}$/i.test(x.stdout.trim()),
  'CONFIG_B_SOURCE_HEAD_UNVERIFIED_STOP');
 return x.stdout.trim().toLowerCase();
}

export function verifyInstalledR6(manifest,originalConfig,{
 sourceRoot=SOURCE_ROOT,gitHead=readGitHead,fileSystem=fs}={}){
 need(Buffer.isBuffer(originalConfig)&&
  manifest?.verifiedR6Install?.status==='WRITER_B_INSTALLED_VERIFIED'&&
  Array.isArray(manifest.installedFiles)&&manifest.installedFiles.length===19,
 'CONFIG_B_INSTALL_AUTH_UNVERIFIED_STOP');
 let config;
 try{config=JSON.parse(originalConfig.toString('utf8'));}
 catch{stop('CONFIG_B_ORIGINAL_CONFIG_JSON_STOP');}
 const approved=manifest.verifiedR6Install.sourceSha.toLowerCase();
 need(config&&typeof config==='object'&&!Array.isArray(config)&&
   typeof config.source==='string'&&config.source.toLowerCase()===approved,
 'CONFIG_B_CONFIG_SOURCE_MISMATCH_STOP');
 let canonical;
 try{canonical=fileSystem.realpathSync.native(sourceRoot);
  need(fileSystem.lstatSync(sourceRoot).isDirectory(),
    'CONFIG_B_SOURCE_ROOT_UNVERIFIED_STOP');}
 catch{stop('CONFIG_B_SOURCE_ROOT_UNVERIFIED_STOP');}
 need(gitHead(sourceRoot)===approved,'CONFIG_B_SOURCE_HEAD_MISMATCH_STOP');
 for(const record of manifest.installedFiles){
  const filename=path.join(canonical,...record.path.split('/'));
  const read=readFixedReadonlyBytes(filename,{fileSystem,
   verifiedRoot:canonical,maxBytes:2_000_000,minBytes:1});
  need(read.ok&&sha256(read.bytes)===record.afterSha256,
   'CONFIG_B_R6_POSTIMAGE_MISMATCH_STOP');
 }
 return {verifiedFiles:manifest.installedFiles.length,sourceSha:approved};
}
