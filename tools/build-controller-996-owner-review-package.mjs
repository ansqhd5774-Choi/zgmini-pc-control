// Reproducible review bundle only. It does not create the S2 approval manifest.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const BOOTSTRAP = 'tools/controller-996-c-native-trusted-bootstrap.mjs';
const OPERATOR = 'tools/controller-996-c-native-owner-operator.mjs';
const LOCK = 'tools/controller-996-c-native-owner-source-lock.json';
const LAUNCH = [
  'tools/VERIFY_996_WINDOWS_OUTER_ANCHOR.ps1',
  'tools/VERIFY_996_WINDOWS_TRUSTED_SNAPSHOT.ps1',
  'tools/controller-996-windows-source-snapshot.cs',
];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const need = (condition, code) => { if (!condition) throw Error(code); };

function lockedPaths(bytes, first, shape) {
  const body = bytes.toString('utf8').match(shape)?.[1];
  need(body, 'C996_REVIEW_SOURCE_LIST_MISSING');
  const files = [first];
  for (const line of body.trim().split(/\r?\n/).slice(1)) {
    const rel = line.trim().match(/^'(tools\/controller-996-[a-z0-9-]+\.(?:mjs|json))',$/)?.[1];
    need(rel, 'C996_REVIEW_SOURCE_PATH_INVALID');
    files.push(rel);
  }
  need(files.length === 16 && new Set(files).size === 16, 'C996_REVIEW_SOURCE_LIST_INVALID');
  return files.sort();
}

function crc32(bytes) {
  let crc = -1;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ -1) >>> 0;
}

// Stored ZIP, fixed DOS timestamp 1980-01-01 and sorted entry order.
function storedZip(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const [relative, bytes] of [...entries].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    const name = Buffer.from(relative);
    const crc = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(33, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50);
    entry.writeUInt16LE(20, 4);
    header.copy(entry, 6, 4, 30);
    entry.writeUInt32LE(offset, 42);
    local.push(header, name, bytes);
    central.push(entry, name);
    offset += header.length + name.length + bytes.length;
  }
  const index = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.size, 8);
  end.writeUInt16LE(entries.size, 10);
  end.writeUInt32LE(index.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, index, end]);
}

export function build996OwnerReviewPackage({repository, sourceCommit, outputDirectory}) {
  need(/^[a-f0-9]{40}$/.test(sourceCommit ?? ''), 'C996_REVIEW_FULL_COMMIT_REQUIRED');
  const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
    cwd: repository, windowsHide: true, maxBuffer: 2_000_000,
    env: Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name))),
  });
  need(git('rev-parse', '--verify', sourceCommit + '^{commit}').toString().trim() === sourceCommit,
    'C996_REVIEW_COMMIT_DRIFT');
  const readBlob = relative => git('cat-file', 'blob', sourceCommit + ':' + relative);
  const bootstrapPaths = lockedPaths(readBlob(BOOTSTRAP), BOOTSTRAP, /const FILES=Object\.freeze\(\[([\s\S]*?)\]\);/);
  const operatorBytes = readBlob(OPERATOR);
  const operatorPaths = lockedPaths(operatorBytes, OPERATOR, /const FILES=\[([\s\S]*?)\];/);
  need(JSON.stringify(bootstrapPaths) === JSON.stringify(operatorPaths), 'C996_REVIEW_SOURCE_LIST_DRIFT');
  need(operatorBytes.toString().includes("need(false,'C_996_OWNER_PREIMPORT_AND_NATIVE_CAS_NOT_ATTESTED')"),
    'C996_REVIEW_OPERATOR_HOLD_REQUIRED');
  const entries = new Map([...bootstrapPaths, ...LAUNCH].map(relative => [relative, readBlob(relative)]));
  const lock = json({schema:'ZGMINI_CONTROLLER_996_NATIVE_OWNER_SOURCE_LOCK_V1',
    files:Object.fromEntries(bootstrapPaths.map(relative => [relative, sha(entries.get(relative))]))});
  entries.set(LOCK, lock);
  entries.set('README.txt', Buffer.from(
    '#996 read-only review bundle\nSource: ' + sourceCommit +
    '\nOperator hold is enabled. No S2 manifest, Owner approval or production entry is supplied.\n'));
  const zip = storedZip(entries);
  const root = fs.realpathSync.native(os.tmpdir());
  const parent = fs.realpathSync.native(path.dirname(path.resolve(outputDirectory)));
  const rel = path.relative(root, parent);
  need(!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep),
    'C996_REVIEW_OUTPUT_TEMP_REQUIRED');
  fs.mkdirSync(outputDirectory);
  const zipFile = path.join(outputDirectory, 'ZGMINI_996_OWNER_REVIEW.zip');
  fs.writeFileSync(zipFile, zip, {flag:'wx'});
  const report = {
    status:'REVIEW_PACKAGE_ONLY', sourceCommit, zipSha256:sha(zip), sourceLockSha256:sha(lock),
    sourceCount:bootstrapPaths.length, productionExecutable:false,
    files:Object.fromEntries([...entries].map(([relative, bytes]) => [relative, sha(bytes)])),
  };
  fs.writeFileSync(path.join(outputDirectory, 'ZGMINI_996_OWNER_REVIEW_SHA256.json'), json(report), {flag:'wx'});
  return {zipFile, ...report};
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [sourceCommit] = process.argv.slice(2);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zgmini-996-owner-review-'));
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  console.log(JSON.stringify(build996OwnerReviewPackage({repository, sourceCommit,
    outputDirectory:path.join(root, 'result')}), null, 2));
}
