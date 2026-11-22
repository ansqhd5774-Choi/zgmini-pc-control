// Approval hashes refer to immutable Git blob bytes, never to Windows checkout
// CRLF conversions. This reads one fixed manifest; it does not approve or apply.
import fs from 'node:fs';import path from 'node:path';
import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
import {MANIFEST} from './contract.mjs';
export function readApprovalBytes({
 controlRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),
 runGit=execFileSync,
}={}){
 const binary=['C:/Program Files/Git/cmd/git.exe','C:/Program Files (x86)/Git/cmd/git.exe'].find(fs.existsSync)??'git';
 return runGit(binary,['-C',controlRoot,'cat-file','blob','HEAD:'+MANIFEST],{
  windowsHide:true,shell:false,timeout:12000,maxBuffer:12000,stdio:['ignore','pipe','ignore']});
}
