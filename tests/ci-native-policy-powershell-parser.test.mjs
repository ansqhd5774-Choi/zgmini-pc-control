// #4135: keep the independently approved Windows Owner installer parseable.
// The public Source CI can inspect the text on Linux; Windows runners use the
// native Windows PowerShell 5.1 parser without invoking or installing the script.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const installer=fileURLToPath(new URL('../tools/operator-packets/NATIVE_WRITER_B_POLICY_INSTALL_ONCE.ps1',import.meta.url));

test('independent Native Writer B Owner installer has one intact entrypoint',()=>{
 const source=fs.readFileSync(installer,'utf8');
 assert.equal((source.match(/^#Requires -Version 5\.1\s*$/gm)||[]).length,1,
  'first-party installer must have one Requires directive');
 assert.equal((source.match(/^Set-StrictMode -Version Latest\s*$/gm)||[]).length,1,
  'duplicate script body or unresolved source replacement');
 assert.match(source,/^param\(\r?\n/m,'installer must start with a param block');
 const start=source.indexOf('param(');
 const strict=source.indexOf('Set-StrictMode -Version Latest');
 assert.ok(start>=0&&strict>start&&strict<3000,
  'param block and strict mode must precede executable installer code');
 const header=source.slice(start,strict);
 assert.match(header,/\[switch\]\$Apply\s*\r?\n\)\s*$/m,
  'param block must be complete before the script body');
 assert.doesNotMatch(header,/\bfunction\s|\btry\s*\{/,
  'function definitions cannot be pasted into the param declaration');
});

test('independent Native Writer B Owner installer parses in Windows PowerShell 5.1',
 {skip:process.platform!=='win32'},()=>{
 const literal=installer.replace(/'/g,"''");
 const script=[
  '$tokens=$null',
  '$parseErrors=$null',
  "[void][System.Management.Automation.Language.Parser]::ParseFile('"+literal+"',[ref]$tokens,[ref]$parseErrors)",
  "if($parseErrors.Count -gt 0){$parseErrors|ForEach-Object{Write-Output $_.Message};exit 1}",
  'exit 0'
 ].join(';');
 const p=spawnSync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{
  encoding:'utf8',windowsHide:true,timeout:30000
 });
 assert.equal(p.error,undefined,'Windows PowerShell 5.1 must be available');
 assert.equal(p.status,0,'PowerShell parser rejected Owner installer:\n'+p.stdout+'\n'+p.stderr);
});
