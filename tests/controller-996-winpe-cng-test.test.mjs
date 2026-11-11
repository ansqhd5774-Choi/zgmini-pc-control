import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {constants,createHash,createPublicKey,verify} from 'node:crypto';

const source=fs.readFileSync(new URL('../tools/controller-996-winpe-cng-test.c',import.meta.url),'utf8');
const primitive=fs.readFileSync(new URL('../tools/controller-996-winpe-cng-handoff-verify.c',import.meta.url),'utf8');
const build=fs.readFileSync(new URL('../tools/BUILD_996_WINPE_CNG_TEST_ONLY.cmd',import.meta.url),'utf8');
const header=fs.readFileSync(new URL('./c996_winpe_cng_public_vectors.h',import.meta.url),'utf8');
const vector=name=>{
  const m=header.match(new RegExp('static const unsigned char '+name+'\\[\\] = \\{([\\s\\S]*?)\\};'));
  assert.ok(m,name);
  return Buffer.from([...m[1].matchAll(/0x([0-9a-f]{2})/g)].map(x=>parseInt(x[1],16)));
};
const manifest=vector('c996_manifest'),blob=vector('c996_public_blob'),pin=vector('c996_public_blob_sha256');
const signature=vector('c996_signature');
const exponentLength=blob.readUInt32LE(8);
const key=createPublicKey({format:'jwk',key:{kty:'RSA',
  e:blob.subarray(24,24+exponentLength).toString('base64url'),
  n:blob.subarray(24+exponentLength).toString('base64url')}});
const valid=(m,s,p)=>createHash('sha256').update(blob).digest().equals(p)&&
  verify('sha256',m,{key,padding:constants.RSA_PKCS1_PSS_PADDING,saltLength:32},s);

test('WinPE marker is opened read-only in the 64-bit view, closed and checked before crypto',()=>{
  assert.ok(source.includes('L"SOFTWARE\\\\Microsoft\\\\Windows NT\\\\CurrentVersion\\\\WinPE"'));
  assert.match(source,/RegOpenKeyExW\(HKEY_LOCAL_MACHINE/);
  assert.match(source,/KEY_QUERY_VALUE \| KEY_WOW64_64KEY/);
  assert.match(source,/if \(status != ERROR_SUCCESS\) return status/);
  assert.match(source,/return RegCloseKey\(key\)/);
  assert.ok(source.indexOf('if (environmentStatus != ERROR_SUCCESS)')<source.indexOf('if (!c996_crypto_only'));
  assert.doesNotMatch(source,/KEY_(?:WRITE|SET_VALUE|CREATE_SUB_KEY)|Reg(?:Create|Set|Delete|Enum)/);
});
test('dedicated harness has no host-name, drive, file, process or recovery operations',()=>{
  assert.match(source,/#error C996_WINPE_CNG_TEST_ONLY_REQUIRED/);
  assert.match(source,/#error C996_WINPE_CNG_REQUIRES_X64/);
  assert.match(source,/int main\(void\)/);
  assert.doesNotMatch(source,/DESKTOP-N62L0NG|E:|GetComputerName|GetFileAttributes|GetLogicalDrive|FindFirstVolume|FindNextVolume|GetVolume|CreateFile|ReadFile|WriteFile|MoveFile|DeleteFile|SetFile|fopen|fwrite|system\s*\(|CreateProcess|ShellExecute|RegLoad|RegSave/);
});
test('shared primitive and all test outcomes preserve authority boundaries',()=>{
  assert.match(source,/#include "controller-996-winpe-cng-handoff-verify.c"/);
  for(const field of ['trustedOwnerKeyEstablished','ownerApprovalVerified','offlineClockTrusted','winpeRuntimeVerified','executionAuthorized','operationalWrites'])
    assert.ok(source.includes('r.'+field+' == 0'),field);
  for(const token of ['VALID_PSS_SALT32_FAILED','MANIFEST_TAMPER_ACCEPTED','SIGNATURE_TAMPER_ACCEPTED','PUBLIC_PIN_TAMPER_ACCEPTED','WRONG_SALT_ACCEPTED','WRONG_PADDING_ACCEPTED'])
    assert.ok(source.includes(token),token);
  assert.match(primitive,/BCRYPT_PSS_PADDING_INFO padding = \{BCRYPT_SHA256_ALGORITHM, 32\}/);
  assert.ok(source.includes('bootIntegrityProven=0 imageBindingVerified=0'));
  assert.ok(source.includes('revocationVerified=0'));
  assert.doesNotMatch(header,/BEGIN (?:RSA )?PRIVATE KEY/);
});
test('embedded public fixture: valid PSS SHA256 salt32 accepted',()=>assert.equal(valid(manifest,signature,pin),true));
test('embedded public fixture: manifest tamper rejected',()=>{const m=Buffer.from(manifest);m[0]^=1;assert.equal(valid(m,signature,pin),false);});
test('embedded public fixture: signature tamper rejected',()=>{const s=Buffer.from(signature);s[0]^=1;assert.equal(valid(manifest,s,pin),false);});
test('embedded public fixture: public blob fingerprint tamper rejected',()=>{const p=Buffer.from(pin);p[0]^=1;assert.equal(valid(manifest,signature,p),false);});
test('embedded public fixture: wrong salt rejected',()=>assert.equal(valid(manifest,vector('c996_wrong_salt_signature'),pin),false));
test('embedded public fixture: PKCS1 padding rejected',()=>assert.equal(valid(manifest,vector('c996_pkcs1_signature'),pin),false));
test('build is x64 native C static CRT only and never runs its output',()=>{
  assert.match(build,/\/MT\b/);assert.match(build,/\/TC\b/);
  assert.match(build,/\/W4 \/WX/);assert.match(build,/-version "\[18.0,19.0\)"/);
  assert.match(build,/-arch=x64 -host_arch=x64/);
  assert.match(build,/dumpbin.exe \/dependents/);
  assert.doesNotMatch(build,/\/MD\b|\/clr\b|\/ZW\b|MFC|ATL|MakeWinPEMedia|DandISetEnv|dism\.exe/i);
  assert.doesNotMatch(build,/^\s*"%C996_OUTPUT%\\c996_winpe_cng_test.exe"/m);
});
test('optional built PE is x64 console with no CLR and only three OS DLLs',t=>{
  const dir=process.env.C996_WINPE_BUILD_OUTPUT;
  if(!dir){t.skip('provide C996_WINPE_BUILD_OUTPUT for real build inspection');return;}
  const b=fs.readFileSync(path.join(dir,'c996_winpe_cng_test.exe'));
  assert.equal(b.toString('ascii',0,2),'MZ');
  const pe=b.readUInt32LE(0x3c);
  assert.equal(b.toString('ascii',pe,pe+4),'PE\u0000\u0000');
  assert.equal(b.readUInt16LE(pe+4),0x8664);
  const opt=pe+24;assert.equal(b.readUInt16LE(opt),0x20b);
  assert.equal(b.readUInt16LE(opt+68),3);
  assert.equal(b.readUInt32LE(opt+112+14*8),0);
  assert.equal(b.readUInt32LE(opt+116+14*8),0);
  const sectionCount=b.readUInt16LE(pe+6),sectionTable=opt+b.readUInt16LE(pe+20);
  const offset=rva=>{
    for(let i=0;i<sectionCount;i++){
      const s=sectionTable+i*40,va=b.readUInt32LE(s+12),size=Math.max(b.readUInt32LE(s+8),b.readUInt32LE(s+16));
      if(rva>=va&&rva<va+size)return b.readUInt32LE(s+20)+rva-va;
    }throw Error('RVA outside sections');
  };
  const imports=[];let desc=offset(b.readUInt32LE(opt+120));
  for(let i=0;i<128;i++,desc+=20){
    const name=b.readUInt32LE(desc+12);if(!name)break;
    const p=offset(name),end=b.indexOf(0,p);assert.ok(end>p);
    imports.push(b.toString('ascii',p,end).toLowerCase());
  }
  assert.deepEqual(imports.sort(),['advapi32.dll','bcrypt.dll','kernel32.dll']);
});
