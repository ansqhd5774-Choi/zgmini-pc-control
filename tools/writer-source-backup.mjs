import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';

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
