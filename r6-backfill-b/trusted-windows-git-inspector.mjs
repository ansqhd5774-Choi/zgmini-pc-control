// Trusted fixed-checkout Git inspector for the future one-shot Windows R6 B
// host. READ ONLY; no checkout, fetch, commit, runtime change or effect grant.
// No Issue/environment supplied SHA is considered authority here: the caller's
// independently verified C1 H/S0 pins must compare the returned HEAD values.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

export const R6_B_TRUSTED_CHECKOUTS=Object.freeze({
  control:'r6-control',source:'r6-source',
});
const SHA40=/^[0-9a-f]{40}$/;
const fail=code=>{const error=Error(`R6_B_GIT_${code}`);error.code=error.message;throw error;};
const same=(a,b,platform)=>platform==='win32'
  ? path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase()
  : path.normalize(a)===path.normalize(b);

function requireAbsoluteDriveOrFixture(target,platform,fixture) {
  if(typeof target!=='string'||target.length===0||!path.isAbsolute(target))
    fail('PATH_NOT_ABSOLUTE');
  if(platform==='win32'&&!fixture&&
    !/^[a-zA-Z]:\\/.test(path.win32.normalize(target)))
    fail('NONLOCAL_WINDOWS_PATH_STOP');
}

// Reject any redirection through a symlink/junction at any existing ancestor,
// rather than merely checking lstat() on the final checkout directory.
function verifiedPhysicalDirectory(io,target,platform,fixture) {
  requireAbsoluteDriveOrFixture(target,platform,fixture);
  const parser=platform==='win32'&&!fixture?path.win32:path;
  const normalized=parser.normalize(target);
  const parsed=parser.parse(normalized);
  let cursor=parsed.root;
  const relative=normalized.slice(parsed.root.length);
  if(!relative)fail('CHECKOUT_ROOT_UNVERIFIED');
  try {
    for(const component of relative.split(parser.sep)) {
      if(!component||component==='.'||component==='..')fail('PATH_COMPONENT_STOP');
      cursor=parser.join(cursor,component);
      const stat=io.lstatSync(cursor);
      if(!stat.isDirectory()||stat.isSymbolicLink())fail('JUNCTION_OR_SYMLINK_STOP');
      const real=io.realpathSync.native(cursor);
      if(!same(real,cursor,platform))fail('JUNCTION_OR_SYMLINK_STOP');
    }
  }catch(error){
    if(error?.code?.startsWith('R6_B_'))throw error;
    fail('CHECKOUT_DIRECTORY_UNAVAILABLE');
  }
  return io.realpathSync.native(normalized);
}

function sanitizeGitEnv(env) {
  const safe={};
  for(const [key,value] of Object.entries(env)) {
    if(!/^GIT_/i.test(key)&&typeof value==='string')safe[key]=value;
  }
  safe.GIT_OPTIONAL_LOCKS='0';
  safe.GIT_CONFIG_NOSYSTEM='1';
  return safe;
}

function inspectGit(root,{execGit,env,platform}) {
  // All args are fixed and execFileSync uses shell:false. Disable optional
  // index locks and fsmonitor hooks; never trust GIT_DIR/GIT_WORK_TREE from an
  // Actions event, issue payload or inherited runner environment.
  const invoke=args=>{
    try {
      const result=execGit('git',[
        '--no-optional-locks','-c','core.fsmonitor=false',
        '-c','core.untrackedCache=false','-C',root,...args,
      ],{encoding:'utf8',windowsHide:true,shell:false,timeout:15000,
        maxBuffer:1024*1024,env:sanitizeGitEnv(env)});
      if(typeof result!=='string'||result.length>1024*1024)fail('GIT_OUTPUT_UNVERIFIED');
      return result;
    }catch(error){
      if(error?.code?.startsWith('R6_B_'))throw error;
      fail('COMMAND_FAILED');
    }
  };
  if(invoke(['rev-parse','--is-inside-work-tree']).trim()!=='true')
    fail('NOT_WORKTREE');
  if(!same(invoke(['rev-parse','--show-toplevel']).trim(),root,platform))
    fail('GIT_TOPLEVEL_MISMATCH');
  const head=invoke(['rev-parse','HEAD']).trim();
  if(!SHA40.test(head))fail('HEAD_UNVERIFIED');
  const status=invoke(['status','--porcelain=v1','--untracked-files=all']);
  return Object.freeze({head,dirty:status.length>0});
}

function inspect({role,root,workspace,platform,fixture,io,execGit,env}) {
  if(platform!=='win32'&&!fixture)fail('WINDOWS_ONLY_STOP');
  const label=R6_B_TRUSTED_CHECKOUTS[role];
  if(!Object.hasOwn(R6_B_TRUSTED_CHECKOUTS,role)||!label)
    fail('ROLE_NOT_APPROVED');
  requireAbsoluteDriveOrFixture(workspace,platform,fixture);
  requireAbsoluteDriveOrFixture(root,platform,fixture);
  const parser=platform==='win32'&&!fixture?path.win32:path;
  const expected=parser.join(workspace,label);
  if(!same(root,expected,platform))fail('CHECKOUT_PATH_NOT_APPROVED');
  const workspacePhysical=verifiedPhysicalDirectory(io,workspace,platform,fixture);
  const checkedPhysical=verifiedPhysicalDirectory(io,root,platform,fixture);
  const expectedPhysical=parser.join(workspacePhysical,label);
  if(!same(checkedPhysical,expectedPhysical,platform))
    fail('CHECKOUT_REALPATH_MISMATCH');
  let dotGit;
  try {
    dotGit=io.lstatSync(parser.join(checkedPhysical,'.git'));
  }catch{fail('GIT_DIRECTORY_MISSING');}
  if(!dotGit.isDirectory()||dotGit.isSymbolicLink())
    fail('GIT_DIRECTORY_SHAPE_STOP');
  try {
    const dotGitPath=parser.join(checkedPhysical,'.git');
    if(!same(io.realpathSync.native(dotGitPath),dotGitPath,platform))
      fail('GIT_DIRECTORY_SHAPE_STOP');
  }catch(error){
    if(error?.code?.startsWith('R6_B_'))throw error;
    fail('GIT_DIRECTORY_SHAPE_STOP');
  }
  // A separately verified C1 approval must compare head==H or head==S0.
  return inspectGit(checkedPhysical,{execGit,env,platform});
}

// Only fixture entry supports injecting a filesystem, execution callback or
// platform. Test results are NOT independently trusted host authorization.
export function inspectR6BCheckoutFixture({role,root,workspace,
  platform=process.platform,io=fs,execGit=execFileSync,env=process.env}={}) {
  return inspect({role,root,workspace,platform,fixture:true,io,execGit,env});
}

// Production: the caller supplies only the role/root pair from fixed C0 and
// S0 checkouts; the trusted Windows job's workspace locates those two roots.
// Never accept SHA pins, other paths, git callbacks or event-supplied config.
export function inspectR6BCheckoutOnWindows({role,root}={}) {
  return inspect({role,root,workspace:process.env.GITHUB_WORKSPACE,
    platform:process.platform,fixture:false,io:fs,execGit:execFileSync,env:process.env});
}
