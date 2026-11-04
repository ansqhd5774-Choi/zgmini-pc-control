import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const safeName = name => /^[a-zA-Z0-9_./-]+\.mjs$/.test(name)
  && name.split('/').every(part => part && part !== '.' && part !== '..');

function readVerified(root, relative, expected) {
  const file = path.join(root, relative);
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > 1_048_576
    || path.relative(root, fs.realpathSync.native(file)) !== path.normalize(relative)) {
    throw Error('WRITER_BACKUP_PATH_UNSAFE');
  }
  const bytes = fs.readFileSync(file);
  if (digest(bytes) !== expected) throw Error('WRITER_BACKUP_HASH_MISMATCH');
  return bytes;
}

/** Create and verify a source-only backup in a new directory outside the checkout. */
export function createWriterSourceBackup({sourceRoot, backupRoot, expectedFiles}) {
  const entries = Object.entries(expectedFiles ?? {});
  if (!path.isAbsolute(sourceRoot) || !path.isAbsolute(backupRoot)
    || entries.length < 1 || entries.length > 64
    || entries.some(([name, hash]) => !safeName(name) || !/^[a-f0-9]{64}$/.test(hash))) {
    throw Error('WRITER_BACKUP_CONTRACT_INVALID');
  }
  const source = fs.realpathSync.native(sourceRoot);
  const backup = path.join(fs.realpathSync.native(path.dirname(backupRoot)), path.basename(backupRoot));
  const relative = path.relative(source, backup);
  if (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative)) {
    throw Error('WRITER_BACKUP_INSIDE_SOURCE');
  }
  const originals = entries.map(([name, hash]) => [name, readVerified(source, name, hash)]);
  fs.mkdirSync(backup);
  for (const [name, bytes] of originals) {
    const target = path.join(backup, name);
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.writeFileSync(target, bytes, {flag:'wx'});
  }
  for (const [name, hash] of entries) {
    readVerified(backup, name, hash);
    readVerified(source, name, hash);
  }
  return {backupRoot:backup, files:Object.fromEntries(entries),
    manifestSha256:digest(JSON.stringify(entries.sort(([a], [b]) => a.localeCompare(b))))};
}

/** Independently restore a pinned bundle. Paths must be chosen by the trusted port. */
export async function verifyWriterRecoveryBundle({bundleFile, restoreRoot,
  bundleSha256, originalSha, targetSha, targetFiles}) {
  const entries = Object.entries(targetFiles ?? {});
  if (!path.isAbsolute(bundleFile) || !path.isAbsolute(restoreRoot)
    || !/^[a-f0-9]{64}$/.test(bundleSha256) || originalSha === targetSha
    || ![originalSha,targetSha].every(sha => /^[a-f0-9]{40}$/.test(sha))
    || entries.length < 1 || entries.length > 64
    || entries.some(([name, hash]) => !safeName(name) || !/^[a-f0-9]{64}$/.test(hash))) {
    throw Error('WRITER_BUNDLE_CONTRACT_INVALID');
  }
  const file = fs.realpathSync.native(bundleFile);
  if (!fs.lstatSync(bundleFile).isFile()) throw Error('WRITER_BUNDLE_PATH_UNSAFE');
  const verifyDigest = async () => {
    const hash = createHash('sha256');
    for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
    if (hash.digest('hex') !== bundleSha256) throw Error('WRITER_BUNDLE_HASH_MISMATCH');
  };
  await verifyDigest();
  fs.mkdirSync(restoreRoot);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_/i.test(key)));
  Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',
    GIT_CONFIG_GLOBAL:path.join(restoreRoot,'no-global-config'),GIT_TERMINAL_PROMPT:'0'});
  const git = args => execFileSync('git',['--no-replace-objects',...args],{
    cwd:restoreRoot,env,windowsHide:true,timeout:120_000,maxBuffer:4_194_304,
    stdio:['ignore','pipe','pipe'],
  });
  git(['init','--bare','--template=','--quiet']);
  git(['fetch','--quiet','--no-tags',file,
    'refs/heads/writer-original:refs/heads/writer-original',
    'refs/heads/writer-candidate:refs/heads/writer-candidate']);
  const head = ref => git(['rev-parse',ref]).toString().trim();
  if (head('refs/heads/writer-original') !== originalSha
    || head('refs/heads/writer-candidate') !== targetSha) throw Error('WRITER_BUNDLE_REF_MISMATCH');
  git(['fsck','--connectivity-only','--no-reflogs']);
  git(['merge-base','--is-ancestor',originalSha,targetSha]);
  const changed = git(['diff','--name-only','-z',originalSha,targetSha]).toString().split('\0').filter(Boolean).sort();
  if (JSON.stringify(changed) !== JSON.stringify(entries.map(([name]) => name).sort())) {
    throw Error('WRITER_BUNDLE_DIFF_MISMATCH');
  }
  for (const [name, hash] of entries) {
    if (digest(git(['show',targetSha+':'+name])) !== hash) throw Error('WRITER_BUNDLE_TARGET_HASH_MISMATCH');
  }
  await verifyDigest();
  return {originalSha,targetSha,bundleSha256,independentlyRestored:true,connectivityVerified:true};
}
